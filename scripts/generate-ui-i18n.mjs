import { readFile, writeFile } from 'node:fs/promises';

const source = new URL('../translations/ui-translations.csv', import.meta.url);
const target = new URL('../src/i18n/ui.json', import.meta.url);

function parseCsv(text) {
  const rows = [];
  let row = [], value = '', quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { value += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(value); value = ''; }
    else if (char === '\n') { row.push(value.replace(/\r$/, '')); rows.push(row); row = []; value = ''; }
    else value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

const rows = parseCsv(await readFile(source, 'utf8'));
const [header, ...records] = rows;
if (header?.join(',') !== 'key,lv,de,en') throw new Error('Expected CSV columns: key,lv,de,en');
let output = {};
try {
  output = JSON.parse(await readFile(target, 'utf8'));
} catch {
  // A fresh project may not have a generated fallback file yet.
}
for (const [key, lv, de, en] of records) {
  if (!key) continue;
  if (!lv || !de || !en) throw new Error(`Missing translation for ${key}`);
  output[key] = { lv, de, en };
}
await writeFile(target, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Generated ${Object.keys(output).length} interface translations.`);
