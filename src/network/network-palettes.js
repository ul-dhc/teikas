// Category order: place, collector, narrator, theme, volume, source.
// Keep the original IDs so saved views and shared links retain their palette.
export const paletteFields = ['county', 'collector', 'narrator', 'typeId', 'topic', 'place'];
export const networkPalettes = [
  // Purvs: the platform's ink blue, water, moss and muted gold.
  { id: 'sagn', name: 'Purvs', source: 'Teikas · platform colours',
    light: ['#164f78', '#43897d', '#7c769c', '#276f9e', '#ad8940', '#65738a'],
    dark: ['#9bb5d5', '#80b8aa', '#b3a8ce', '#88a8ce', '#cfad57', '#b1bfd0'] },
  // Krustceles: electric, highly saturated colours, luminous after dark.
  { id: 'nordlys', name: 'Krustceles', source: 'Teikas · neon',
    light: ['#7038ff', '#00bbd4', '#f020b8', '#72c900', '#ff7400', '#2460ff'],
    dark: ['#b08aff', '#29edff', '#ff58d6', '#b5ff39', '#ffab32', '#669aff'] },
  // Mežs: autumn leaves, berries, bark and olive foliage.
  { id: 'troll', name: 'Mežs', source: 'Teikas · autumn',
    bipartiteThread: { light: '#a65329', dark: '#e3a36c' },
    light: ['#c45323', '#85852d', '#9b354b', '#d49b28', '#79503a', '#b87735'],
    dark: ['#ee8b4b', '#b5bd59', '#dd788b', '#f1c75b', '#bd9273', '#e7ae68'] },
  // Krēsla: rose, mint, lilac and peach; deliberately soft in both themes.
  { id: 'huldra', name: 'Krēsla', source: 'Teikas · pastels',
    light: ['#dfa3b8', '#9ac9b3', '#b3a2d8', '#98bfe2', '#edbb98', '#d6ce98'],
    dark: ['#f0bbcf', '#b8e1cc', '#cebfed', '#bddaf3', '#f5d2b7', '#e9e1b5'] },
];
export function paletteVariables(id) {
  const palette = networkPalettes.find(item => item.id === id) || networkPalettes.find(item => item.id === 'troll');
  const variables = paletteFields.flatMap((field, index) => ['light', 'dark'].map(theme => `--network-${field}-${theme}:${palette[theme][index]}`));
  if (palette.bipartiteThread) for (const theme of ['light', 'dark']) variables.push(`--network-bipartite-thread-${theme}:${palette.bipartiteThread[theme]}`);
  return variables.join(';');
}
