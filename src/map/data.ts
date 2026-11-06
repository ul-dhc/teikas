import raw from '../data/map-data.json';
import {legendsById, legendYear, collectorsById, narratorsById, displayPersonName} from '../lib/data';
import type {MapDataset, LegendProperties} from './types';
// JSON cannot retain GeoJSON's literal discriminants or coordinate tuple types.
// The exploration tests verify source IDs, coordinates and the unlocated split.
const dataset = raw as unknown as MapDataset;
const enrich = (properties: LegendProperties): LegendProperties => {
 const legend = legendsById.get(properties.id);
 return {...properties,
  collector: legend ? displayPersonName(collectorsById.get(legend.collectorId)) : properties.collector,
  narrator: legend?.narratorId ? displayPersonName(narratorsById.get(legend.narratorId)) : '',
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
