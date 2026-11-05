// Transient menus share dismissal rules; content disclosures are deliberately excluded.
const selector = 'details.multi-select,details.sort-menu,details.download-menu,details.page-size-menu,details.layer-menu,details.basemap-select,details.network-choice';
type Popover = { content: HTMLElement; trigger: HTMLElement; close: () => void };
const providers = new Set<() => Popover | null>();

export function registerPopover(provider: () => Popover | null) {
  providers.add(provider);
  return () => providers.delete(provider);
}

function opened(): Popover[] {
  const menus = [...document.querySelectorAll<HTMLDetailsElement>(selector)].filter(menu => menu.open).map(menu => ({
    content: menu,
    trigger: menu.querySelector<HTMLElement>(':scope > summary')!,
    close: () => { menu.open = false; },
  }));
  return [...menus, ...[...providers].map(provider => provider()).filter((menu): menu is Popover => menu !== null)];
}

export function dismissOtherPopovers(element: Element) {
  opened().forEach(menu => {
    if (!menu.content.contains(element) && !element.contains(menu.content) && !menu.trigger.contains(element)) menu.close();
  });
}

document.addEventListener('click', event => {
  const target = event.target as Node;
  opened().forEach(menu => {
    if (!menu.content.contains(target) && !menu.trigger.contains(target)) menu.close();
  });
}, true);

document.addEventListener('focusin', event => {
  const target = event.target as Node;
  opened().forEach(menu => {
    if (!menu.content.contains(target) && !menu.trigger.contains(target)) menu.close();
  });
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const menus = opened();
  const menu = [...menus].reverse().find(item => item.content.contains(event.target as Node) || item.trigger.contains(event.target as Node)) || menus.at(-1);
  if (!menu) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  menu.close();
  if (menu.trigger.isConnected) menu.trigger.focus({ preventScroll: true });
}, true);

document.addEventListener('toggle', event => {
  const menu = event.target;
  if (menu instanceof HTMLDetailsElement && menu.matches(selector) && menu.open) dismissOtherPopovers(menu);
}, true);
