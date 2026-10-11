import {encodeSelection} from '../lib/selection.js';
export const UNKNOWN = '__unknown__';
export function flattenTypes(types) {
 return types.flatMap(type => type.records.map(record => ({...record, typeId:type.id, code:type.code, typeLv:type.lv, typeDe:type.de, topic:type.topic})));
}
export function selectRecords(records, scope = {}, filters = {}, skip = '') {
 return records.filter(record => {
  if (skip !== 'topic' && scope.topic && record.topic !== scope.topic) return false;
  if (skip !== 'topic' && skip !== 'type' && scope.type && record.typeId !== scope.type) return false;
  for (const field of ['county','collector','narrator']) {
   if (field !== skip && filters[field] && (record[field] || UNKNOWN) !== filters[field]) return false;
  }
  if (skip !== 'decade' && filters.decade) {
   if (filters.decade === 'undated') { if (record.year) return false; }
   else if (!record.year || Math.floor(Number(record.year)/10)*10 !== Number(filters.decade)) return false;
  }
  if (skip !== 'translation' && filters.translation && (record.translated ? 'translated' : 'original') !== filters.translation) return false;
  return true;
 });
}
export function countsBy(records, field) {
 const counts = new Map();
 for (const record of records) {
  const value = field === 'decade' ? (record.year ? String(Math.floor(Number(record.year)/10)*10) : 'undated') : field === 'translation' ? (record.translated ? 'translated' : 'original') : record[field] || UNKNOWN;
  counts.set(value,(counts.get(value)||0)+1);
 }
 return counts;
}
export function selectionLink(base, records) {
 // The explorer already supports explicit record selections. Preserve the exact
 // intersection, including unknown metadata and letter-suffixed ML types.
 return `${base}teksti/?selection=${encodeURIComponent(encodeSelection(records.map(record => record.id)))}`;
}
