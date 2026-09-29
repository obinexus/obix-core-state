> **Status update (recovery Stage 2):** `createStateMachine` is now implemented (authored overlay `src/index.ts`; see `implementation-status.md` for the decided semantics). Statements below that say "not implemented" describe the upstream 0.1.0 stub.

# API reference

Full type surface of `obix-core-state`, as currently defined in
`src/index.ts`. Everything is exported from the package root; there is no
subpath export.

For what actually runs today versus what's only typed, see
[implementation-status.md](implementation-status.md) — this page documents
the shapes, not the (currently nonexistent) behavior.

## `createStateMachine(config: StateMachineConfig): StateMachine`

The only factory. Currently:

```ts
export function createStateMachine(config: StateMachineConfig): StateMachine {
  return {
    transition(event) { throw new Error("Not yet implemented"); },
    minimize() { throw new Error("Not yet implemented"); },
    getStates() { throw new Error("Not yet implemented"); },
    isAccepting() { throw new Error("Not yet implemented"); },
    serialize() { throw new Error("Not yet implemented"); },
    merge(other) { throw new Error("Not yet implemented"); },
    getCurrentState() { throw new Error("Not yet implemented"); },
  };
}
```

`config` is accepted (so call sites type-check against the real contract
below) but never referenced in the function body.

## `StateMachineConfig`

```ts
interface StateMachineConfig {
  initialState: string;
  states: State[];
  transitions: Transition[];
  acceptingStates?: string[];
  automatonType?: AutomatonType;
}
```

| Field | Intended meaning |
|---|---|
| `initialState` | The `id` of the `State` the machine starts in. |
| `states` | Every state the machine can be in. |
| `transitions` | Every edge the machine can fire, keyed by `(from, event)`. |
| `acceptingStates` | `id`s of states for which `isAccepting()` should return `true`. |
| `automatonType` | Which automata model (`"DFA" \| "NFA" \| "Moore" \| "Mealy"`) governs `transition()`/`minimize()` semantics. See [automaton-types.md](automaton-types.md). |

## `State`

```ts
interface State {
  id: string;
  name: string;
  metadata?: Record<string, unknown>;
  onEnter?: () => void;
  onExit?: () => void;
}
```

`id` is presumably the key used by `Transition.from`/`.to` and
`StateMachineConfig.initialState`/`.acceptingStates` (all typed as bare
`string`, not `State`, so matching is by convention, not enforced by the
type system). `onEnter`/`onExit` are lifecycle hooks with no current
caller — see [transitions-and-guards.md](transitions-and-guards.md).

## `Transition`

```ts
interface Transition {
  from: string;
  to: string;
  event: string;
  guard?: () => boolean;
  action?: () => void;
}
```

`from`/`to` reference `State.id` values. `guard`, if present, is
presumably meant to gate whether this transition can fire (evaluated with
no arguments — it must close over whatever context it needs). `action`,
if present, is presumably meant to run as a side effect of the transition
firing. See [transitions-and-guards.md](transitions-and-guards.md) for the
inferred contract.

## `StateMachine`

```ts
interface StateMachine {
  transition(event: string): boolean;
  minimize(): MinimizationResult;
  getStates(): State[];
  isAccepting(): boolean;
  serialize(): string;
  merge(other: StateMachine): StateMachine;
  getCurrentState(): State | undefined;
}
```

| Method | Return | Intended meaning |
|---|---|---|
| `transition(event)` | `boolean` | Attempt to fire a transition matching `event` from the current state; `true`/`false` presumably signals whether one fired (vs. no matching transition, or a `guard` that returned `false`). |
| `minimize()` | `MinimizationResult` | Reduce the machine to its minimal equivalent form. See [state-machine-minimization.md](state-machine-minimization.md). |
| `getStates()` | `State[]` | All states currently in the machine. |
| `isAccepting()` | `boolean` | Whether `getCurrentState()` is in `acceptingStates`. |
| `serialize()` | `string` | A persistable string form — format unspecified by the type. |
| `merge(other)` | `StateMachine` | Compose this machine with `other` into a new one — union semantics (NFA-style) vs. product semantics are unspecified by the type; see [state-machine-minimization.md](state-machine-minimization.md#merge-is-underspecified). |
| `getCurrentState()` | `State \| undefined` | The state the machine is presently in, if any. |

## `MinimizationResult`

```ts
interface MinimizationResult {
  originalStateCount: number;
  minimizedStateCount: number;
  reduction: number; // percentage
  equivalentStates: Map<string, string>;
}
```

See [state-machine-minimization.md](state-machine-minimization.md) for the
inferred meaning of `reduction` and `equivalentStates`.

## `AutomatonType`

```ts
type AutomatonType = "DFA" | "NFA" | "Moore" | "Mealy";
```

See [automaton-types.md](automaton-types.md).
