# Implementation status

`createStateMachine(config)` is implemented (recovery Stage 2). Upstream `0.1.0` shipped only the types and a factory whose every
method threw `Error("Not yet implemented")`; the upstream docs listed the open design questions. This page is the single
source of truth for what runs and how those questions were decided. The behaviour is specified by `test/state-machine.test.mjs`.

## Construction (validation)

`createStateMachine(config)` throws:

- `TypeError` — `config` is not an object, an unknown `automatonType`, a state without a non-empty string `id`, a transition without a non-empty string `event`;
- `RangeError` — no states, duplicate state ids, an `initialState` / accepting state / transition endpoint that is not a state id, or (for `DFA`, `Moore`, `Mealy`) two **unguarded** transitions from the same state on the same event (ambiguous). Guarded duplicates are allowed: the guards discriminate.

## `transition(event)`

Candidates are the transitions from the current state on `event`, **in declaration order**. The first whose `guard` is absent or returns `true` fires;
a rejecting guard falls through to the next candidate. If none fires, `transition` returns `false` and **no hook runs**.
Order when one fires: source state `onExit` → transition `action` → destination state `onEnter` → current state updated. A self-transition runs all three (external transition).
`NFA` machines execute deterministically by the same rule; they are not simulated non-deterministically.

## `minimize()`

Myhill–Nerode partition refinement (`obix-core-state-minimizer`). It returns statistics and **does not change the machine**:
`equivalentStates` maps *every* original state id to its representative (a unique state maps to itself); `reduction = (original − minimized) / original × 100`.
States are only merged when they are indistinguishable by accept/reject **and** by `metadata` (metadata drives CSS/ARIA output).
It throws `RangeError` instead of guessing when the answer would be unsound: for `NFA`, or when any guard, action or `onEnter`/`onExit` hook exists (side effects are observable behaviour).

## `merge(other)`

Returns a **new** machine; neither operand changes. States are unioned by id (same id with a different `name`/`metadata` → `RangeError`); transitions are unioned (same source and event to a different target, both unguarded → `RangeError`); accepting states are unioned; the initial state is the receiver's; the result is `NFA` if the two machines' types differ. `other` must have been created by this package (`TypeError` otherwise).

## `serialize()` / `getStates()` / `getCurrentState()` / `isAccepting()`

`serialize()` is a JSON document of the structure; functions are recorded as booleans (`guarded`, `hasAction`, `hasOnEnter`, `hasOnExit`), not serialized. `getStates()` and `getCurrentState()` return copies. `isAccepting()` reports whether the current state is in `acceptingStates`.
