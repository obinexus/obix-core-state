import test from 'node:test';
import assert from 'node:assert/strict';
import { createStateMachine } from '../dist/index.js';

const traffic = () => ({
  initialState: 'green',
  states: [{ id: 'green', name: 'Green' }, { id: 'yellow', name: 'Yellow' }, { id: 'red', name: 'Red' }],
  transitions: [
    { from: 'green', to: 'yellow', event: 'timer' },
    { from: 'yellow', to: 'red', event: 'timer' },
    { from: 'red', to: 'green', event: 'timer' },
  ],
  acceptingStates: ['red'],
});

test('validates its configuration at construction', () => {
  assert.throws(() => createStateMachine({ ...traffic(), initialState: 'blue' }), /initialState "blue"/);
  assert.throws(() => createStateMachine({ ...traffic(), states: [{ id: 'a', name: 'A' }, { id: 'a', name: 'A2' }], initialState: 'a', transitions: [] }), /duplicate state id/);
  assert.throws(() => createStateMachine({ ...traffic(), transitions: [{ from: 'green', to: 'nowhere', event: 'x' }] }), /target "nowhere"/);
  assert.throws(() => createStateMachine({ ...traffic(), acceptingStates: ['nope'] }), /accepting state "nope"/);
  assert.throws(() => createStateMachine({ initialState: 'a', states: [], transitions: [] }), /at least one state/);
  const ambiguous = { ...traffic(), transitions: [{ from: 'green', to: 'yellow', event: 'go' }, { from: 'green', to: 'red', event: 'go' }] };
  assert.throws(() => createStateMachine(ambiguous), /ambiguous/);
  assert.doesNotThrow(() => createStateMachine({ ...ambiguous, automatonType: 'NFA' }));
});

test('transition() moves along matching edges and reports whether one fired', () => {
  const m = createStateMachine(traffic());
  assert.equal(m.getCurrentState().id, 'green');
  assert.equal(m.transition('timer'), true);
  assert.equal(m.getCurrentState().id, 'yellow');
  assert.equal(m.transition('unknown'), false);
  assert.equal(m.getCurrentState().id, 'yellow');
  assert.equal(m.isAccepting(), false);
  m.transition('timer');
  assert.equal(m.isAccepting(), true);
});

test('lifecycle order is source onExit → edge action → destination onEnter', () => {
  const log = [];
  const m = createStateMachine({
    initialState: 'a',
    states: [{ id: 'a', name: 'A', onExit: () => log.push('exit a') }, { id: 'b', name: 'B', onEnter: () => log.push('enter b') }],
    transitions: [{ from: 'a', to: 'b', event: 'go', action: () => log.push('action') }],
  });
  m.transition('go');
  assert.deepEqual(log, ['exit a', 'action', 'enter b']);
});

test('guards: the first passing candidate fires; if every guard rejects, nothing fires and hooks do not run', () => {
  let allow = false; const log = [];
  const m = createStateMachine({
    initialState: 'idle',
    states: [{ id: 'idle', name: 'Idle', onExit: () => log.push('exit') }, { id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    transitions: [
      { from: 'idle', to: 'a', event: 'go', guard: () => allow },
      { from: 'idle', to: 'b', event: 'go', guard: () => true },
    ],
  });
  assert.equal(m.transition('go'), true);
  assert.equal(m.getCurrentState().id, 'b', 'the first candidate was rejected, so the second fires');
  const n = createStateMachine({ initialState: 'idle', states: [{ id: 'idle', name: 'Idle', onExit: () => log.push('nope') }, { id: 'a', name: 'A' }], transitions: [{ from: 'idle', to: 'a', event: 'go', guard: () => allow }] });
  assert.equal(n.transition('go'), false);
  assert.deepEqual(log, ['exit'], 'a rejected transition must not run onExit');
  allow = true;
  assert.equal(n.transition('go'), true);
});

test('minimize() merges behaviourally equivalent states and reports statistics without mutating the machine', () => {
  // s1 and s2 are indistinguishable (both go to accepting f on "x"); f is accepting; s0 goes to s1 or s2.
  const m = createStateMachine({
    initialState: 's0',
    states: ['s0', 's1', 's2', 'f'].map((id) => ({ id, name: id })),
    transitions: [
      { from: 's0', to: 's1', event: 'a' }, { from: 's0', to: 's2', event: 'b' },
      { from: 's1', to: 'f', event: 'x' }, { from: 's2', to: 'f', event: 'x' },
    ],
    acceptingStates: ['f'],
  });
  const before = m.serialize();
  const r = m.minimize();
  assert.equal(r.originalStateCount, 4);
  assert.equal(r.minimizedStateCount, 3);
  assert.equal(r.reduction, 25);
  assert.equal(r.equivalentStates.get('s1'), r.equivalentStates.get('s2'));
  assert.notEqual(r.equivalentStates.get('s0'), r.equivalentStates.get('f'));
  assert.equal([...r.equivalentStates.keys()].length, 4, 'every original state is mapped');
  assert.equal(m.serialize(), before, 'minimize() must not mutate the machine');
});

test('minimize() keeps states apart when their metadata differs (metadata drives CSS/ARIA output)', () => {
  const states = [{ id: 's0', name: 's0' }, { id: 's1', name: 's1', metadata: { aria: 'busy' } }, { id: 's2', name: 's2', metadata: { aria: 'idle' } }, { id: 'f', name: 'f' }];
  const m = createStateMachine({ initialState: 's0', states, transitions: [{ from: 's0', to: 's1', event: 'a' }, { from: 's0', to: 's2', event: 'b' }, { from: 's1', to: 'f', event: 'x' }, { from: 's2', to: 'f', event: 'x' }], acceptingStates: ['f'] });
  assert.equal(m.minimize().minimizedStateCount, 4);
});

test('minimize() refuses machines it cannot minimize soundly instead of guessing', () => {
  assert.throws(() => createStateMachine({ ...traffic(), automatonType: 'NFA' }).minimize(), RangeError);
  const withHook = traffic(); withHook.states[0].onEnter = () => {};
  assert.throws(() => createStateMachine(withHook).minimize(), /observable/);
});

test('serialize() is JSON that records structure and marks functions as booleans', () => {
  const m = createStateMachine({ initialState: 'a', states: [{ id: 'a', name: 'A', onEnter() {} }, { id: 'b', name: 'B' }], transitions: [{ from: 'a', to: 'b', event: 'go', guard: () => true }] });
  const doc = JSON.parse(m.serialize());
  assert.equal(doc.initialState, 'a');
  assert.equal(doc.states[0].hasOnEnter, true);
  assert.equal(doc.transitions[0].guarded, true);
});

test('merge() returns a new machine with the union of states and transitions; conflicts throw', () => {
  const a = createStateMachine({ initialState: 'a', states: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], transitions: [{ from: 'a', to: 'b', event: 'go' }], acceptingStates: ['b'] });
  const b = createStateMachine({ initialState: 'b', states: [{ id: 'b', name: 'B' }, { id: 'c', name: 'C' }], transitions: [{ from: 'b', to: 'c', event: 'next' }], acceptingStates: ['c'] });
  const merged = a.merge(b);
  assert.notEqual(merged, a);
  assert.deepEqual(merged.getStates().map((s) => s.id).sort(), ['a', 'b', 'c']);
  assert.equal(merged.transition('go'), true);
  assert.equal(merged.transition('next'), true);
  assert.equal(merged.isAccepting(), true);
  assert.equal(a.getCurrentState().id, 'a', 'merge must not change the original');
  const conflicting = createStateMachine({ initialState: 'a', states: [{ id: 'a', name: 'A' }, { id: 'c', name: 'C' }], transitions: [{ from: 'a', to: 'c', event: 'go' }] });
  assert.throws(() => a.merge(conflicting), /goes to/);
  assert.throws(() => a.merge({}), TypeError);
});
