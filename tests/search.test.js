import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeSearch,createSearchMetadata,matchesLegendSearch} from '../src/lib/search.ts';
const source=JSON.parse(readFileSync(new URL('../teikas_json/legends.json',import.meta.url),'utf8'));
const record={id:'130101001',volume:'13',place:'Brukna',narrator:'Anna',collector:'Šimiņš',year:'1891',titleLv:'Dievs rada pasauli',chapterLv:'Dievs',titleDe:'Gott erschafft die Welt',chapterDe:'Gott'};
const terms=query=>[normalizeSearch(query)];
test('text browser searches full texts and metadata while preserving text language selection',()=>{
 const text={lv:'Sākums. '+ 'x '.repeat(600)+'Apslēpts dārgums.',de:'Ein Igel trägt Nadeln.',metadata:'Etnogrāfiskas ziņas. 1891.'};
 for(const query of ['dargums','Simins','Brukna','Anna','1891','etnografiskas','130101001'])assert.ok(matchesLegendSearch(record,terms(query),text,'lv'),query);
 assert.ok(matchesLegendSearch(record,terms('Igel'),text,'de'));
 assert.ok(matchesLegendSearch(record,terms('Igel'),text,'parallel'));
 assert.equal(matchesLegendSearch(record,terms('Igel'),text,'lv'),false);
 assert.equal(matchesLegendSearch(record,terms('dargums'),text,'de'),false);
 assert.ok(matchesLegendSearch(record,[normalizeSearch('dārgums'),normalizeSearch('Brukna')],text,'lv'));
 assert.equal(matchesLegendSearch(record,terms('navtadasteikas'),text,'parallel'),false);
 assert.ok(matchesLegendSearch(record,[],undefined,'lv'));
});
test('metadata includes original annotations and resolved source information without adding legend text',()=>{
 const metadata=createSearchMetadata(source[0],['Brukna','Šimiņš','1891','Etnogrāfiskas ziņas']);
 for(const query of ['Brukna','Šimiņš','1891','Etnogrāfiskas ziņas','rumaņiem'])assert.ok(normalizeSearch(metadata).includes(normalizeSearch(query)));
 assert.ok(!metadata.includes(source[0].text.lv));
});
test('built search index retains every source ID and supports the title-filter handoff',()=>{
 const index=JSON.parse(readFileSync(new URL('../build/search-index.json',import.meta.url),'utf8'));
 assert.deepEqual(index.map(row=>row.id),source.map(row=>row.id));
 const first=index.find(row=>row.id===record.id);
 for(const query of ['krokes','Simins','Brukna','1891','rumaņiem'])assert.ok(matchesLegendSearch(record,terms(query),first,'parallel'),query);
 // The title filter excludes this body-only word; the browser finds the legend.
 assert.ok(!normalizeSearch(record.titleLv+' '+record.titleDe+' '+record.chapterLv+' '+record.chapterDe).includes('krokes'));
 assert.equal(index.filter(text=>matchesLegendSearch({...record,id:text.id,place:'',narrator:'',collector:'',year:'',titleLv:'',titleDe:'',chapterLv:'',chapterDe:''},terms('krokes'),text,'parallel')).length,1);
});
