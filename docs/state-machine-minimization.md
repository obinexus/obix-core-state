> **Status update (recovery Stage 2):** `createStateMachine` is now implemented (authored overlay `src/index.ts`; see `implementation-status.md` for the decided semantics). Statements below that say "not implemented" describe the upstream 0.1.0 stub.

# State machine minimization

`minimize(): MinimizationResult` is not implemented — it throws (see
[implementation-status.md](implementation-status.md)). This page explains
what the `MinimizationResult` type implies about the intended algorithm, so
the contract can be reviewed or implemented against, without claiming any
of it currently executes.

```ts
interface MinimizationResult {
  originalStateCount: number;
  minimizedStateCount: number;
  reduction: number; // percentage
  equivalentStates: Map<string, string>;
}
```

## The classical algorithm this shape implies

DFA minimization (Moore's algorithm, or the finer-grained Hopcroft's
algorithm) works by finding sets of states that are **behaviorally
indistinguishable** — no sequence of events leads them to different
accept/reject outcomes — and collapsing each such set into a single
representative state. The type's field names map directly onto that
process:

- **`originalStateCount`** — `config.states.length` before minimization.
- **`minimizedStateCount`** — the number of distinct equivalence classes
  found; the size of the reduced state set.
- **`equivalentStates`** — presumably a map from every original `State.id`
  to the `id` of the representative state its equivalence class collapsed
  to. A state that was already unique relative to every other state would
  presumably map to itself (`equivalentStates.get(id) === id`) or be
  omitted, depending on the eventual implementation's convention — the
  type alone doesn't settle which.
- **`reduction`** — a percentage, most naturally
  `((originalStateCount - minimizedStateCount) / originalStateCount) * 100`,
  though this is inferred from the field name and comment, not read from
  any implementation.

## What minimization needs, that isn't on `MinimizationResult`

Standard DFA minimization operates over the full automaton — states,
transitions, and which states are accepting — not the resulting state
count alone. Two states are equivalent only if, for every possible event,
they transition to (recursively) equivalent states, and they agree on
accepting-ness. The current type contract doesn't expose:

- whether `minimize()` is meant to mutate the `StateMachine` it's called
  on, return a *new* minimized `StateMachine`, or only return statistics
  (`MinimizationResult` alone contains no states/transitions) — the
  `StateMachine` interface has no `getTransitions()` accessor, so a caller
  who wants the minimized machine's actual transition table has no typed
  way to retrieve it via `MinimizationResult` alone.
- how nondeterminism (`automatonType: "NFA"`) would be handled, since
  classical minimization assumes a deterministic automaton — see
  [automaton-types.md](automaton-types.md).

These are open design questions the current types leave unanswered, not
bugs — worth resolving (or explicitly documenting as "DFA/Moore/Mealy
only, NFA unsupported") before implementing `minimize()`.

## `merge` is underspecified

```ts
merge(other: StateMachine): StateMachine;
```

Composing two automata has at least two standard meanings that produce
very different results:

- **Union** (NFA-style): accept if either machine would accept — typically
  implemented via a new start state with ε-transitions into both machines,
  or by unioning transition tables.
- **Product** (synchronized composition): track both machines' states
  simultaneously as a single combined state (a pair), transitioning both
  in lockstep on shared events.

Nothing in the `StateMachine`/`Transition`/`State` types indicates which
`merge()` is meant to implement, or how `State.id` collisions between the
two machines would be resolved (e.g. would `other`'s state ids be
namespaced, or must they already be disjoint from `this`'s?). This should
be decided and documented before `merge()` is implemented, since callers
relying on one semantics when the implementation provides the other would
get silently wrong results, not a type error.
