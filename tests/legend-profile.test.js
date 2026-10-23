import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const map=JSON.parse(readFileSync(new URL('../src/data/map-data.json',import.meta.url),'utf8'));
const legends=JSON.parse(readFileSync(new URL('../teikas_json/legends.json',import.meta.url),'utf8'));
const html=id=>readFileSync(new URL(`../build/teksti/${id}/index.html`,import.meta.url),'utf8');
const attributes=tag=>Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([,key,value])=>[key,value.replaceAll('&amp;','&')]));
test('profile maps use the same coordinates as the main map, including original record coordinates',()=>{
 const samples=[map.legends.features.find(f=>f.properties.id==='130102005'),map.legends.features.find(f=>f.properties.coordinateSource==='original')].filter(Boolean);
 for(const feature of samples){
  const page=html(feature.properties.id);
  const tag=page.match(/<section\b[^>]*data-profile-map\b[^>]*>/)[0];
  assert.deepEqual(JSON.parse(attributes(tag)['data-coordinates']),feature.geometry.coordinates);
  assert.match(page,/data-profile-map-canvas/);
  const openTag=page.match(/<a\b[^>]*data-profile-map-open\b[^>]*>/)[0];
  const url=new URL(attributes(openTag).href,'https://example.org');
  assert.equal(url.pathname,'/teikas/karte/');
  assert.equal(url.searchParams.get('legend'),feature.properties.id);
 }
});
test('unmapped profiles explain missing coordinates without inventing a map point',()=>{
 const record=map.unmappedLegends[0],page=html(record.id);
 assert.match(page,/data-profile-map-missing/);
 assert.doesNotMatch(page,/data-profile-map-canvas/);
 assert.doesNotMatch(page,/data-coordinates=/);
});
test('profile network and overview icons preserve one focal legend',()=>{
 const record=legends.find(r=>r.id==='130102005');
 const links=[...html(record.id).matchAll(/<a\b[^>]*class="copy-icon detail-context-link"[^>]*>/g)].map(([tag])=>attributes(tag));
 assert.equal(links.length,2);
 const urls=links.map(link=>new URL(link.href,'https://example.org'));
 for(const url of urls){assert.equal(url.searchParams.get('legend'),record.id);assert.equal(url.pathname,'/teikas/dati/');}
 assert.deepEqual(urls.map(url=>url.hash),['#network','#overview']);
 for(const url of urls)assert.deepEqual([...url.searchParams],[['legend',record.id]]);
});
