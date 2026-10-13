// Keep the established Teikas overview and the full network explorer independent.
// Each view loads its own styles so one dashboard cannot override the other.
const view = location.hash === '#network' ? 'network' : 'overview';
if (!location.hash) history.replaceState({}, '', location.pathname + location.search + '#overview');
const data = JSON.parse(document.getElementById('ml-data')!.textContent!);
const overview = JSON.parse(document.getElementById('overview-data')!.textContent!);
function tabUrl(target: string) {
  const params = new URLSearchParams(location.search);
  if (target !== view) {
    const chapter = params.get('type');
    if (chapter) {
      const source = (view === 'network' ? data.types : overview.types).find((type: any) => (view === 'network' ? type.code.replace(/\s/g, '') : type.id) === chapter);
      const destination = source && (target === 'network' ? data.types : overview.types).find((type: any) => type.records.some((record: any) => record.id === source.records[0]?.id));
      if (destination) params.set('type', target === 'network' ? destination.code.replace(/\s/g, '') : destination.id);
      else params.delete('type');
    }
    for (const field of ['county', 'collector', 'narrator']) {
      const value = params.get(field);
      if (!value) continue;
      const sourceRows = (view === 'network' ? data.types : overview.types).flatMap((type: any) => type.records);
      const source = sourceRows.find((record: any) => record[field] === value);
      const destination = source && (target === 'network' ? data.types : overview.types).flatMap((type: any) => type.records).find((record: any) => record.id === source.id);
      const mapped = destination?.[field];
      if (mapped) params.set(field, mapped);
    }
  }
  return location.pathname + (params.size ? '?' + params : '') + '#' + target;
}
// Reload only when switching renderers; ordinary filter changes stay interactive.
document.addEventListener('click', event => {
  const link = (event.target as Element).closest<HTMLAnchorElement>('a[data-data-view]');
  if (!link || (event as MouseEvent).metaKey || (event as MouseEvent).ctrlKey || (event as MouseEvent).shiftKey || (event as MouseEvent).altKey) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const target = link.dataset.dataView!;
  if (target !== view) { history.pushState({}, '', tabUrl(target)); location.reload(); }
}, true);
const reloadView = () => { if ((location.hash === '#network' ? 'network' : 'overview') !== view) location.reload(); };
window.addEventListener('popstate', reloadView);
window.addEventListener('hashchange', reloadView);
const updateTabs = () => {
  document.querySelectorAll<HTMLAnchorElement>('.data-overview-tabs a').forEach(link=>link.setAttribute('aria-current',link.dataset.dataView===view?'page':'false'));
  const lang = document.documentElement.dataset.uiLang;
  document.querySelector('[data-overview-tab]')!.textContent = lang === 'de' ? 'Übersicht' : lang === 'en' ? 'Overview' : 'Pārskats';
  document.querySelector('[data-network-tab]')!.textContent = lang === 'de' ? 'Netzwerk' : lang === 'en' ? 'Network' : 'Tīkls';
};
updateTabs(); window.addEventListener('ui-language-change', updateTabs);
async function start() {
  const style = document.createElement('style');
  if (view === 'network') {
    style.textContent = (await import('../network/style.css?inline')).default;
    document.head.append(style);
    await import('../network/main');
  } else {
    const [overviewStyle, explorationStyle] = await Promise.all([import('../ml-index/style.css?inline'), import('../styles/exploration.css?inline')]);
    style.textContent = overviewStyle.default + '\n' + explorationStyle.default;
    document.head.append(style);
    document.querySelector<HTMLElement>('.data-overview-tabs')!.hidden = false;
    await import('../ml-index/data-main');
  }
}
void start();
