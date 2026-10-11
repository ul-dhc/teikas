// Nodes are recorded places only. Edges represent shared metadata, not travel.
export function buildMetadataNetwork(type, features) {
  if (!['plots', 'collectors'].includes(type)) return { nodes: [], edges: [], recordCount: 0 };
  const places = new Map(), categories = new Map(), labels = new Map();
  for (const feature of features) {
    const record = feature.properties, plot = record.themeLv?.trim() || '';
    const relationship = type === 'collectors' ? record.collectorId?.trim() : plot;
    if (!record.placeId || !relationship || !feature.geometry?.coordinates?.every(Number.isFinite)) continue;
    labels.set(relationship, type === 'collectors' ? record.collector?.trim() || relationship : plot);
    const id = `place:${record.placeId}`;
    let place = places.get(id);
    if (!place) {
      place = { id, kind: 'place', name: record.placeName, coordinates: [...feature.geometry.coordinates], ids: new Set(), themes: new Map(), collectors: new Map() };
      places.set(id, place);
    }
    if (place.ids.has(record.id)) continue;
    place.ids.add(record.id);
    if (plot) place.themes.set(plot, (place.themes.get(plot) || 0) + 1);
    if (record.collectorId) {
      const collector = place.collectors.get(record.collectorId) || { id: record.collectorId, name: record.collector || record.collectorId, count: 0 };
      collector.count++; place.collectors.set(record.collectorId, collector);
    }
    let category = categories.get(relationship);
    if (!category) { category = new Map(); categories.set(relationship, category); }
    const ids = category.get(id) || [];
    ids.push(record.id); category.set(id, ids);
  }
  const edges = new Map();
  for (const [relationship, category] of categories) {
    const entries = [...category].sort((a, b) => a[0].localeCompare(b[0]));
    for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
      const [fromId, fromRecords] = entries[i], [toId, toRecords] = entries[j], id = `${fromId}|${toId}`;
      let edge = edges.get(id);
      if (!edge) { edge = { id, fromId, toId, ids: new Set(), shared: [] }; edges.set(id, edge); }
      fromRecords.forEach(id => edge.ids.add(id)); toRecords.forEach(id => edge.ids.add(id));
      edge.shared.push({ plot: labels.get(relationship), key: relationship, from: fromRecords.length, to: toRecords.length, weight: fromRecords.length + toRecords.length });
    }
  }
  // Degree counts every unique attached connection in the full filtered graph.
  const connections = new Map();
  for (const edge of edges.values()) {
    for (const id of [edge.fromId, edge.toId]) connections.set(id, (connections.get(id) || 0) + 1);
  }
  return {
    nodes: [...places.values()].map(place => {
      const themes = [...place.themes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      return { id: place.id, kind: 'place', name: place.name, coordinates: place.coordinates, count: place.ids.size, connectionCount: connections.get(place.id) || 0, legendIds: [...place.ids], themes, plots: themes, plotCount: themes.length, dominantTheme: themes[0]?.[0] || '', collectors: [...place.collectors.values()].sort((a,b) => b.count-a.count || a.id.localeCompare(b.id)), illustrative: false, color: '' };
    }),
    edges: [...edges.values()].map(edge => ({ id: edge.id, fromId: edge.fromId, toId: edge.toId, count: edge.ids.size, legendIds: [...edge.ids], sharedCount: edge.shared.length, strongest: edge.shared.sort((a, b) => b.weight - a.weight || a.plot.localeCompare(b.plot)), coordinates: [places.get(edge.fromId).coordinates, places.get(edge.toId).coordinates] })),
    recordCount: new Set([...places.values()].flatMap(place => [...place.ids])).size,
  };
}

// Keep a readable overview without changing the underlying graph or exports.
export function strongestConnectionIds(edges) {
  const ranked = [...edges].sort((a, b) => b.sharedCount - a.sharedCount || b.count - a.count || a.id.localeCompare(b.id));
  const degrees = new Map(), used = new Map(), selected = new Set();
  for (const edge of edges) {
    for (const id of [edge.fromId, edge.toId]) degrees.set(id, (degrees.get(id) || 0) + 1);
  }
  for (const edge of ranked) {
    for (const id of [edge.fromId, edge.toId]) {
      const rank = used.get(id) || 0;
      if (rank < Math.ceil(degrees.get(id) * 0.1)) selected.add(edge.id);
      used.set(id, rank + 1);
    }
  }
  return selected;
}
