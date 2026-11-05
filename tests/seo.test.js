import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalUrl} from '../src/lib/seo.js';

const read = path => readFileSync(`build/${path}`, 'utf8');
const legends = JSON.parse(readFileSync('teikas_json/legends.json', 'utf8'));
test('legacy reader URLs consolidate on the public institutional reader', () => {
  for (const legend of legends) {
    assert.equal(canonicalUrl(`/teikas/teikas/${legend.id}/`), `https://dhc.lu.lv/teikas/teksti/${legend.id}/`);
  }
  assert.equal(canonicalUrl('/teikas/teikas/'), 'https://dhc.lu.lv/teikas/teksti/');
  assert.equal(canonicalUrl('/teikas/personas/'), 'https://dhc.lu.lv/teikas/personas/');
});
test('sitemap lists every legend exactly once without legacy or filter URLs', () => {
  const urls = [...read('sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  assert.equal(urls.length, legends.length + 7);
  assert.equal(new Set(urls).size, urls.length);
  for (const legend of legends) assert.ok(urls.includes(canonicalUrl(`/teikas/teksti/${legend.id}/`)));
  assert.ok(urls.every(url => url.startsWith('https://dhc.lu.lv/teikas/') && !url.includes('?') && !url.includes('/teikas/teikas/')));
});
test('rendered pages expose canonical URLs, source identity and distinct descriptions', () => {
  const home = read('index.html');
  assert.ok(home.includes('<title>Latviešu tautas teikas'));
  assert.ok(home.includes('rel="canonical" href="https://dhc.lu.lv/teikas/"'));
  const id = legends[0].id;
  for (const route of ['teksti', 'teikas']) {
    const html = read(`${route}/${id}/index.html`);
    assert.ok(html.includes(`rel="canonical" href="https://dhc.lu.lv/teikas/teksti/${id}/"`));
    assert.ok(!html.includes('https://ul-dhc.github.io/teikas/'));
    const schema = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    const work = schema['@graph'].find(item => item['@type'] === 'CreativeWork');
    assert.equal(work.identifier, id);
    assert.equal(work.isPartOf.editor.name, 'Pēteris Šmits');
    assert.ok(work.citation.includes('Latviešu pasakas un teikas'));
  }
});
