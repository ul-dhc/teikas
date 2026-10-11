import type { Map as MapLibreMap } from 'maplibre-gl';

// Place circles and place groups encode geographic uncertainty; individual legend circles stay native and solid.
// Circle layers have no dashed stroke property. Repaint their existing borders
// at the same screen position, size and colour; keep native hit targets intact.
const circleLayers = new Set(['point-place-centers', 'network-nodes', 'clusters']);
export function expressionValue(value: any, feature: any, zoom: number, state: any = {}): any {
  if (!Array.isArray(value)) return value;
  const [op, ...args] = value, read = (x: any) => expressionValue(x, feature, zoom, state);
  if (op === 'get') return feature.properties?.[args[0]];
  if (op === 'feature-state') return state[args[0]];
  if (op === 'zoom') return zoom;
  if (op === 'literal') return args[0];
  if (op === 'boolean') return typeof read(args[0]) === 'boolean' ? read(args[0]) : args[1];
  if (op === 'coalesce') return args.map(read).find(x => x != null);
  if (op === 'case') { for (let i = 0; i < args.length - 1; i += 2) if (read(args[i])) return read(args[i + 1]); return read(args.at(-1)); }
  if (op === 'match') { const x = read(args[0]); for (let i = 1; i < args.length - 1; i += 2) if (Array.isArray(args[i]) ? args[i].includes(x) : args[i] === x) return read(args[i + 1]); return read(args.at(-1)); }
  if (op === 'interpolate') {
    const x = Number(read(args[1])), stops = args.slice(2);
    if (x <= stops[0]) return read(stops[1]);
    for (let i = 2; i < stops.length; i += 2) if (x <= stops[i]) {
      const share = (x - stops[i - 2]) / (stops[i] - stops[i - 2]);
      return Number(read(stops[i - 1])) * (1 - share) + Number(read(stops[i + 1])) * share;
    }
    return read(stops.at(-1));
  }
  if (op === 'step') { const x = read(args[0]); let result = read(args[1]); for (let i = 2; i < args.length; i += 2) if (x >= args[i]) result = read(args[i + 1]); return result; }
  const values = args.map(read);
  if (op === 'min') return Math.min(...values);
  if (op === 'max') return Math.max(...values);
  if (op === 'sqrt') return Math.sqrt(values[0]);
  if (op === '*') return values.reduce((a, b) => a * b, 1);
  if (op === '+') return values.reduce((a, b) => a + b, 0);
  if (op === '-') return values[0] - values[1];
  if (op === '/') return values[0] / values[1];
  if (op === '==') return values[0] === values[1];
  if (op === '!=') return values[0] !== values[1];
  if (op === '>') return values[0] > values[1];
  if (op === 'in') return values[1]?.includes(values[0]);
  if (op === 'any') return values.some(Boolean);
  if (op === 'all') return values.every(Boolean);
  if (op === '!') return !values[0];
  return undefined;
}
export function installUncertaintyStrokes(map: MapLibreMap, enabled: () => boolean, isUncertain: (feature: any) => boolean) {
  const canvas = document.createElement('canvas');
  canvas.className = 'uncertainty-strokes';
  canvas.setAttribute('aria-hidden', 'true');
  map.getContainer().append(canvas);
  const context = canvas.getContext('2d')!, widths = new Map<string, any>(), hidden = new Set<string>();
  const setPaint = map.setPaintProperty.bind(map);
  map.setPaintProperty = ((id: string, property: string, value: any, options?: any) => {
    if (circleLayers.has(id) && property === 'circle-stroke-width') {
      widths.set(id, value);
      if (enabled()) { hidden.add(id); return setPaint(id, property, 0, options); }
    }
    return setPaint(id, property, value, options);
  }) as typeof map.setPaintProperty;
  const draw = () => {
    const viewport = map.getContainer(), ratio = devicePixelRatio || 1;
    const width = viewport.clientWidth, height = viewport.clientHeight;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, width, height);
    for (const id of circleLayers) {
      if (!map.getLayer(id)) continue;
      if (enabled()) {
        if (!hidden.has(id)) { widths.set(id, map.getPaintProperty(id, 'circle-stroke-width') ?? 0); hidden.add(id); setPaint(id, 'circle-stroke-width', 0); }
      } else if (hidden.has(id)) { hidden.delete(id); setPaint(id, 'circle-stroke-width', widths.get(id)); }
    }
    canvas.hidden = !enabled();
    if (!enabled()) { canvas.dataset.dashedCount = "0"; return; }
    const layers = [...circleLayers].filter(id => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none');
    if (!layers.length) { canvas.dataset.dashedCount = "0"; return; }
    const features = map.queryRenderedFeatures({layers}), seen = new Set<string>();
    let dashed = 0;
    for (const feature of features) {
      if (feature.geometry.type !== 'Point') continue;
      const layer = feature.layer.id, key = layer + ':' + feature.id + ':' + JSON.stringify(feature.geometry.coordinates);
      if (seen.has(key)) continue; seen.add(key);
      const state = feature.id == null ? {} : map.getFeatureState({source:feature.source, id:feature.id});
      const read = (property: string, fallback: any) => expressionValue(map.getPaintProperty(layer, property) ?? fallback, feature, map.getZoom(), state);
      const strokeWidth = expressionValue(widths.get(layer), feature, map.getZoom(), state);
      const radius = Number(read('circle-radius', 0)), opacity = Number(read('circle-stroke-opacity', 1)), colour = read('circle-stroke-color', 'transparent');
      if (!Number.isFinite(radius) || !Number.isFinite(strokeWidth) || strokeWidth <= 0 || opacity <= 0 || typeof colour !== 'string') continue;
      const point = map.project(feature.geometry.coordinates as [number,number]), uncertain = isUncertain(feature);
      context.globalAlpha = Math.min(1, opacity); context.strokeStyle = colour; context.lineWidth = strokeWidth;
      context.setLineDash(uncertain ? [Math.max(1.5, strokeWidth * 2), Math.max(1.5, strokeWidth * 2)] : []);
      context.beginPath(); context.arc(point.x, point.y, radius + strokeWidth / 2, 0, Math.PI * 2); context.stroke();
      if (uncertain) dashed++;
    }
    canvas.dataset.dashedCount = String(dashed);
  };
  map.on('render', draw);
  return () => { draw(); map.triggerRepaint(); };
}
