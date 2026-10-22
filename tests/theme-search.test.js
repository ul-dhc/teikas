import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createThemeSearchRecord,themeSearchTerms,searchThemeRecords} from '../src/lib/theme-search.ts';
import {encodeSelection,decodeSelection} from '../src/lib/selection.js';
const source=JSON.parse(readFileSync(new URL('../teikas_json/legends.json',import.meta.url),'utf8'));
const fixture=(id,lv,de='')=>({...source[0],id,chapter:{lv:'Tēma',de:'Thema'},title:{lv:'Nosaukums',de:'Titel'},text:{lv,de},originalMetadata:null,comments:null,notes:null,primarySourceRaw:null,secondarySourceRaw:null});
test('theme search covers full bilingual texts and metadata with accents ignored',()=>{
 const record=createThemeSearchRecord(fixture('130101001','Sākums. '+ 'x '.repeat(600)+'Apslēpts dārgums.','Ein Igel trägt Nadeln.'),['Šimiņš','Brukna','1891','Etnogrāfiskas ziņas']);
 for(const query of ['dargums','IGEL','Simins','Brukna','1891','etnografiskas','130101001','Thema','Nosaukums'])assert.equal(searchThemeRecords([record],themeSearchTerms(query)).count,1,query);
 assert.equal(searchThemeRecords([record],themeSearchTerms('nekadnavbijis')).count,0);
 assert.equal(searchThemeRecords([record],themeSearchTerms('dārgums Brukna')).count,1);
});
test('all terms must match one legend and quoted phrases keep word order',()=>{
 const records=[createThemeSearchRecord(fixture('130101001','Zelta nauda zem akmens.')),createThemeSearchRecord(fixture('130101002','Sudraba nauda mežā.'))];
 assert.equal(searchThemeRecords(records,themeSearchTerms('zelta mežā')).count,0);
 assert.equal(searchThemeRecords(records,themeSearchTerms('“zem akmens”')).count,1);
 assert.equal(searchThemeRecords(records,themeSearchTerms('"akmens zem"')).count,0);
 assert.deepEqual(themeSearchTerms('  ZELTA  zelta  “zem   akmens”  '),['zelta','zem akmens']);
 assert.equal(searchThemeRecords(records,themeSearchTerms('  ')).count,2);
});
test('built index preserves corpus IDs and provides exact subsection and chapter selections',()=>{
 const index=JSON.parse(readFileSync(new URL('../build/theme-search.json',import.meta.url),'utf8'));
 assert.deepEqual(index.map(record=>record.id),source.map(record=>record.id));
 const result=searchThemeRecords(index,themeSearchTerms('130101001'));
 assert.equal(result.count,1);
 assert.deepEqual(result.sections.get('130101'),['130101001']);
 assert.deepEqual(result.chapters.get('1301'),['130101001']);
 const first=index.find(record=>record.id==='130101001');
 for(const query of ['krokes','Igel','Simins','Brukna','1891','rumaņiem'])assert.equal(searchThemeRecords([first],themeSearchTerms(query)).count,1,query);
 // Source chapters sharing the same name remain separate.
 const money=searchThemeRecords(index,themeSearchTerms('Nauda'));
 assert.ok(money.chapters.has('1406'));assert.ok(money.chapters.has('1501'));
 for(const ids of money.sections.values())assert.deepEqual(new Set(decodeSelection(encodeSelection(ids),source)),new Set(ids));
});
