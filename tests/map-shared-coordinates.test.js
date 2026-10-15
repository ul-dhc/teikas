import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pointCoordinateKey, placeProfileSelection, placeProfileMarkup} from '../src/map/place-profile.ts';
const dataset = JSON.parse(readFileSync(new URL('../src/data/map-data.json', import.meta.url), 'utf8'));
const records = dataset.legends.features.map(feature => feature.properties);
const groups = new Map();
for (const place of dataset.places.features) {
  const key = pointCoordinateKey(place.geometry.coordinates);
  const group = groups.get(key) || [];
  group.push(place.properties);
  groups.set(key, group);
}

test('Tukums flower and profile include all 54 legends while preserving 1, 1 and 52 subsets', () => {
  const names = ['Tukuma apkārtne', 'Tukuma apriņķis', 'Tukums'];
  const places = dataset.places.features.filter(place => names.includes(place.properties.name));
  assert.equal(places.length, 3);
  assert.equal(new Set(places.map(place => pointCoordinateKey(place.geometry.coordinates))).size, 1);
  const location = places.map(place => place.properties);
  for (const place of location) {
    const selection = placeProfileSelection(place.id, location, records, true);
    assert.equal(selection.records.length, 54);
    assert.deepEqual(selection.recordedPlaces.map(place => place.count).sort((a,b) => a-b), [1, 1, 52]);
    const href = '/teikas/teksti/?selection=' + selection.records.map(record => record.id).join(',');
    const markup = placeProfileMarkup({name: names.join(' / '), ...selection, grouped: true,
      recordedPlaces: selection.recordedPlaces.map(place => ({...place, href: '/teikas/teksti/?selection=' + place.legendIds.join(',')})),
      href, tone: '#aaa', tr: key => key, format: String, categoryColor: () => '#aaa', english: false});
    assert.ok(markup.includes(`href="${href}"`));
    assert.ok(!markup.includes('&amp;place='));
    for (const item of selection.recordedPlaces) {
      assert.ok(markup.includes(`href="/teikas/teksti/?selection=${item.legendIds.join(',')}"`));
      assert.equal(placeProfileSelection(item.id, location, records, false).records.length, item.count);
    }
  }
});

test('every shared-coordinate profile exposes exactly its filtered legends from each place', () => {
  const shared = [...groups.values()].filter(group => group.length > 1);
  assert.ok(shared.length > 0);
  for (const group of shared) {
    const ids = new Set(group.map(place => place.id));
    for (const subset of [records, records.filter((_, i) => i % 2 === 0), []]) {
      const expected = subset.filter(record => ids.has(record.placeId)).map(record => record.id).sort();
      for (const place of group) {
        const profile = placeProfileSelection(place.id, group, subset, true);
        assert.deepEqual(profile.records.map(record => record.id).sort(), expected, place.name);
        assert.deepEqual(profile.recordedPlaces.flatMap(item => item.legendIds).sort(), expected);
        for (const item of profile.recordedPlaces) {
          assert.deepEqual(item.legendIds.sort(), subset.filter(record => record.placeId === item.id).map(record => record.id).sort());
        }
      }
    }
  }
});

test('shared-point links escape names and omit empty filtered subsets', () => {
  const markup = placeProfileMarkup({name: 'A & B', records: [], href: '/teksti/?selection=1', tone: '#aaa',
    tr: key => key, format: String, categoryColor: () => '#aaa', english: false,
    recordedPlaces: [{id:'a',name:'<A>',count:1,href:'/teksti/?selection=1&x=2'}, {id:'b',name:'B',count:0,href:'/teksti/'}]});
  assert.ok(markup.includes('<a href="/teksti/?selection=1&amp;x=2">&lt;A&gt;</a>'));
  assert.ok(markup.includes('<span>B</span>'));
});
