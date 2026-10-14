import { test } from 'node:test';
import assert from 'node:assert/strict';
import { positionWithMotion, motionAmplitudeScale } from '../src/network/network-motion.js';
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

test('shrinking the view preserves visible drift and chaos movement without changing speed', () => {
  for (const mode of ['drift', 'chaos']) for (const t of [1000, 10000, 20000]) {
    const normal=positionWithMotion('legend:1',base,t,mode);
    const small=positionWithMotion('legend:1',base,t,mode,1,undefined,motionAmplitudeScale(.5));
    assert.ok(Math.abs((small.x-base.x)*.5-(normal.x-base.x))<.002);
    assert.ok(Math.abs((small.y-base.y)*.5-(normal.y-base.y))<.002);
  }
  assert.equal(motionAmplitudeScale(.1),2.5);
  assert.equal(motionAmplitudeScale(2),1);
  assert.equal(motionAmplitudeScale(0),1);
});
