import type { Legend } from './data';

export const normalizeSearch = (value: string) => value.toLocaleLowerCase('lv').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
export type SearchText = {lv: string; de: string; metadata?: string};
type SearchRecord = {id:string;volume:string;place:string;narrator:string;collector:string;year:string;titleLv:string;chapterLv:string;titleDe:string;chapterDe:string};
export function createSearchMetadata(legend: Legend, resolved: (string | null | undefined)[] = []) {
  return [legend.id, legend.volume, legend.originalMetadata, legend.comments, legend.notes, legend.primarySourceRaw, legend.secondarySourceRaw, ...resolved].filter(Boolean).join(' ');
}
export function matchesLegendSearch(record: SearchRecord, terms: string[], text: SearchText | undefined, mode: string) {
  if (!terms.length) return true;
  const common = [record.id, record.volume, record.place, record.narrator, record.collector, record.year, text?.metadata || ''].join(' ');
  const lv = `${record.titleLv} ${record.chapterLv} ${text?.lv || ''}`;
  const de = `${record.titleDe} ${record.chapterDe} ${text?.de || ''}`;
  const haystack = normalizeSearch(`${common} ${mode === 'lv' ? lv : mode === 'de' ? de : `${lv} ${de}`}`);
  return terms.every(term => haystack.includes(term));
}
