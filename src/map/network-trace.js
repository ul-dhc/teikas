// Follow real connections, strongest first. A depth-first walk keeps consecutive
// strokes attached to an already reached place; disconnected components start last.
export function orderNetworkTrace(edges) {
  // Equal-strength links with a longer geographic span are easier to see first.
  // Coincident places remain in the analytical graph but have no line to draw.
  const lengths = new Map(edges.map(edge => [edge.id, edge.coordinates.slice(1).reduce((sum, point, i) => sum + Math.hypot(point[0] - edge.coordinates[i][0], point[1] - edge.coordinates[i][1]), 0)]));
  const ranked = edges.filter(edge => lengths.get(edge.id) > 0).sort((a, b) => b.sharedCount - a.sharedCount || lengths.get(b.id) - lengths.get(a.id) || a.id.localeCompare(b.id));
  const adjacent = new Map();
  for (const edge of ranked) for (const id of [edge.fromId, edge.toId]) {
    if (!adjacent.has(id)) adjacent.set(id, []);
    adjacent.get(id).push(edge);
  }
  const used = new Set(), result = [], cursors = new Map();
  for (const seed of ranked) {
    if (used.has(seed.id)) continue;
    const stack = [seed.fromId];
    let first = true;
    while (stack.length) {
      const id = stack[stack.length - 1], neighbors = adjacent.get(id);
      let cursor = cursors.get(id) || 0;
      while (cursor < neighbors.length && used.has(neighbors[cursor].id)) cursor++;
      if (cursor >= neighbors.length) { stack.pop(); continue; }
      cursors.set(id, cursor + 1);
      const edge = neighbors[cursor];
      used.add(edge.id);
      result.push({ edge, coordinates: id === edge.fromId ? edge.coordinates : [...edge.coordinates].reverse(), componentStart: first });
      first = false;
      stack.push(id === edge.fromId ? edge.toId : edge.fromId);
    }
  }
  return result;
}

export const NETWORK_FILL_MS = 5000;

const project = ([x, latitude]) => [x, Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360)) * 180 / Math.PI];
const unproject = ([x, y]) => [x, (2 * Math.atan(Math.exp(y * Math.PI / 180)) - Math.PI / 2) * 180 / Math.PI];
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** @param {any[]} edges @param {string | null} [focusId] */
export function networkTracePlan(edges, focusId = null) {
  const ordered = focusId
    ? edges.filter(edge => edge.fromId === focusId || edge.toId === focusId).map(edge => ({edge, coordinates: edge.fromId === focusId ? edge.coordinates : [...edge.coordinates].reverse()}))
    : orderNetworkTrace(edges);
  const steps = ordered.map(step => {
    const projected = step.coordinates.map(project), cumulative = [0];
    for (let i = 1; i < projected.length; i++) cumulative.push(cumulative[i - 1] + distance(projected[i - 1], projected[i]));
    return {...step, projected, cumulative, length: cumulative[cumulative.length - 1]};
  }).filter(step => step.length > 0);
  const longest = Math.max(0, ...steps.map(step => step.length));
  return steps.map((step, index) => ({...step,
    start: focusId || steps.length === 1 ? 0 : index / (steps.length - 1) * 4000,
    duration: focusId ? 1000 + 1000 * step.length / longest : 1000,
  }));
}

export function partialTraceCoordinates(step, progress) {
  if (progress >= 1) return step.coordinates;
  const target = Math.max(0, progress) * step.length, coordinates = [step.coordinates[0]];
  for (let i = 1; i < step.projected.length; i++) {
    if (step.cumulative[i] < target) { coordinates.push(step.coordinates[i]); continue; }
    const span = step.cumulative[i] - step.cumulative[i - 1];
    const t = span ? (target - step.cumulative[i - 1]) / span : 0;
    const from = step.projected[i - 1], to = step.projected[i];
    coordinates.push(unproject([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]));
    return coordinates;
  }
  return step.coordinates;
}

// Stagger overlapping strokes over a fixed five-second timeline. Only growing
// geometry is sent to the small overlay source; completed edges use the base map.
export function createNetworkTrace({ render, complete, finish = () => {}, requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame }) {
  let steps = [], elapsed = 0, lastTime = null, lastPaint = null, frame = 0, running = false, finished = false;
  let completed = new Set();
  const tick = (time) => {
    frame = 0;
    if (!running || !steps.length || finished) return;
    if (lastTime !== null) elapsed += Math.max(0, time - lastTime);
    lastTime = time;
    const end = steps[steps.length - 1].end;
    if (lastPaint === null || time - lastPaint >= 32 || elapsed >= end) {
      const active = [];
      for (const step of steps) {
        const t = Math.min(1, Math.max(0, (elapsed - step.start) / step.duration));
        if (t === 1) {
          if (!completed.has(step.edge.id)) { completed.add(step.edge.id); complete(step); }
        } else if (elapsed >= step.start) {
          const eased = t * t * (3 - 2 * t);
          active.push({edge: step.edge, coordinates: partialTraceCoordinates(step, eased)});
        }
      }
      render(active);
      lastPaint = time;
    }
    if (elapsed < end) frame = requestFrame(tick);
    else { running = false; finished = true; finish(); }
  };
  const pause = () => {
    running = false;
    if (frame) cancelFrame(frame);
    frame = 0;
    lastTime = null;
  };
  return {
    /** @param {any[]} edges @param {string | null} [focusId] */
    reset(edges, focusId = null) {
      pause(); steps = networkTracePlan(edges, focusId).map(step => ({...step, end: step.start + step.duration}));
      // Focused strokes start together, so the longest duration determines the end.
      steps.sort((a, b) => a.end - b.end);
      elapsed = 0; lastPaint = null; completed = new Set(); finished = false;
    },
    pause,
    resume() {
      if (running || finished || !steps.length) return;
      running = true; lastTime = null; frame = requestFrame(tick);
    },
  };
}
