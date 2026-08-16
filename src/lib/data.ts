import legendsRaw from '../../teikas_json/legends.json';
import collectorsRaw from '../../teikas_json/collectors.json';
import narratorsRaw from '../../teikas_json/narrators.json';
import placesRaw from '../../teikas_json/places.json';
import sourcesRaw from '../../teikas_json/sources.json';
import linksRaw from '../../teikas_json/legend-sources.json';
import manifestRaw from '../../teikas_json/dataset-manifest.json';

export type Localized = { lv: string | null; de: string | null };
export type Legend = {
  id: string; volume: string; chapter: Localized; title: Localized; text: Localized;
  collectorId: string; narratorId: string | null; placeId: string | null;
  originalMetadata: string | null; comments: string | null; notes: string | null;
  originalCoordinates: { latitude: number; longitude: number } | null;
  primarySourceRaw: string | null; secondarySourceRaw: string | null;
};
type Person = { id: string; fullName: string; gender: string | null; notes: string | null; legendCount: number };
type Place = { id: string; name: string; coordinates: { latitude: number; longitude: number } | null; coordinateStatus: string | null; coordinateVariantsRaw: string | null; notes: string | null; legendCount: number };
type Source = { id: string; code: string | null; title: string | null; authorsRaw: string | null; category: string | null; categoryOriginal: string | null; year: string | null; publisher: string | null; publicationPlace: string | null; url: string | null; originalLabel: string | null; notes: string | null; relationCount: number };
type LegendSource = { id: string; legendId: string; sourceId: string; role: string; rawCitation: string | null; mappingStatus: string | null; notes: string | null };

function indexById<T extends { id: string }>(records: T[], label: string): Map<string, T> {
  const map = new Map<string, T>();
  for (const record of records) {
    if (typeof record.id !== 'string' || !record.id || map.has(record.id)) throw new Error(`Invalid or duplicate ${label} ID: ${record.id}`);
    map.set(record.id, record);
  }
  return map;
}

export const legends = legendsRaw as Legend[];
export const collectors = collectorsRaw as Person[];
export const narrators = narratorsRaw as Person[];
export const places = placesRaw as Place[];
export const sources = sourcesRaw as Source[];
export const legendSources = linksRaw as LegendSource[];
export const manifest = manifestRaw;

export const legendsById = indexById(legends, 'legend');
export const collectorsById = indexById(collectors, 'collector');
export const narratorsById = indexById(narrators, 'narrator');
export const placesById = indexById(places, 'place');
export const sourcesById = indexById(sources, 'source');

const linksByLegend = new Map<string, LegendSource[]>();
for (const link of legendSources) {
  if (!legendsById.has(link.legendId) || !sourcesById.has(link.sourceId)) throw new Error(`Broken source relation: ${link.id}`);
  const list = linksByLegend.get(link.legendId) ?? [];
  list.push(link);
  linksByLegend.set(link.legendId, list);
}

export function resolveLegend(legend: Legend) {
  const relations = (linksByLegend.get(legend.id) ?? []).map((relation) => ({ relation, source: sourcesById.get(relation.sourceId)! }));
  return {
    legend,
    collector: collectorsById.get(legend.collectorId) ?? null,
    narrator: legend.narratorId ? narratorsById.get(legend.narratorId) ?? null : null,
    place: legend.placeId ? placesById.get(legend.placeId) ?? null : null,
    primarySources: relations.filter(({ relation }) => relation.role === 'primary'),
    secondarySources: relations.filter(({ relation }) => relation.role !== 'primary'),
  };
}

export function sourceLabel(source: Source): string {
  return [source.authorsRaw, source.title, source.publicationPlace, source.publisher, source.year].filter(Boolean).join('. ') || source.originalLabel || source.code || 'Nav norādīts';
}

export function legendYear(legend: Legend): string {
  const match = legend.originalMetadata?.match(/\b(1[6-9]\d{2}|20\d{2})\b/);
  if (match) return match[1];
  const relation = (linksByLegend.get(legend.id) ?? []).map(link => sourcesById.get(link.sourceId)).find(source => source?.year);
  return relation?.year ?? '';
}

export function displayPersonName(person: Person | null | undefined): string {
  const name = person?.fullName?.trim() ?? '';
  return /^(nezināms|unknown|unbekannt)$/iu.test(name) ? '' : name;
}

function excerpt(value: string | null, length = 420): string {
  if (!value) return '';
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > length ? `${clean.slice(0, length).trimEnd()}…` : clean;
}

export const browseRecords = legends.map((legend) => ({
  id: legend.id, volume: legend.volume, chapterLv: legend.chapter.lv ?? '', chapterDe: legend.chapter.de ?? '',
  placeId: legend.placeId ?? '',
  titleLv: legend.title.lv ?? '', titleDe: legend.title.de ?? '', place: legend.placeId ? placesById.get(legend.placeId)?.name ?? '' : '',
  collector: displayPersonName(collectorsById.get(legend.collectorId)), narrator: legend.narratorId ? displayPersonName(narratorsById.get(legend.narratorId)) : '',
  year: legendYear(legend), excerptLv: excerpt(legend.text.lv), excerptDe: excerpt(legend.text.de),
}));

export const volumes = [...new Set(legends.map((legend) => legend.volume))].sort((a, b) => a.localeCompare(b, 'lv', { numeric: true }));
export const chapters = [...new Set(legends.map((legend) => legend.chapter.lv).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'lv'));
