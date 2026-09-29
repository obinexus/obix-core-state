# obix-core-state

> Previous name: `@obinexusltd/obix-core-state` — OBIX packages are named without an npm scope since decision D-102 (2026-09-29); the package, its version and its exports are unchanged.

> **Status: type contract only — nothing is implemented yet.** Every method
> on the `StateMachine` returned by `createStateMachine` currently throws
> `new Error("Not yet implemented")`, and `createStateMachine` never reads
> its `config` argument at all. This package today is an API design —
> useful to build against and review — not working software. See
> [docs/implementation-status.md](docs/implementation-status.md) for the
> exact, current, per-member status.

Typed automata-based state management: states, guarded transitions, and DFA
minimization, for `DFA | NFA | Moore | Mealy` automata.

## The problem it's designed to own

Hand-rolled state machines tend to either skip minimization entirely
(leaving redundant, equivalent states that make the machine harder to
reason about) or bolt it on as a one-off script disconnected from the
runtime machine. This package's type contract couples the two: a
`StateMachine` you can drive with `transition(event)`, guarded and
side-effecting via `Transition.guard`/`.action`, and reduce with
`minimize()` into a `MinimizationResult` that reports exactly which states
turned out to be equivalent. Once implemented, the same `StateMachine` type
is meant to also `serialize()`/`merge()` for persistence and composition.

## Install

```bash
npm install obix-core-state
```

Depends on `obix-core-state-minimizer` only; it has no peer dependency and needs no OBIX runtime.

## API

```ts
import {
  createStateMachine,
  type AutomatonType,
  type State,
  type Transition,
  type StateMachineConfig,
  type StateMachine,
  type MinimizationResult,
} from "obix-core-state";
```

| Export | Intended purpose | Current status |
|---|---|---|
| `createStateMachine(config)` | Factory. | Runs, but ignores `config` entirely and returns an object whose every method throws. |
| `transition(event)` | Fire a transition matching `event` from the current state, evaluating its `guard`, if any, and running its `action`. | Throws. |
| `minimize()` | Collapse equivalent states, returning a `MinimizationResult`. | Throws. |
| `getStates()` | List the machine's states. | Throws. |
| `isAccepting()` | Whether the current state is one of `acceptingStates`. | Throws. |
| `serialize()` | Produce a persistable string form of the machine. | Throws. |
| `merge(other)` | Compose two machines into one. | Throws. |
| `getCurrentState()` | The `State` the machine is currently in. | Throws. |

See [docs/api-reference.md](docs/api-reference.md) for the full type
reference, and [docs/implementation-status.md](docs/implementation-status.md)
for a member-by-member breakdown of what's read/used today (short answer:
nothing).

## Example (intended usage — currently throws)

```ts
import { createStateMachine } from "obix-core-state";

const traffic = createStateMachine({
  initialState: "red",
  automatonType: "Moore",
  states: [
    { id: "red", name: "Red" },
    { id: "green", name: "Green" },
    { id: "yellow", name: "Yellow" },
  ],
  transitions: [
    { from: "red", to: "green", event: "TIMER" },
    { from: "green", to: "yellow", event: "TIMER" },
    { from: "yellow", to: "red", event: "TIMER" },
  ],
  acceptingStates: ["green"],
});

try {
  traffic.transition("TIMER"); // throws: "Not yet implemented"
} catch (err) {
  console.error(err);
}
```

## Docs

- [docs/api-reference.md](docs/api-reference.md) — full type reference for the current type contract
- [docs/implementation-status.md](docs/implementation-status.md) — exactly what's implemented today (nothing) vs. typed-for-later
- [docs/automaton-types.md](docs/automaton-types.md) — what `DFA`/`NFA`/`Moore`/`Mealy` mean and how `automatonType` is presumably meant to be used
- [docs/state-machine-minimization.md](docs/state-machine-minimization.md) — the classical automata-minimization algorithm `minimize()`'s type shape implies
- [docs/transitions-and-guards.md](docs/transitions-and-guards.md) — the intended `transition()`/`Transition.guard`/`.action`/accepting-state contract

## Boundary

- `createStateMachine` never reads `config` — not `initialState`, not
  `states`, not `transitions`, not `acceptingStates`, not `automatonType`.
  No validation, no storage, nothing. Passing a malformed config today is
  indistinguishable from passing a well-formed one — both silently succeed
  at construction time and only fail once you call a method.
- Every `StateMachine` method throws synchronously, unconditionally, with
  the same message ("Not yet implemented") — there is no partial
  implementation to rely on for any method.
- `State.onEnter`/`State.onExit` and `Transition.guard`/`.action` are typed
  callback hooks with no current caller — nothing in this package invokes
  them.
- Everything else documented in this repo about *how* transitions,
  minimization, serialization, and merging are meant to work
  ([docs/state-machine-minimization.md](docs/state-machine-minimization.md),
  [docs/transitions-and-guards.md](docs/transitions-and-guards.md)) is
  inferred from the type shapes and standard automata theory, not read out
  of a working implementation — treat it as design intent to build toward
  or review, not a description of current runtime behavior.

MIT — OBINexus Computing

<!-- obix-release:begin — generated by scripts/release/prepare.mjs; edit the text above this line -->

## Installation

```bash
npm install obix-core-state
```

## API surface

- `obix-core-state` — 1 value export: `createStateMachine`
- Type declarations: `./dist/index.d.ts` (and a declaration next to every JS entry point).

## Architecture role

`obix-core-state` is a **public building block**: the umbrella `obix` depends on it and re-exports its stable API, so applications normally reach it through `obix`; it can also be installed on its own.

The architecture of OBIX — the package families and which packages are public API — is indexed in the umbrella: [docs/architecture.md](https://github.com/obinexus/obix/blob/main/docs/architecture.md).

## Package relationships

- Depends on (OBIX): [`obix-core-state-minimizer`](https://github.com/obinexus/obix-core-state-minimizer).
- Used by (OBIX): [`obix`](https://github.com/obinexus/obix).

## Testing

- 1 test file ships in the npm package (`test/`): the evidence of the package's contract, published so that its verification can be inspected — not runtime code (no entry point reaches it).
- **Standalone**: 1 of 1 — it reads nothing outside the package.
- Run them with `npm test` (`node --test "test/*.test.mjs"`) in the OBIX monorepo, which provides the test tooling (Node's test runner, TypeScript) and the harness.

## Documentation

- [docs/api-reference.md](docs/api-reference.md)
- [docs/automaton-types.md](docs/automaton-types.md)
- [docs/implementation-status.md](docs/implementation-status.md)
- [docs/state-machine-minimization.md](docs/state-machine-minimization.md)
- [docs/transitions-and-guards.md](docs/transitions-and-guards.md)
- [CHANGELOG.md](CHANGELOG.md)
- The OBIX architecture index: [obix/docs/architecture.md](https://github.com/obinexus/obix/blob/main/docs/architecture.md)

## Repository

- https://github.com/obinexus/obix-core-state — `git@github.com:obinexus/obix-core-state.git`
- Issues: https://github.com/obinexus/obix-core-state/issues
- The repository is a clean export of the package from the OBIX monorepo. Its lineage — the sources it was recovered from and its earlier names — is `PROVENANCE.json`, shipped in this package; the repository's copy also records the monorepo commit it was exported from.

## License

MIT — see [LICENSE](LICENSE).

<!-- obix-release:end -->
