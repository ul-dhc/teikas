import { writeFile } from 'node:fs/promises';

const url = process.env.UI_TRANSLATIONS_CSV_URL?.trim();
if (!url) {
  throw new Error(
    'Missing UI_TRANSLATIONS_CSV_URL. Add the published Google Sheets CSV URL as a GitHub Actions repository variable.',
  );
}

let response;
try {
  response = await fetch(url, { redirect: 'follow' });
} catch (error) {
  throw new Error(`Could not download interface translations: ${error.message}`);
}

if (!response.ok) {
  throw new Error(`Could not download interface translations: HTTP ${response.status}`);
}

const csv = (await response.text()).replace(/^\uFEFF/, '');
const firstLine = csv.split(/\r?\n/, 1)[0]?.replaceAll('"', '');
if (firstLine !== 'key,lv,de,en') {
  throw new Error('Google Sheets CSV must have these columns in the first row: key, lv, de, en');
}

const target = new URL('../translations/ui-translations.csv', import.meta.url);
await writeFile(target, csv.endsWith('\n') ? csv : `${csv}\n`);
console.log('Downloaded interface translations from Google Sheets.');
