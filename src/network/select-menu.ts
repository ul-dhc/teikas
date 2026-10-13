// Keep the native select as the form/state source; render its menu with site tokens.
let opened: { select: HTMLSelectElement; trigger: HTMLButtonElement; menu: HTMLElement; active: number; input?: HTMLInputElement } | null = null;
let serial = 0;
let search = '', searchAt = 0;
const labels = new WeakMap<HTMLSelectElement, HTMLButtonElement>();
function close(restore = false) {
  if (!opened) return;
  const { trigger, menu } = opened;
  opened = null;
  menu.remove();
  trigger.setAttribute('aria-expanded', 'false');
  trigger.removeAttribute('aria-activedescendant');
  if (restore && trigger.isConnected) trigger.focus({ preventScroll: true });
}
function highlight(index: number, scroll = true) {
  if (!opened) return;
  const { select, trigger, menu, input } = opened;
  const item = menu.querySelector<HTMLElement>(`[data-select-option="${index}"]`);
  if (!item || item.hidden || select.options[index]?.disabled) return;
  opened.active = index;
  menu.querySelectorAll<HTMLElement>('[role="option"]').forEach(option => option.classList.toggle('is-highlighted', Number(option.dataset.selectOption) === index));
  trigger.setAttribute('aria-activedescendant', item.id);
  input?.setAttribute('aria-activedescendant', item.id);
  if (scroll) item.scrollIntoView({ block: 'nearest' });
}
function choose(index: number) {
  if (!opened || !opened.select.options[index] || opened.select.options[index].disabled) return;
  const { select } = opened;
  close();
  select.selectedIndex = index;
  const trigger = labels.get(select)!;
  trigger.querySelector('span')!.textContent = select.selectedOptions[0]?.textContent || '';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  // Dashboard changes rebuild the controls, so focus the new equivalent trigger.
  const replacement = select.id ? document.getElementById(select.id) as HTMLSelectElement :
    document.querySelector<HTMLSelectElement>(select.dataset.networkSetting ? `[data-network-setting="${select.dataset.networkSetting}"]` : `[data-network-filter="${select.dataset.networkFilter}"]`);
  (labels.get(replacement || select) || trigger).focus({ preventScroll: true });
}
function open(select: HTMLSelectElement, trigger: HTMLButtonElement) {
  close(); search = '';
  const menu = document.createElement('div');
  menu.className = 'ml-select-menu';
  const list = document.createElement('div'); list.className = 'ml-select-options';
  list.id = trigger.getAttribute('aria-controls')!;
  list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', trigger.getAttribute('aria-label')!);
  let input: HTMLInputElement | undefined;
  let empty: HTMLElement | undefined;
  if (select.hasAttribute('data-network-filter')) {
    const l=document.documentElement.dataset.uiLang;const strings=l==='de'?{search:'Suchen',empty:'Keine Treffer'}:l==='en'?{search:'Search',empty:'No matches'}:{search:'Meklēt',empty:'Nav rezultātu'};
    const heading = document.createElement('div'); heading.className = 'ml-select-search';
    input = document.createElement('input'); input.type = 'search'; input.autocomplete = 'off'; input.spellcheck = false;
    input.placeholder = strings.search+'…';
    input.setAttribute('aria-label', `${strings.search} ${trigger.getAttribute('aria-label')!.toLocaleLowerCase()}`);
    input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'true'); input.setAttribute('aria-controls', list.id);
    heading.append(input); menu.append(heading);
    empty = document.createElement('p'); empty.className = 'ml-select-empty'; empty.setAttribute('role', 'status'); empty.hidden = true;
    empty.textContent = strings.empty;
  }
  menu.append(list);
  [...select.options].forEach((option, index) => {
    const item = document.createElement('button');
    item.type = 'button'; item.tabIndex = -1; item.id = `${list.id}-${index}`; item.dataset.selectOption = String(index);
    item.setAttribute('role', 'option'); item.setAttribute('aria-selected', String(option.selected));
    item.disabled = option.disabled;
    const text = document.createElement('span'); text.textContent = option.textContent;
    const icon = document.createElement('i'); icon.dataset.lucide = 'check';
    item.append(icon, text); list.append(item);
    item.addEventListener('pointerdown', event => event.preventDefault());
    item.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); choose(index); });
    item.addEventListener('pointermove', () => highlight(index));
  });
  if (empty) menu.append(empty);
  if (input) {
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/ø/g, 'o').replace(/æ/g, 'ae');
    input.addEventListener('input', () => {
      if (!opened || opened.menu !== menu) return;
      const words = normalize(input!.value).trim().split(/\s+/).filter(Boolean);
      const matches: number[] = [];
      list.querySelectorAll<HTMLElement>('[role="option"]').forEach(item => {
        const index = Number(item.dataset.selectOption);
        item.hidden = !words.every(word => normalize(select.options[index].textContent || '').includes(word));
        if (!item.hidden && !select.options[index].disabled) matches.push(index);
      });
      empty!.hidden = matches.length > 0; menu.scrollTop = 0;
      opened.active = -1; trigger.removeAttribute('aria-activedescendant'); input!.removeAttribute('aria-activedescendant');
      list.querySelectorAll('.is-highlighted').forEach(item => item.classList.remove('is-highlighted'));
      if (matches.length) highlight(matches[0], false);
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
      if (event.key === 'Tab') { close(true); return; }
      if (event.key === 'Enter') { event.preventDefault(); if (opened) choose(opened.active); return; }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const indices = [...list.querySelectorAll<HTMLElement>('[role="option"]')].filter(item => !item.hidden && !select.options[Number(item.dataset.selectOption)].disabled).map(item => Number(item.dataset.selectOption));
      const active = indices.indexOf(opened?.active ?? -1);
      const next = Math.max(0, Math.min(indices.length - 1, active + (event.key === 'ArrowDown' ? 1 : -1)));
      if (indices[next] !== undefined) highlight(indices[next]);
    });
  }
  const theme = getComputedStyle(trigger);
  ['--chart-card', '--raised', '--line', '--ink', '--muted', '--action-fill', '--action-ink', '--blue'].forEach(token => menu.style.setProperty(token, theme.getPropertyValue(token)));
  document.body.append(menu);
  const rect = trigger.getBoundingClientRect(), gap = 6;
  const width = Math.min(Math.max(rect.width, 230), innerWidth - 20);
  menu.style.width = `${width}px`;
  menu.style.left = `${Math.max(10, Math.min(rect.left, innerWidth - width - 10))}px`;
  const below = innerHeight - rect.bottom - gap - 10, above = rect.top - gap - 10;
  const upward = below < 180 && above > below;
  menu.style.maxHeight = `${Math.max(80, Math.min(320, upward ? above : below))}px`;
  if (upward) menu.style.bottom = `${innerHeight - rect.top + gap}px`;
  else menu.style.top = `${rect.bottom + gap}px`;
  opened = { select, trigger, menu, active: select.selectedIndex, input };
  trigger.setAttribute('aria-expanded', 'true');
  window.dispatchEvent(new Event('lucide-refresh'));
  highlight(select.selectedIndex, false);
  input?.focus({ preventScroll: true });
}
export function enhanceSelects(root: HTMLElement) {
  if (opened && !opened.select.isConnected) close();
  root.querySelectorAll<HTMLSelectElement>('select').forEach(select => {
    if (labels.has(select)) return;
    const wrapper = document.createElement('span'); wrapper.className = 'ml-select';
    const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'ml-select-trigger';
    trigger.setAttribute('role', 'combobox'); trigger.setAttribute('aria-haspopup', 'listbox'); trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', `ml-select-menu-${++serial}`);
    const label = select.closest('label')?.cloneNode(true) as HTMLElement | undefined;
    label?.querySelectorAll('select, input, button').forEach(element => element.remove());
    trigger.setAttribute('aria-label', select.getAttribute('aria-label') || label?.textContent?.trim() || 'Select');
    const value = document.createElement('span'); value.textContent = select.selectedOptions[0]?.textContent || '';
    const icon = document.createElement('i'); icon.dataset.lucide = 'chevron-down'; trigger.append(value, icon);
    trigger.disabled = select.disabled;
    select.before(wrapper); wrapper.append(select, trigger);
    select.classList.add('ml-native-select'); select.tabIndex = -1; select.setAttribute('aria-hidden', 'true');
    labels.set(select, trigger);
    select.addEventListener('focus', () => trigger.focus({ preventScroll: true }));
    trigger.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); opened?.trigger === trigger ? close() : open(select, trigger); });
    trigger.addEventListener('keydown', event => {
      if (event.key === 'Tab') { close(); return; }
      if (event.key === 'Escape') { if (opened) { event.preventDefault(); event.stopPropagation(); close(true); } return; }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        if (!opened || opened.trigger !== trigger) { open(select, trigger); return; }
        if (event.key === 'Enter' || event.key === ' ') { choose(opened.active); return; }
        const direction = event.key === 'ArrowUp' || event.key === 'End' ? -1 : 1;
        let index = event.key === 'Home' ? 0 : event.key === 'End' ? select.options.length - 1 : opened.active + direction;
        while (select.options[index]?.disabled) index += direction;
        if (index >= 0 && index < select.options.length) highlight(index);
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault(); if (!opened || opened.trigger !== trigger) open(select, trigger);
        if (opened?.input) { opened.input.value += event.key; opened.input.dispatchEvent(new Event('input')); return; }
        search = Date.now() - searchAt > 700 ? event.key : search + event.key; searchAt = Date.now();
        const index = [...select.options].findIndex(option => !option.disabled && option.textContent?.toLocaleLowerCase().startsWith(search.toLocaleLowerCase()));
        if (index >= 0) highlight(index);
      }
    });
  });
}
document.addEventListener('pointerdown', event => {
  if (opened && !opened.menu.contains(event.target as Node) && !opened.trigger.contains(event.target as Node)) close();
});
window.addEventListener('resize', () => close());
document.addEventListener('scroll', event => { if (opened && !opened.menu.contains(event.target as Node)) close(); }, true);
