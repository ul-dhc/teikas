// Collection IDs encode a four-digit chapter and a six-digit subsection.
export const sectionScope = (value: string | null) => value && /^\d{6}$/.test(value) ? value : '';
export function scopeRecordsToSection<T extends {id: string}>(records: T[], section: string): T[] {
  return section ? records.filter(record => record.id.startsWith(section)) : records;
}
