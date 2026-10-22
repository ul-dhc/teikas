import type { Legend } from './data';

export const normalizeThemeSearch = (value: string) => value.toLocaleLowerCase('lv').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
export function themeSearchTerms(value: string) {
  const terms: string[] = [];
  for (const match of value.matchAll(/"([^"]+)"|“([^”]+)”|(\S+)/g)) {
    const term = normalizeThemeSearch(match[1] || match[2] || match[3] || '');
    if (term && !terms.includes(term)) terms.push(term);
  }
  return terms;
}
export type ThemeSearchRecord = { id: string; text: string };
export function createThemeSearchRecord(legend: Legend, metadata: (string | null | undefined)[] = []): ThemeSearchRecord {
  return {id: legend.id, text: normalizeThemeSearch([
    legend.id, legend.volume, ...Object.values(legend.chapter), ...Object.values(legend.title), ...Object.values(legend.text),
    legend.originalMetadata, legend.comments, legend.notes, legend.primarySourceRaw, legend.secondarySourceRaw, ...metadata,
  ].filter(Boolean).join(' '))};
}
// Every term must match the same legend, never different records in one chapter.
export function searchThemeRecords(records: ThemeSearchRecord[], terms: string[]) {
  const sections = new Map<string, string[]>(), chapters = new Map<string, string[]>();
  let count = 0;
  for (const record of records) {
    if (!terms.every(term => record.text.includes(term))) continue;
    count++;
    for (const [groups, prefix] of [[sections, record.id.slice(0,6)], [chapters, record.id.slice(0,4)]] as const) {
      const ids = groups.get(prefix) || [];
      ids.push(record.id);
      groups.set(prefix, ids);
    }
  }
  return {sections, chapters, count};
}
