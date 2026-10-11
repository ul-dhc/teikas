import raw from '../data/map-data.json';
import {legendsById, legendYear} from '../lib/data';
import type {MapDataset, LegendProperties} from './types';
// JSON cannot retain GeoJSON's literal discriminants or coordinate tuple types.
// The exploration tests verify source IDs, coordinates and the unlocated split.
const dataset = raw as unknown as MapDataset;
const enrich = (properties: LegendProperties): LegendProperties => {
 const legend = legendsById.get(properties.id);
 return {...properties,
  year: legend ? legendYear(legend) || null : properties.year,
  collectorId: properties.collector ? legend?.collectorId || '' : '',
  narratorId: properties.narrator ? legend?.narratorId || '' : '',
  county: properties.placeName, genre: '',
  translation: legend?.text.de ? 'translated' : 'latvian-only',
 };
};
export const mapData: MapDataset = {
 ...dataset, networks: {},
 legends: {...dataset.legends, features: dataset.legends.features.map(feature => ({...feature, properties: enrich(feature.properties)}))},
 unmappedLegends: dataset.unmappedLegends.map(enrich),
};
