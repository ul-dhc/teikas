import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatPersonName } from '../src/lib/person-names.js';
import { comparePersonNames, personSortName } from '../src/lib/person-name-order.js';
import { buildProfiles, matchPerson } from '../src/persons/model.js';

test('person profiles search both name orders and retain place matches', () => {
  const records = [{id:'1',collectorId:'collector-0650',placeId:'place-1',place:'Smiltene',chapterLv:'Velni'}];
  const [profile] = buildProfiles([{id:'collector-0650',fullname:'Hugo Skujiņš (Andrs Ziemelis)',sortname:'Skujiņš, Hugo (Andrs Ziemelis)'}], records);
  const byId = new Map(records.map(record => [record.id, record]));
  for (const query of ['Hugo Skujiņš', 'Skujiņš, Hugo', 'smiltene']) {
    assert.deepEqual(matchPerson(profile, byId, query).records.map(record => record.id), ['1']);
  }
  assert.equal(profile.sortName, 'Skujiņš, Hugo (Andrs Ziemelis)');
  assert.equal(matchPerson(profile, byId, 'Rīga').records.length, 0);
});

test('display names preserve aliases, relatives and uncertain attributions', () => {
  for (const [source, display] of [
    ['Skujiņš, Hugo (Andrs Ziemelis)', 'Hugo Skujiņš (Andrs Ziemelis)'],
    ['Alksnis, Kristaps (Naudižnieks, Zundulis)', 'Kristaps Alksnis (Naudižnieks, Zundulis)'],
    ['Ābols, Jānis, Pēteris', 'Ābols, Jānis, Pēteris'],
    ['Laicēns, K. A.', 'K. A. Laicēns'],
    ['Jākobsona, Vernera vectēvs', 'Vernera Jākobsona vectēvs'],
    ['Auniņas, Emīlijas vecāmāte', 'Emīlijas Auniņas vecāmāte'],
    ['Bankera, K. tēvs', 'K. Bankera tēvs'],
    ['Rancāna, Nikodema skolnieks', 'Nikodema Rancāna skolnieks'],
    ['Vectēvs', 'Vectēvs'], ['Riņģa tēvs', 'Riņģa tēvs'],
    ['B., M.', 'B., M.'], ['V-ņš, S.', 'V-ņš, S.'],
    ['Freibergs, Mag.', 'Freibergs, Mag.'],
    ['Pumpurs, Lejaslauka', 'Pumpurs, Lejaslauka'],
  ]) assert.equal(formatPersonName(source), display, source);
});

test('all source names retain their spelling and surname ordering', () => {
  for (const file of ['collectors', 'narrators']) {
    const people = JSON.parse(readFileSync(new URL(`../teikas_json/${file}.json`, import.meta.url), 'utf8'));
    for (const person of people) {
      const display = formatPersonName(person.fullName);
      assert.equal(personSortName(display), person.fullName, person.id);
      const words = value => value.replace(/,/g, '').split(/\s+/).sort();
      assert.deepEqual(words(display), words(person.fullName), person.id);
      assert.equal(formatPersonName(display), display, person.id);
    }
    const originalOrder = [...people].sort((a, b) => a.fullName.localeCompare(b.fullName, 'lv', { numeric: true })).map(p => p.id);
    const displayOrder = [...people].sort((a, b) => comparePersonNames(formatPersonName(a.fullName), formatPersonName(b.fullName))).map(p => p.id);
    assert.deepEqual(displayOrder, originalOrder);
  }
});
