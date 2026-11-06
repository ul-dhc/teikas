import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildProfiles,matchingRecords,matchPerson,textsHref} from '../src/persons/model.js';
import {decodeSelection} from '../src/lib/selection.js';
const read=name=>JSON.parse(readFileSync(`teikas_json/${name}.json`,'utf8'));
const legends=read('legends'),collectors=read('collectors'),narrators=read('narrators');
const records=legends.map(r=>({...r,chapterLv:r.chapter.lv,place:r.placeId,collector:r.collectorId,narrator:r.narratorId}));
const profiles=buildProfiles([...collectors,...narrators].map(p=>({...p,fullname:p.fullName})),records),byId=new Map(records.map(r=>[r.id,r]));
test('every person profile and relationship preserves the exact source records',()=>{
 assert.equal(profiles.length,collectors.length+narrators.length);
 for(const p of profiles){
  const expected=records.filter(r=>r[`${p.role}Id`]===p.id).map(r=>r.id);
  assert.deepEqual(p.ids,expected);
  for(const [groups,field] of [[p.themes,'chapterLv'],[p.places,'placeId'],[p.peers,p.role==='collector'?'narratorId':'collectorId']])for(const g of groups)assert.deepEqual(g.ids,expected.filter(id=>byId.get(id)[field]===g.id));
  const url=new URL(textsHref('/teikas/',p),'https://example.com');
  assert.equal(url.searchParams.get(p.role),p.id);
  assert.deepEqual(decodeSelection(url.searchParams.get('selection'),records).sort(),[...expected].sort());
 }
});
test('people with matching names remain distinct source identities',()=>{
 const same=profiles.filter(p=>p.name==='Zeltiņa, P.');
 assert.equal(same.length,2);assert.equal(new Set(same.map(p=>p.id)).size,2);
 assert.deepEqual(same.map(p=>p.ids.length).sort((a,b)=>a-b),[1,71]);
});
test('combined theme and place filters match a single text',()=>{
 const p={ids:['a','b','c']},index=new Map([['a',{id:'a',chapterLv:'A',placeId:'X'}],['b',{id:'b',chapterLv:'B',placeId:'Y'}],['c',{id:'c',chapterLv:'A',placeId:'Y'}]]);
 assert.deepEqual(matchingRecords(p,index,'A','Y').map(r=>r.id),['c']);
 assert.deepEqual(matchingRecords({ids:['a','b']},index,'A','Y'),[]);
});

test('unknown collectors use exact record selections in every explorer',async()=>{
 const {explorationHrefs}=await import('../src/persons/model.js');
 const profile={...profiles.find(p=>p.id==='collector-0499'),unknown:true};
 assert.equal(profile.ids.length,195);
 for(const href of Object.values(explorationHrefs('/teikas/',profile))){
  const url=new URL(href,'https://example.org');
  assert.equal(url.searchParams.has('collector'),false);
  assert.deepEqual(decodeSelection(url.searchParams.get('selection'),records).sort(),[...profile.ids].sort());
 }
});

test('missing peer names cannot expose database IDs',()=>{
 const profile=buildProfiles([{id:'narrator-1',fullname:'Narrator'}],[{id:'1',narratorId:'narrator-1',collectorId:'collector-0499',collector:'',chapterLv:'A'}])[0];
 assert.deepEqual(profile.peers[0],{id:'collector-0499',label:'',unknown:true,ids:['1']});
});

test('person network links open a hierarchy with the matching person node selected',async()=>{
 const {explorationHrefs}=await import('../src/persons/model.js');
 for(const role of ['collector','narrator']){
  for(const unknown of [false,true]){
   const profile={...profiles.find(p=>p.role===role),unknown};
   const url=new URL(explorationHrefs('/teikas/',profile).network,'https://example.org');
   assert.equal(url.hash,'#network');
   assert.equal(url.searchParams.get('layout'),'hierarchical');
   assert.deepEqual(url.searchParams.get('categories').split(','),['county','collector','narrator','typeId']);
   assert.deepEqual(JSON.parse(url.searchParams.get('connection')),{kind:'node',field:role,value:unknown?'__unknown__':profile.id});
   assert.equal(url.searchParams.get(role),unknown?null:profile.id);
  }
 }
});

test('shared pinned selections carry IDs instead of a browser-local flag',async()=>{
 const {sharedPersonSelectionUrl}=await import('../src/persons/model.js');
 const href=sharedPersonSelectionUrl('https://example.org/teikas/personas/?saved=1&pinned=1&page=2&sort=count',['collector-0001','narrator-0002']);
 const url=new URL(href);
 for(const key of ['saved','pinned','page'])assert.equal(url.searchParams.has(key),false);
 assert.deepEqual(decodeSelection(url.searchParams.get('selection'),profiles),['collector-0001','narrator-0002']);
 assert.equal(url.searchParams.get('sort'),'count');
 const empty=new URL(sharedPersonSelectionUrl(href,[]));
 assert.equal(empty.searchParams.has('selection'),true);
 assert.equal(empty.searchParams.get('selection'),'');
});

test('explorer selection scopes preserve exact IDs and never broaden invalid selections',async()=>{
 const {scopeRecordsToSelection}=await import('../src/lib/selection.js');
 const ids=profiles.find(p=>p.id==='collector-0499').ids;
 const selected=scopeRecordsToSelection(records,ids.join(','));
 assert.deepEqual(new Set(selected.map(r=>r.id)),new Set(ids));
 assert.equal(scopeRecordsToSelection(records,null),records);
 assert.deepEqual(scopeRecordsToSelection(records,''),[]);
 assert.deepEqual(scopeRecordsToSelection(records,'not-a-record'),[]);
});

test('discovery order favours larger contributions while keeping small ones discoverable',async()=>{
 const {createDiscoveryOrder}=await import('../src/persons/model.js');
 let seed=12345;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const people=[{id:'small',ids:['1']},{id:'large',ids:Array.from({length:100},(_,i)=>String(i))}];
 let largeFirst=0;
 for(let i=0;i<10000;i++){const order=createDiscoveryOrder(people,random);assert.equal(order.size,2);if(order.get('large')<order.get('small'))largeFirst++;}
 assert.ok(largeFirst>8800&&largeFirst<9400,`Larger contribution appeared first ${largeFirst} times`);
});

test('unknown-person buckets receive no contribution boost and discovery scores are finite',async()=>{
 const {createDiscoveryOrder}=await import('../src/persons/model.js');
 const scores=createDiscoveryOrder([{id:'small',ids:['1']},{id:'unknown',unknown:true,ids:Array(195).fill('1')}],()=>.5);
 assert.equal(scores.get('small'),scores.get('unknown'));
 for(const draw of [0,1])for(const score of createDiscoveryOrder(profiles,()=>draw).values())assert.ok(Number.isFinite(score)&&score>0);
});

const searchRecords=new Map([
 ['renda',{id:'renda',chapterLv:'Dievs',placeId:'place-renda',place:'Renda'}],
 ['riga',{id:'riga',chapterLv:'Velni',placeId:'place-riga',place:'Rīga'}],
 ['riga2',{id:'riga2',chapterLv:'Dievs',placeId:'place-riga',place:'Rīga'}],
]);
const searchPerson={name:'Zeltiņa, P.',ids:['renda','riga','riga2']};
test('person search finds names and legend places without requiring diacritics',()=>{
 assert.deepEqual(matchPerson(searchPerson,searchRecords,'  ZELTINA  ').records.map(r=>r.id),searchPerson.ids);
 assert.deepEqual(matchPerson(searchPerson,searchRecords,'rIgA').records.map(r=>r.id),['riga','riga2']);
 assert.deepEqual(matchPerson(searchPerson,searchRecords,'rIgA').places,['Rīga']);
 assert.deepEqual(matchPerson(searchPerson,searchRecords,'Renda').records.map(r=>r.id),['renda']);
 assert.equal(matchPerson(searchPerson,searchRecords,'Kuldīga').records.length,0);
});
test('place search and active filters must apply to the same legend records',()=>{
 assert.deepEqual(matchPerson(searchPerson,searchRecords,'Rīga','Dievs').records.map(r=>r.id),['riga2']);
 assert.deepEqual(matchPerson(searchPerson,searchRecords,'Renda','Velni').records,[]);
 assert.deepEqual(matchPerson(searchPerson,searchRecords,'Renda','','place-riga').records,[]);
 assert.deepEqual(matchPerson(searchPerson,searchRecords,'Zeltiņa','Velni').records.map(r=>r.id),['riga']);
 assert.deepEqual(matchPerson(searchPerson,searchRecords,'Zeltiņa').places,[]);
 assert.deepEqual(matchPerson(searchPerson,searchRecords,'').records.map(r=>r.id),searchPerson.ids);
});
