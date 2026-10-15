import test from 'node:test';
import assert from 'node:assert/strict';
import {orderNetworkTrace, createNetworkTrace, networkTracePlan, partialTraceCoordinates, NETWORK_FILL_MS} from '../src/map/network-trace.js';

const edge = (id, fromId, toId, sharedCount) => ({id, fromId, toId, sharedCount, coordinates: [[Number(fromId), 0], [Number(toId), 1]]});
const edges = [edge('a', '1', '2', 10), edge('b', '3', '2', 8), edge('c', '1', '3', 2), edge('d', '4', '5', 1)];

test('trace follows genuine connections strongest first and covers every disconnected component once', () => {
  const original = structuredClone(edges), ordered = orderNetworkTrace(edges);
  assert.deepEqual(ordered.map(step => step.edge.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(ordered[1].coordinates, [...edges[1].coordinates].reverse());
  assert.deepEqual(ordered.map(step => step.componentStart), [true, false, false, true]);
  assert.deepEqual(orderNetworkTrace([...edges].reverse()), ordered);
  assert.deepEqual(edges, original);
  assert.deepEqual(orderNetworkTrace([]), []);
});
test('equally strong connections start with a visible geographic span and skip coincident endpoints', () => {
  const short = edge('short', '1', '2', 2), long = edge('long', '1', '8', 2);
  const coincident = {...edge('same-point', '9', '10', 100), coordinates: [[25, 57], [25, 57]]};
  assert.deepEqual(orderNetworkTrace([short, coincident, long]).map(step => step.edge.id), ['long', 'short']);
});

function harness() {
  let callback, time = 0, active = [], finished = 0;
  const completed = [];
  const trace = createNetworkTrace({
    render: value => active = value, complete: step => completed.push(step.edge.id), finish: () => finished++,
    requestFrame: fn => {callback = fn; return 1;}, cancelFrame: () => {callback = null;},
  });
  const tick = (delta = 16) => {time += delta; const fn = callback; callback = null; fn?.(time);};
  return {trace, tick, completed, get active() {return active;}, get finished() {return finished;}, get scheduled() {return Boolean(callback);}};
}

test('the whole network fills within five seconds independently of edge count or dropped frames', () => {
  for (const count of [4, 1000]) {
    const graph = Array.from({length: count}, (_, i) => edge(String(i), String(i), String(i + 1), 1));
    const h = harness(); h.trace.reset(graph); h.trace.resume(); h.tick(0);
    h.tick(2500); assert.ok(h.completed.length < count); if (count > 4) assert.ok(h.active.length);
    h.tick(NETWORK_FILL_MS - 2500);
    assert.equal(h.completed.length, count); assert.equal(h.finished, 1); assert.equal(h.active.length, 0); assert.equal(h.scheduled, false);
    h.trace.resume(); h.tick(); assert.equal(h.finished, 1);
  }
});

test('selected-node strokes start at that node and finish together in one to two seconds according to distance', () => {
  const graph = [edge('short', '1', '2', 1), {...edge('long', '8', '1', 1), coordinates: [[8, 1], [1, 0]]}, edge('unrelated', '3', '4', 1)];
  const plan = networkTracePlan(graph, '1');
  assert.equal(plan.length, 2);
  assert.ok(plan[0].duration >= 1000 && plan[0].duration < plan[1].duration);
  assert.equal(plan[1].duration, 2000);
  for (const step of plan) {assert.equal(step.start, 0); assert.deepEqual(step.coordinates[0], [1, 0]);}
  const h = harness(); h.trace.reset(graph, '1'); h.trace.resume(); h.tick(0); h.tick(2000);
  assert.deepEqual(new Set(h.completed), new Set(['short', 'long'])); assert.equal(h.finished, 1);
});

test('partial geometry follows the actual projected path and retains its endpoints', () => {
  const [step] = networkTracePlan([{...edge('path', '1', '2', 1), coordinates: [[24, 56], [25, 57], [26, 57]]}]);
  const partial = partialTraceCoordinates(step, .7);
  assert.deepEqual(partial[0], [24, 56]); assert.ok(partial.at(-1)[0] < 26);
  assert.deepEqual(partialTraceCoordinates(step, 1), step.coordinates);
});

test('pause freezes the geometry and resumes without counting time in a hidden tab', () => {
  const h = harness(); h.trace.reset(edges); h.trace.resume(); h.tick(0); h.tick(400);
  const before = structuredClone(h.active); h.trace.pause(); assert.equal(h.scheduled, false);
  h.tick(60000); h.trace.resume(); h.tick(0); assert.deepEqual(h.active, before);
  h.tick(NETWORK_FILL_MS); assert.equal(h.completed.length, edges.length); assert.equal(h.finished, 1);
});

test('replacing a filtered graph cancels old strokes and an empty graph schedules no animation', () => {
  const h = harness(); h.trace.reset(edges); h.trace.resume(); h.tick(0); h.tick(400);
  h.trace.reset([edges[3]]); h.trace.resume(); h.tick(0); h.tick(1000);
  assert.deepEqual(h.completed, ['d']);
  h.trace.reset([]); h.trace.resume(); assert.equal(h.scheduled, false);
});
