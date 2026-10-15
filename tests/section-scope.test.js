import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sectionScope, scopeRecordsToSection} from '../src/lib/section-scope.ts';
const records=JSON.parse(readFileSync(new URL('../teikas_json/legends.json',import.meta.url),'utf8'));
test('subsection routes select the same source IDs as the text browser',()=>{
 for(const section of new Set(records.map(record=>record.id.slice(0,6)))){
  const expected=records.filter(record=>record.id.startsWith(section)).map(record=>record.id);
  assert.deepEqual(scopeRecordsToSection(records,sectionScope(section)).map(record=>record.id),expected);
 }
 assert.equal(records.filter(record=>record.id.startsWith('130101')).length,15);
 assert.equal(scopeRecordsToSection(records,'').length,records.length);
 for(const value of [null,'','1301','130101x','unknown'])assert.equal(sectionScope(value),'');
});
