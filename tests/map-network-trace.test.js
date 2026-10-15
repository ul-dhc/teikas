import test from 'node:test';
import assert from 'node:assert/strict';
import {orderNetworkTrace, createNetworkTrace, TRACE_DRAW_MS} from '../src/map/network-trace.js';

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
  let callback, time = 0, progress = 0, finished = 0;
  const shown = [], completed = [];
  const trace = createNetworkTrace({
    show: step => shown.push(step.edge.id), progress: value => progress = value,
    complete: step => completed.push(step.edge.id),
    finish: () => finished++,
    requestFrame: fn => {callback = fn; return 1;}, cancelFrame: () => {callback = null;},
  });
  const tick = (delta = 16) => {time += delta; const fn = callback; callback = null; fn?.(time);};
  return {trace, tick, shown, completed, get finished() {return finished;}, get progress() {return progress;}, get scheduled() {return Boolean(callback);}};
}

test('strokes remain slow, pause without hidden-tab catch-up, and finish without looping', () => {
  const h = harness();
  h.trace.reset(edges.slice(0, 1)); h.trace.resume();
  h.tick();
  assert.deepEqual(h.shown, ['a'], 'Play begins drawing on the first frame');
  for (let i = 0; i < 60; i++) h.tick();
  assert.deepEqual(h.shown, ['a']);
  assert.ok(h.progress > 0 && h.progress < .5);
  const before = h.progress;
  h.trace.pause(); assert.equal(h.scheduled, false);
  h.tick(60000); h.trace.resume(); h.tick();
  assert.equal(h.progress, before);
  for (let i = 0; i < TRACE_DRAW_MS / 16 + 5; i++) h.tick();
  assert.deepEqual(h.completed, ['a']);
  assert.equal(h.scheduled, false);
  assert.equal(h.finished, 1, 'the button can switch to Replay when the drawing finishes');
  h.trace.resume(); h.tick(); assert.equal(h.finished, 1);
});

test('replacing a filtered graph cancels the previous stroke and an empty graph schedules no animation', () => {
  const h = harness(); h.trace.reset(edges); h.trace.resume();
  for (let i = 0; i < 100; i++) h.tick();
  h.trace.reset([edges[3]]); h.trace.resume();
  for (let i = 0; i < 220; i++) h.tick();
  assert.deepEqual(h.completed, ['d']);
  h.trace.reset([]); h.trace.resume(); assert.equal(h.scheduled, false);
});
