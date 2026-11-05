import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync('scripts/feedback/Code.gs','utf8');
function receiver(){
 const rows=[],cache=new Map();let locked=false;
 const sheet={getRange:()=>({createTextFinder:id=>({matchEntireCell:()=>({findNext:()=>rows.some(row=>row[5]===id)})})}),appendRow:row=>rows.push(row)};
 const context=vm.createContext({
  SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet})},
  LockService:{getScriptLock:()=>({waitLock:()=>locked=true,releaseLock:()=>locked=false})},
  CacheService:{getScriptCache:()=>({get:key=>cache.get(key),put:(key,value)=>cache.set(key,value)})},
  HtmlService:{createHtmlOutput:html=>({html,setXFrameOptionsMode(){return this;}}),XFrameOptionsMode:{ALLOWALL:1}},
  ContentService:{createTextOutput:text=>text},
 });
 vm.runInContext(code,context);
 const send=p=>JSON.parse(context.doPost({parameter:p}).html.match(/postMessage\((.+),"https?:/)[1]);
 return {rows,send,context,locked:()=>locked};
}
const submission={kind:'error',description:'Pārbaudes ziņojums',pageUrl:'https://dhc.lu.lv/teikas/dati/?collector=collector-0625#network',requestId:'12345678-1234-1234-1234-123456789abc'};
test('feedback preserves page state, writes no email and acknowledges only after writing',()=>{
 const r=receiver();assert.equal(r.send(submission).ok,true);assert.equal(r.rows.length,1);
 assert.equal(r.rows[0].length,6);assert.equal(r.rows[0][3],submission.pageUrl);assert.equal(r.rows[0][4],'Jauns');assert.equal(r.locked(),false);
 assert.equal(r.send(submission).ok,true);assert.equal(r.rows.length,1);
});
test('feedback rejects invalid data and stores formula-like text literally',()=>{
 for(const changes of [{website:'spam'},{description:'a'},{description:'a'.repeat(5001)},{kind:'invalid'},{pageUrl:'https://example.org/teikas/'},{pageUrl:'https://dhc.lu.lv/other/'},{requestId:'bad'}]){
  const r=receiver();assert.equal(r.send({...submission,...changes}).ok,false);assert.equal(r.rows.length,0);
 }
 const r=receiver();assert.equal(r.send({...submission,description:'=IMPORTXML("https://example.org")'}).ok,true);assert.ok(r.rows[0][2].startsWith("'="));
 assert.equal(r.context.doGet(),'TEIKAS feedback receiver');
});
test('feedback caps anonymous write volume and releases the write lock on failure',()=>{
 const r=receiver();for(let i=0;i<31;i++)assert.equal(r.send({...submission,requestId:`12345678-1234-1234-1234-${String(i).padStart(12,'0')}`}).ok,i<30);
 assert.equal(r.rows.length,30);assert.equal(r.locked(),false);
});
