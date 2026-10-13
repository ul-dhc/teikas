import { test } from 'node:test';
import assert from 'node:assert/strict';
import { positionWithMotion } from '../src/network/network-motion.js';
const base = { x: 500, y: 320 };
test('movement is individual and consistent at every collection size', () => {
  for (const mode of ['drift', 'chaos', 'orbit']) {
    const a = positionWithMotion('legend:1', base, 10000, mode),
      b = positionWithMotion('legend:2', base, 10000, mode);
    assert.notDeepEqual(a, b);
    assert.notDeepEqual(a, positionWithMotion('legend:1', base, 20000, mode));
    assert.deepEqual(a, positionWithMotion('legend:1', base, 10000, mode));
  }
});
test('zero intensity remains at rest; Orbit depth stays positive and bounded', () => {
  for (const mode of ['drift', 'chaos', 'orbit'])
    assert.deepEqual(positionWithMotion('legend:1', base, 10000, mode, 0), {
      ...base,
      scale: 1,
      opacity: 1,
    });
  for (let t = 0; t < 120000; t += 1000) {
    const p = positionWithMotion('legend:1', base, t, 'orbit', 2);
    assert.ok(p.scale >= 0.18 && p.scale <= 2.25);
    assert.ok(p.opacity >= 0.26 && p.opacity <= 1);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  }
});
