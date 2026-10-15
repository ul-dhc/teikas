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

export const TRACE_DRAW_MS = 2200;
export const TRACE_REST_MS = 550;

// One small, separate source is updated per stroke, never the entire network per
// frame. Hidden tabs and map interactions pause the clock without catching up.
export function createNetworkTrace({ show, progress, complete, finish = () => {}, requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame }) {
  let steps = [], index = 0, elapsed = 0, lastTime = null, lastPaint = null, frame = 0, running = false, shown = false;
  const tick = (time) => {
    frame = 0;
    if (!running || index >= steps.length) return;
    if (lastTime !== null) elapsed += Math.min(64, Math.max(0, time - lastTime));
    lastTime = time;
    const step = steps[index], wait = index === 0 ? 0 : step.componentStart ? 1000 : TRACE_REST_MS;
    if (elapsed >= wait) {
      if (!shown) { show(step); shown = true; }
      const t = Math.min(1, (elapsed - wait) / TRACE_DRAW_MS);
      if (lastPaint === null || time - lastPaint >= 32 || t === 1) {
        progress(t * t * (3 - 2 * t), step);
        lastPaint = time;
      }
      if (t === 1) {
        complete(step);
        index++;
        elapsed = 0;
        shown = false;
      }
    }
    if (index < steps.length) frame = requestFrame(tick);
    else { running = false; finish(); }
  };
  const pause = () => {
    running = false;
    if (frame) cancelFrame(frame);
    frame = 0;
    lastTime = null;
  };
  return {
    reset(edges) { pause(); steps = orderNetworkTrace(edges); index = 0; elapsed = 0; lastPaint = null; shown = false; },
    pause,
    resume() {
      if (running || index >= steps.length) return;
      running = true;
      lastTime = null;
      frame = requestFrame(tick);
    },
  };
}
