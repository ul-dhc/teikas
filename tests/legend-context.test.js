import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {relatedLegendRecords,legendDataHref,legendBranches,legendOverview} from '../src/lib/legend-context.js';
const rows=[
 {id:'130101001',topic:'13',collector:'c1',narrator:'n1'},
 {id:'130101002',topic:'13',collector:'c1',narrator:'n2'},
 {id:'140101001',topic:'14',collector:'c2',narrator:'n1'},
 {id:'140102001',topic:'14',collector:'c2',narrator:'n2'},
 {id:'150101001',topic:'15',collector:'',narrator:''},
 {id:'150101002',topic:'15',collector:'',narrator:''},
];
test('focal legend is distinct from related records and counts match its collection hierarchy',()=>{
 const context=legendOverview(rows,'130101001');
 assert.equal(context.source,rows[0]);
 assert.equal(context.volumeCount,2);assert.equal(context.chapterCount,2);assert.equal(context.subsectionCount,2);
 assert.equal(context.relatedCount,2);
 assert.equal(legendOverview(rows,'missing'),null);
 const branches=legendBranches(rows,'130101001');
 assert.deepEqual(branches.map(branch=>[branch.field,branch.value,branch.records.map(r=>r.id)]),[
  ['collector','c1',['130101002']],['narrator','n1',['140101001']],
 ]);
 assert.ok(branches.every(branch=>branch.records.every(record=>record.id!=='130101001')));
});
test('unknown people create no shared links; a record reached by both roles is counted once',()=>{
 assert.deepEqual(legendBranches(rows,'150101001'),[]);
 assert.equal(legendOverview(rows,'150101001').relatedCount,0);
 const both=[...rows,{id:'130101003',topic:'13',collector:'c1',narrator:'n1'}];
 assert.equal(legendOverview(both,'130101001').relatedCount,3);
 assert.equal(legendBranches(both,'130101001').flatMap(branch=>branch.records).length,4);
});
test('entry links identify only the focal legend and view, without expanding person filters',()=>{
 for(const view of ['network','overview']){
  const url=new URL(legendDataHref('/teikas/',rows[0],view),'https://example.org');
  assert.equal(url.pathname,'/teikas/dati/');assert.equal(url.hash,'#'+view);
  assert.deepEqual([...url.searchParams],[['legend','130101001']]);
 }
});
test('person identity, not matching display names, determines related records',()=>{
 const records=[
  {id:'one',collector:'Same name',collectorId:'c1',narrator:''},
  {id:'two',collector:'Same name',collectorId:'c2',narrator:''},
  {id:'three',collector:'Same name',collectorId:'c1',narrator:''},
 ];
 assert.deepEqual(relatedLegendRecords(records,'one').map(r=>r.id),['one','three']);
});
test('reported 13-record case now has one focal legend, twelve related legends, and exact hierarchy counts',()=>{
 const html=readFileSync(new URL('../build/dati/index.html',import.meta.url),'utf8');
 const payload=JSON.parse(html.match(/<script[^>]*id="ml-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
 const records=payload.types.flatMap(type=>type.records.map(record=>({...record,topic:type.topic})));
 const context=legendOverview(records,'140401004');
 assert.equal(context.source.id,'140401004');
 assert.equal(context.relatedCount,12);
 const branches=legendBranches(records,'140401004');
 assert.equal(branches.length,1);assert.equal(branches[0].field,'collector');
 assert.equal(branches[0].records.length,12);
 for(const [key,prefix] of [['chapterCount',4],['subsectionCount',6]])assert.equal(context[key],records.filter(record=>record.id.startsWith('140401004'.slice(0,prefix))).length);
 assert.equal(context.volumeCount,records.filter(record=>record.topic==='14').length);
});
