import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {flattenTypes,selectionLink,UNKNOWN} from '../src/network/statistics.js';
import {buildRelationships,buildFreeNetwork,relationshipSelection} from '../src/network/network-data.js';
const html=readFileSync(new URL('../build/dati/index.html',import.meta.url),'utf8');
const payload=JSON.parse(html.match(/<script[^>]*id="ml-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
const rows=flattenTypes(payload.types);
const legends=JSON.parse(readFileSync(new URL('../teikas_json/legends.json',import.meta.url),'utf8'));
test('adapter represents each Teikas record once, retaining exact person/place identities and German text',()=>{
 assert.equal(rows.length,legends.length);assert.equal(new Set(rows.map(r=>r.id)).size,legends.length);
 const byId=new Map(legends.map(r=>[r.id,r]));
 for(const row of rows){const original=byId.get(row.id);assert.equal(row.county,original.placeId||'');if(row.collector)assert.equal(row.collector,original.collectorId);if(row.narrator)assert.equal(row.narrator,original.narratorId);assert.equal(row.titleDe,original.title.de||'');assert.equal(row.topic,original.volume);assert.equal(row.typeLv,original.chapter.lv||'Nav norādīts');}
});
test('all categories and exact edge selections survive the port',()=>{
 for(const [left,right] of [['county','typeId'],['collector','narrator'],['place','topic']]){
  const graph=buildRelationships(rows,left,right,10000),lookup=new Map(graph.nodes.map(n=>[n.id,n]));
  assert.equal(graph.represented,legends.length);assert.equal(graph.edges.reduce((sum,e)=>sum+e.recordIds.length,0),legends.length);
  for(const e of graph.edges){const a=lookup.get(e.source),b=lookup.get(e.target);assert.deepEqual(relationshipSelection(rows,{kind:'edge',left,right,leftValue:a.value,rightValue:b.value}).map(r=>r.id),e.recordIds);}
 }
 const graph=buildFreeNetwork(rows);assert.equal(graph.represented,legends.length);assert.equal(graph.edges.reduce((sum,e)=>sum+e.recordIds.length,0),legends.length*6);
 assert.ok(buildRelationships(rows,'collector','narrator',10000).nodes.some(n=>n.value===UNKNOWN));
});
test('node limit, source categories and explorer URLs preserve exact selection',()=>{
 const graph=buildRelationships(rows,'collector','typeId',12);assert.ok(graph.nodes.length<=24);assert.ok(graph.represented<rows.length);assert.equal(graph.represented,new Set(graph.edges.flatMap(e=>e.recordIds)).size);
 const graphAll=buildFreeNetwork(rows,['county','collector','narrator','typeId','topic','place']);assert.equal(graphAll.edges.reduce((sum,e)=>sum+e.recordIds.length,0),legends.length*15);
 const selection=rows.filter(r=>r.county==='place-0001');assert.equal(new URL(selectionLink('/teikas/',selection),'http://localhost').pathname,'/teikas/teksti/');assert.deepEqual(new URL(selectionLink('/teikas/',selection),'http://localhost').searchParams.get('selection').split(','),selection.map(r=>r.id));
});
