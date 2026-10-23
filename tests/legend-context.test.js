import test from 'node:test';
import assert from 'node:assert/strict';
import {relatedLegendRecords,legendDataHref} from '../src/lib/legend-context.js';
import {buildFreeNetwork,relationshipSelection} from '../src/network/network-data.js';
const rows=[
 {id:'source',collector:'c1',narrator:'n1'},
 {id:'collector-only',collector:'c1',narrator:'n2'},
 {id:'narrator-only',collector:'c2',narrator:'n1'},
 {id:'other',collector:'c2',narrator:'n2'},
 {id:'unknown-1',collector:'',narrator:''},
 {id:'unknown-2',collector:'',narrator:''},
];
test('legend context includes either documented person, across chapters, without matching unknown people',()=>{
 assert.deepEqual(relatedLegendRecords(rows,'source').map(r=>r.id),['source','collector-only','narrator-only']);
 assert.deepEqual(relatedLegendRecords(rows,'unknown-1').map(r=>r.id),['unknown-1']);
 assert.equal(relatedLegendRecords(rows,'missing'),rows);
 assert.equal(relatedLegendRecords(rows,''),rows);
});
test('network links preserve the source and select both people using OR logic',()=>{
 const source={id:'source',collector:'Name & surname',collectorId:'c1',narrator:'Narrator',narratorId:'n1'};
 const url=new URL(legendDataHref('/teikas/',source,'network'),'https://example.org');
 assert.equal(url.pathname,'/teikas/dati/');assert.equal(url.hash,'#network');
 assert.equal(url.searchParams.get('legend'),'source');
 assert.equal(url.searchParams.get('categories'),'collector,narrator');
 const connection=JSON.parse(url.searchParams.get('connection'));
 const selected=relatedLegendRecords(rows,'source');
 assert.deepEqual(relationshipSelection(selected,connection).map(r=>r.id),selected.map(r=>r.id));
 const graph=buildFreeNetwork(selected,url.searchParams.get('categories').split(','));
 assert.equal(graph.represented,3);assert.equal(graph.edges.length,3);
 assert.equal(graph.nodes.length,4);
 const overview=new URL(legendDataHref('/teikas/',source,'overview'),'https://example.org');
 assert.equal(overview.hash,'#overview');assert.equal(overview.searchParams.get('legend'),'source');
 assert.equal(overview.searchParams.has('connection'),false);
});
test('missing person labels never create selections for placeholder person IDs',()=>{
 const record={id:'unknown-1',collector:'',collectorId:'placeholder',narrator:'',narratorId:''};
 const url=new URL(legendDataHref('/teikas/',record,'network'),'https://example.org');
 assert.equal(url.searchParams.has('connection'),false);
 const oneKnown={...record,collector:'Collector',collectorId:'c1'};
 const knownUrl=new URL(legendDataHref('/teikas/',oneKnown,'network'),'https://example.org');
 assert.deepEqual(JSON.parse(knownUrl.searchParams.get('connection')).nodes,[{field:'collector',value:'c1'}]);
});
test('overview scopes use person IDs even when two people have identical display names',()=>{
 const records=[
  {id:'one',collector:'Same name',collectorId:'c1',narrator:'',narratorId:''},
  {id:'two',collector:'Same name',collectorId:'c2',narrator:'',narratorId:''},
  {id:'three',collector:'Same name',collectorId:'c1',narrator:'',narratorId:''},
 ];
 assert.deepEqual(relatedLegendRecords(records,'one').map(r=>r.id),['one','three']);
});
test('network and overview identify the same related legends in the built collection',async()=>{
 const {readFileSync}=await import('node:fs');
 const html=readFileSync(new URL('../build/dati/index.html',import.meta.url),'utf8');
 const data=id=>JSON.parse(html.match(new RegExp(`<script[^>]*id="${id}"[^>]*>([\\s\\S]*?)<\\/script>`))[1]).types.flatMap(type=>type.records);
 const network=data('ml-data'),overview=data('overview-data');
 for(const id of ['130102005','130115001','130501002']){
  const expected=relatedLegendRecords(network,id).map(r=>r.id).sort();
  assert.deepEqual(relatedLegendRecords(overview,id).map(r=>r.id).sort(),expected,id);
 }
 const related=relatedLegendRecords(network,'130102005');
 assert.ok(related.length>1);
 assert.ok(new Set(related.map(r=>r.id.slice(0,4))).size>1,'person connections cross chapter boundaries');
});
