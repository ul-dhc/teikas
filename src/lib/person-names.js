/** Format a catalogue name without changing the source or its surname sort key. */
export function formatPersonName(value) {
  const name = value?.trim() ?? '';
  const match = /^([^,()]+),\s*([^,()]+?)(\s*\([^)]*\))?$/.exec(name);
  if (!match) return name;
  const [, surname, rest, alias = ''] = match;
  // Initial-only signatures, titles and an uncertain house-name attribution.
  if (/\.|\d/.test(surname) || surname === 'V-ņš' || rest === 'Mag.' || name === 'Pumpurs, Lejaslauka') return name;
  const relation = /^(.*?)\s+(māte|tēvs|vectēvs|vecāmāte|vecāki|skolnieks)$/.exec(rest);
  if (relation) return `${relation[1]} ${surname} ${relation[2]}${alias}`;
  return `${rest} ${surname}${alias}`;
}
