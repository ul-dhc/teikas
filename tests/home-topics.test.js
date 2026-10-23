import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {homeTopics,getHomeTopic,matchesHomeTopic,homeTopicName} from '../src/lib/home-topics.ts';
const records=JSON.parse(readFileSync(new URL('../teikas_json/legends.json',import.meta.url),'utf8'));
test('eight homepage topics retain their approved chapter membership and counts',()=>{
 const expected=[902,245,579,255,245,134,448,148],seen=new Set();
 assert.equal(homeTopics.length,8);
 homeTopics.forEach((topic,index)=>{
  assert.equal(getHomeTopic(topic.id),topic);
  const selected=records.filter(record=>matchesHomeTopic(record,topic));
  assert.equal(selected.length,expected[index],topic.lv);
  for(const chapter of topic.chapters)assert.ok(selected.some(record=>record.id.startsWith(chapter)));
  selected.forEach(record=>{assert.ok(!seen.has(record.id),'topics must not overlap');seen.add(record.id)});
  for(const lang of ['lv','de','en'])assert.ok(homeTopicName(topic,lang));
 });
 assert.equal(seen.size,2956);
 // Treasure spans two volumes; selection must preserve both chapters.
 assert.deepEqual([...new Set(records.filter(record=>matchesHomeTopic(record,getHomeTopic('apslepta-manta'))).map(record=>record.id.slice(0,4)))].sort(),['1406','1501']);
});
test('unknown or cleared homepage topic leaves the collection unrestricted',()=>{
 for(const value of [null,'','missing','1301','toString']){
  assert.equal(getHomeTopic(value),null);
  assert.equal(records.filter(record=>matchesHomeTopic(record,getHomeTopic(value))).length,records.length);
 }
});
test('homepage cards activate existing theme filter values and preserve every intended legend',()=>{
 const html=readFileSync(new URL('../build/index.html',import.meta.url),'utf8');
 const cards=[...html.matchAll(/<a\b[^>]*class="topic-block"[^>]*>/g)].map(([tag])=>({
  id:tag.match(/data-topic-id="([^"]+)"/)?.[1],href:tag.match(/href="([^"]+)"/)?.[1].replaceAll('&amp;','&'),
 }));
 assert.equal(cards.length,8);
 for(const card of cards){
  const topic=getHomeTopic(card.id),url=new URL(card.href,'https://example.org');
  const titles=new Set(url.searchParams.getAll('theme'));
  assert.ok(titles.size,card.id);
  assert.equal(url.searchParams.has('topic'),false,'no independent homepage filter');
  assert.equal(url.searchParams.has('section'),false,'no hidden chapter restriction');
  assert.equal(url.searchParams.has('selection'),false,'no hidden record selection');
  const actual=records.filter(record=>titles.has(record.chapter.lv)).map(record=>record.id);
  const expected=records.filter(record=>matchesHomeTopic(record,topic)).map(record=>record.id);
  assert.deepEqual(actual,expected,card.id);
 }
 const creatures=new URL(cards.find(card=>card.id==='vilkaci-vadataji-lietuveni').href,'https://example.org');
 assert.deepEqual(creatures.searchParams.getAll('theme').sort(),['Vilkati','Vadātāji','Lietuvēni'].sort());
 const waters=new URL(cards.find(card=>card.id==='udeni-kalni-akmeni').href,'https://example.org');
 assert.equal(waters.searchParams.getAll('theme').length,1,'commas in a chapter title are not separators');
});
