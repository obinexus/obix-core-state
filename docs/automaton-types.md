> **Status update (recovery Stage 2):** `createStateMachine` is now implemented (authored overlay `src/index.ts`; see `implementation-status.md` for the decided semantics). Statements below that say "not implemented" describe the upstream 0.1.0 stub.

# Automaton types

```ts
type AutomatonType = "DFA" | "NFA" | "Moore" | "Mealy";
```

`StateMachineConfig.automatonType` is optional and, like every other config
field, currently unread by `createStateMachine` (see
[implementation-status.md](implementation-status.md)). This page explains
what each value means in standard automata theory, as background for
what `automatonType` is presumably meant to select once `transition()` and
`minimize()` are implemented — it is not a description of current
behavior.

## DFA — Deterministic Finite Automaton

Exactly one transition (or none) is defined for any given `(state, event)`
pair. `transition(event)` in a DFA-typed machine would deterministically
either move to one specific next state or fail — there's no ambiguity to
resolve. This is the model `MinimizationResult` most directly maps to:
classical DFA minimization (see
[state-machine-minimization.md](state-machine-minimization.md)) assumes
determinism.

## NFA — Nondeterministic Finite Automaton

More than one transition can match the same `(state, event)` pair, and
which one "actually" fires is not fixed by the automaton alone — a real
NFA engine would need to track a *set* of possible current states, not a
single one. `StateMachine.getCurrentState()` returns a single
`State | undefined`, which is a DFA-shaped API — if `NFA` support lands, it
either needs machines to be determinized internally before this interface
is used, or the interface itself would need to change to expose a set of
current states.

## Moore machine

A finite-state machine whose output depends only on the *current state*,
not on the input that led there. `State.onEnter`/`onExit` line up neatly
with a Moore model — the state itself, once entered, drives observable
behavior independent of which transition/event brought you there.

## Mealy machine

A finite-state machine whose output depends on **both** the current state
and the specific transition/input taken. `Transition.action` lines up with
a Mealy model — the action fires per-edge, potentially producing different
effects for different events even from the same source state.

## Why this matters for this type contract

`State` carries `onEnter`/`onExit` (Moore-shaped) *and* `Transition`
carries `action` (Mealy-shaped) simultaneously — the type contract doesn't
force a single model, which is consistent with `automatonType` existing as
a per-machine switch rather than a fixed package-wide behavior. Until
`transition()` is implemented, there's no way to confirm from code which
of `onEnter`/`onExit`/`action` actually fire, in what order, or whether
that order is conditioned on `automatonType` at all — that's implementation
that doesn't exist yet.
