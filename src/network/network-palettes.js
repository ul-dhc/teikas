// Category order: place, collector, narrator, theme, volume, source.
// Keep the original IDs so saved views and shared links retain their palette.
export const paletteFields = ['county', 'collector', 'narrator', 'typeId', 'topic', 'place'];
export const networkPalettes = [
  // Purvs in autumn: pool blue, moss green, amber orange, reed gold,
  // heather violet and bog-water teal, in category order.
  { id: 'sagn', name: 'Purvs', source: 'Teikas · autumn bog',
    light: ['#356b8c', '#657b2b', '#c46718', '#9c8009', '#86609d', '#218579'],
    dark: ['#6fb5d0', '#a9bf54', '#df7b2b', '#e8ca53', '#c294da', '#58c8b0'] },
  // Krustceles: electric, highly saturated colours, luminous after dark.
  { id: 'nordlys', name: 'Krustceles', source: 'Teikas · neon',
    light: ['#7038ff', '#00bbd4', '#f020b8', '#72c900', '#2460ff', '#00a880'],
    dark: ['#b08aff', '#29edff', '#ff58d6', '#b5ff39', '#669aff', '#42d8b4'] },
  // Mežs: lake blue (places), spruce (collectors), lingonberry (narrators),
  // cloudberry gold (themes), woodland violet (volumes), spring cyan (sources).
  // Distinct hue families keep overlapping categories recognisable in both themes.
  { id: 'troll', name: 'Mežs', source: 'Teikas · forest',
    bipartiteThread: { light: '#397c83', dark: '#86c8ce' },
    light: ['#345da8', '#19713e', '#ae3453', '#a77b08', '#7952ad', '#087f8c'],
    dark: ['#7ca9ef', '#60ba7d', '#ef8098', '#e9c558', '#b69aeb', '#53cbd3'] },
  // Krēsla: rose, mint, lilac and blue; deliberately soft in both themes.
  { id: 'huldra', name: 'Krēsla', source: 'Teikas · pastels',
    light: ['#dfa3b8', '#9ac9b3', '#b3a2d8', '#98bfe2', '#a4aedf', '#9fcdd3'],
    dark: ['#f0bbcf', '#b8e1cc', '#cebfed', '#bddaf3', '#c2caf3', '#bfe6eb'] },
];
export function paletteVariables(id) {
  const palette = networkPalettes.find(item => item.id === id) || networkPalettes.find(item => item.id === 'troll');
  const variables = paletteFields.flatMap((field, index) => ['light', 'dark'].map(theme => `--network-${field}-${theme}:${palette[theme][index]}`));
  if (palette.bipartiteThread) for (const theme of ['light', 'dark']) variables.push(`--network-bipartite-thread-${theme}:${palette.bipartiteThread[theme]}`);
  return variables.join(';');
}
