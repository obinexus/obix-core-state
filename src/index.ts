/**
 * obix-core-state — automata-based state machines.
 *
 * `createStateMachine(config)` returns a working machine. Upstream shipped only the types and a factory whose every
 * method threw "Not yet implemented"; this is the implementation, with every question the upstream docs left open
 * decided explicitly (see docs/implementation-status.md):
 *
 *  - construction validates the config (unique ids, known initial/accepting states, known transition endpoints,
 *    no ambiguous unguarded duplicates for DFA/Moore/Mealy);
 *  - `transition(event)` tries the transitions from the current state for that event in declaration order and
 *    fires the first whose guard passes: source `onExit` → transition `action` → destination `onEnter`;
 *  - `minimize()` is Myhill–Nerode partition refinement (via obix-core-state-minimizer) and returns
 *    statistics without mutating the machine; it refuses machines whose guards/actions/hooks make behaviour observable
 *    beyond accept/reject (a RangeError, never a wrong answer);
 *  - `merge(other)` returns a NEW machine (union of states and transitions; conflicts throw).
 */
import { minimizeFSM } from 'obix-core-state-minimizer';

/** Automaton type for state classification. NFA machines execute deterministically (first passing candidate wins). */
export type AutomatonType = 'DFA' | 'NFA' | 'Moore' | 'Mealy';

/** State definition in the state machine. */
export interface State {
  id: string;
  name: string;
  metadata?: Record<string, unknown>;
  onEnter?: () => void;
  onExit?: () => void;
}

/** Transition between states. */
export interface Transition {
  from: string;
  to: string;
  event: string;
  guard?: () => boolean;
  action?: () => void;
}

/** State machine minimization result. `equivalentStates` maps EVERY original state id to its representative id. */
export interface MinimizationResult {
  originalStateCount: number;
  minimizedStateCount: number;
  /** percentage: (original - minimized) / original * 100 */
  reduction: number;
  equivalentStates: Map<string, string>;
}

/** State machine configuration. */
export interface StateMachineConfig {
  initialState: string;
  states: State[];
  transitions: Transition[];
  acceptingStates?: string[];
  automatonType?: AutomatonType;
}

/** State machine interface. */
export interface StateMachine {
  /** Fire the first passing transition for `event`; `true` if one fired, `false` if none matched or every guard rejected. */
  transition(event: string): boolean;
  /** Minimization statistics; does not change the machine. Throws RangeError when not minimizable (see module docs). */
  minimize(): MinimizationResult;
  getStates(): State[];
  isAccepting(): boolean;
  /** JSON document; functions (guards, actions, hooks) are recorded as booleans, not serialized. */
  serialize(): string;
  /** A NEW machine containing both machines' states and transitions. The initial state is this machine's. */
  merge(other: StateMachine): StateMachine;
  getCurrentState(): State | undefined;
}

/** Configs of machines created by this package, so `merge` can read the other machine's transitions. */
const CONFIGS = new WeakMap<StateMachine, Readonly<StateMachineConfig>>();

function validate(config: StateMachineConfig): void {
  if (!config || typeof config !== 'object') throw new TypeError('createStateMachine(config): config must be an object');
  const type = config.automatonType ?? 'DFA';
  if (!['DFA', 'NFA', 'Moore', 'Mealy'].includes(type)) throw new TypeError(`unknown automatonType "${String(type)}"`);
  const ids = new Set<string>();
  for (const s of config.states ?? []) {
    if (typeof s.id !== 'string' || s.id === '') throw new TypeError('every state needs a non-empty string id');
    if (ids.has(s.id)) throw new RangeError(`duplicate state id "${s.id}"`);
    ids.add(s.id);
  }
  if (ids.size === 0) throw new RangeError('a state machine needs at least one state');
  if (!ids.has(config.initialState)) throw new RangeError(`initialState "${config.initialState}" is not a state id`);
  for (const a of config.acceptingStates ?? []) if (!ids.has(a)) throw new RangeError(`accepting state "${a}" is not a state id`);
  const seen = new Set<string>();
  for (const t of config.transitions ?? []) {
    if (!ids.has(t.from)) throw new RangeError(`transition source "${t.from}" is not a state id`);
    if (!ids.has(t.to)) throw new RangeError(`transition target "${t.to}" is not a state id`);
    if (typeof t.event !== 'string' || t.event === '') throw new TypeError('every transition needs a non-empty string event');
    if (type !== 'NFA' && !t.guard) {
      const key = `${t.from}\u0000${t.event}`;
      if (seen.has(key)) throw new RangeError(`${type} machine has two unguarded transitions from "${t.from}" on "${t.event}" (ambiguous)`);
      seen.add(key);
    }
  }
}

export function createStateMachine(config: StateMachineConfig): StateMachine {
  validate(config);
  const type = config.automatonType ?? 'DFA';
  const states = new Map(config.states.map((s) => [s.id, s] as const));
  const accepting = new Set(config.acceptingStates ?? []);
  const transitions = [...config.transitions];
  let current = config.initialState;

  const machine: StateMachine = {
    transition(event) {
      const from = states.get(current)!;
      for (const t of transitions) {
        if (t.from !== current || t.event !== event) continue;
        if (t.guard && !t.guard()) continue;
        const to = states.get(t.to)!;
        from.onExit?.();
        t.action?.();
        current = t.to;
        to.onEnter?.();
        return true;
      }
      return false;
    },

    minimize() {
      if (type === 'NFA') throw new RangeError('cannot minimize an NFA: classical minimization assumes a deterministic automaton');
      const observable = [...states.values()].some((s) => s.onEnter || s.onExit) || transitions.some((t) => t.guard || t.action);
      if (observable) throw new RangeError('cannot minimize: guards, actions and onEnter/onExit hooks make behaviour observable beyond accept/reject, so merging states would change it');
      // Two states are only interchangeable if their metadata is identical too (metadata drives CSS/ARIA output).
      const meta = (s: State) => JSON.stringify(s.metadata ?? null);
      const table = new Map<string, string>();
      for (const t of transitions) table.set(`${t.from}\u0000${t.event}`, t.to);
      const alphabet = new Set(transitions.map((t) => t.event));
      // Encode metadata as extra symbols so partition refinement keeps differently-labelled states apart.
      const metaClasses = [...new Set([...states.values()].map(meta))];
      const SINK = '\u0000sink';
      const fsm = {
        states: new Set([...states.keys(), SINK]),
        alphabet: new Set([...alphabet, ...metaClasses.map((_, i) => `\u0000meta${i}`)]),
        initialState: config.initialState,
        acceptingStates: new Set([...accepting, SINK]),
        transition: (s: string, sym: string) => {
          if (sym.startsWith('\u0000meta')) { const st = states.get(s); return st && metaClasses[Number(sym.slice(5))] === meta(st) ? SINK : undefined; }
          return table.get(`${s}\u0000${sym}`);
        },
      };
      const result = minimizeFSM(fsm);
      const equivalent = new Map<string, string>();
      for (const id of states.keys()) equivalent.set(id, result.stateMap.get(id) ?? id);
      const original = states.size;
      const minimized = new Set(equivalent.values()).size;
      return { originalStateCount: original, minimizedStateCount: minimized, reduction: original === 0 ? 0 : ((original - minimized) / original) * 100, equivalentStates: equivalent };
    },

    getStates() { return [...states.values()].map((s) => ({ ...s })); },
    isAccepting() { return accepting.has(current); },
    getCurrentState() { const s = states.get(current); return s ? { ...s } : undefined; },

    serialize() {
      return JSON.stringify({
        automatonType: type, initialState: config.initialState, current,
        states: [...states.values()].map((s) => ({ id: s.id, name: s.name, metadata: s.metadata, hasOnEnter: !!s.onEnter, hasOnExit: !!s.onExit })),
        transitions: transitions.map((t) => ({ from: t.from, to: t.to, event: t.event, guarded: !!t.guard, hasAction: !!t.action })),
        acceptingStates: [...accepting],
      });
    },

    merge(other) {
      const cfg = CONFIGS.get(other);
      if (!cfg) throw new TypeError('merge(other): other must be a machine created by createStateMachine');
      const mergedStates = new Map(states);
      for (const s of cfg.states) {
        const mine = mergedStates.get(s.id);
        if (mine && (mine.name !== s.name || JSON.stringify(mine.metadata ?? null) !== JSON.stringify(s.metadata ?? null))) throw new RangeError(`cannot merge: state "${s.id}" is defined differently in the two machines`);
        if (!mine) mergedStates.set(s.id, s);
      }
      const mergedTransitions = [...transitions];
      for (const t of cfg.transitions) {
        const clash = mergedTransitions.find((m) => m.from === t.from && m.event === t.event && !m.guard && !t.guard);
        if (clash && clash.to !== t.to) throw new RangeError(`cannot merge: "${t.from}" on "${t.event}" goes to "${clash.to}" in one machine and "${t.to}" in the other`);
        if (!clash && !mergedTransitions.some((m) => m === t)) mergedTransitions.push(t);
      }
      return createStateMachine({ initialState: config.initialState, states: [...mergedStates.values()], transitions: mergedTransitions, acceptingStates: [...new Set([...accepting, ...(cfg.acceptingStates ?? [])])], automatonType: type === cfg.automatonType ? type : 'NFA' });
    },
  };
  CONFIGS.set(machine, Object.freeze({ ...config, states: [...config.states], transitions }));
  return machine;
}
