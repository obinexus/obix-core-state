> **Status update (recovery Stage 2):** `createStateMachine` is now implemented (authored overlay `src/index.ts`; see `implementation-status.md` for the decided semantics). Statements below that say "not implemented" describe the upstream 0.1.0 stub.

# Transitions, guards, and lifecycle hooks

`transition(event): boolean` is not implemented — it throws (see
[implementation-status.md](implementation-status.md)). This page lays out
the contract implied by `Transition`'s and `State`'s fields, for review and
future implementation — none of it currently executes.

```ts
interface Transition {
  from: string;
  to: string;
  event: string;
  guard?: () => boolean;
  action?: () => void;
}

interface State {
  id: string;
  name: string;
  metadata?: Record<string, unknown>;
  onEnter?: () => void;
  onExit?: () => void;
}
```

## The implied `transition(event)` algorithm

Given the current state `s` and a call `transition(event)`:

1. Find `Transition`s where `from === s.id` and `event === <the argument>`.
2. If more than one matches (possible even in a nominally `"DFA"`-typed
   machine, since nothing in the types prevents authoring two transitions
   with the same `from`/`event`), which one wins is unspecified — likely
   "first match" if implemented naively, but this is exactly the kind of
   ambiguity `automatonType` might be meant to resolve or reject at
   construction time (e.g. validating no duplicate `(from, event)` pairs
   for a `"DFA"` machine).
3. If a matching transition has a `guard`, call it with no arguments. If it
   returns `false`, that transition presumably doesn't fire — whether
   `transition()` then tries the *next* matching transition (NFA-like
   backtracking) or gives up and returns `false` immediately is not
   determined by the types.
4. If a transition fires: presumably call `to`'s `onExit`... — wait,
   `from`'s `onExit`, then the transition's `action`, then `to`'s
   `onEnter`, then update the current state — this ordering
   (source-exit → edge-action → destination-enter) is the conventional
   one for Moore/Mealy-style machines, but again, inferred, not read from
   any implementation.
5. `transition()` returns `boolean` — presumably `true` if some transition
   fired, `false` if no `(from, event)` match existed or every matching
   `guard` rejected it.

## `guard` and `action` receive no arguments

Both are typed `() => boolean` / `() => void` — no access to the firing
`event`, the `Transition` itself, or any payload. If a guard needs to
decide based on external data (e.g. "only allow this transition if the
cart has items"), that data has to come from a closure over the guard
function, since the type contract gives the guard nothing else to work
with. Same for `action` — any side effect it performs has to be driven by
what it closes over, not by anything passed in at call time.

## `onEnter`/`onExit` vs. `action` — both exist, ordering is unresolved

As noted in [automaton-types.md](automaton-types.md), `State` carries
Moore-style `onEnter`/`onExit` while `Transition` carries a Mealy-style
`action`. A machine can define all three for the same transition
simultaneously — the type system doesn't prevent it, and no implementation
exists yet to say which runs first, or whether all three are even meant to
be supported together rather than being alternate styles a machine picks
one of via `automatonType`.

## `isAccepting()` and `acceptingStates`

```ts
acceptingStates?: string[]; // on StateMachineConfig
isAccepting(): boolean;     // on StateMachine
```

Presumably: `isAccepting()` returns
`acceptingStates?.includes(getCurrentState()?.id ?? "") ?? false`, i.e.
whether the current state's `id` is listed in `acceptingStates`. If
`acceptingStates` is omitted from the config, the most natural reading is
that no state is accepting and `isAccepting()` always returns `false` — but
this, too, is inference from field naming, not observed behavior.

## Example of the intended shape (does not run)

```ts
const door = createStateMachine({
  initialState: "closed",
  states: [
    { id: "closed", name: "Closed", onEnter: () => console.log("closed") },
    { id: "open", name: "Open", onEnter: () => console.log("open") },
  ],
  transitions: [
    {
      from: "closed",
      to: "open",
      event: "PUSH",
      guard: () => !isLocked(),
      action: () => playChime(),
    },
    { from: "open", to: "closed", event: "RELEASE" },
  ],
  acceptingStates: ["closed"],
});

door.transition("PUSH"); // intended: guard checked, action + onEnter fire, returns true/false
```
