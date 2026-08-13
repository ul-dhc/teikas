import { readFile, mkdir, writeFile } from 'node:fs/promises';

const source = new URL('../src/i18n/ui.json', import.meta.url);
const target = new URL('../translations/ui-translations.csv', import.meta.url);
const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
const translations = JSON.parse(await readFile(source, 'utf8'));
const rows = [['key', 'lv', 'de', 'en'], ...Object.entries(translations).map(([key, value]) => [key, value.lv, value.de, value.en])];
await mkdir(new URL('../translations/', import.meta.url), { recursive: true });
await writeFile(target, `${rows.map(row => row.map(quote).join(',')).join('\n')}\n`);
console.log(`Exported ${rows.length - 1} interface translations.`);
