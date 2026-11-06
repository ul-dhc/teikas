import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
const source=readFileSync('scripts/feedback/Stats.gs','utf8');
function gateway(){
 const cache=new Map(),props=new Map([['TEIKAS_STATS_PASSWORD','test-only-password'],['GOATCOUNTER_API_TOKEN','test-key']]);
 let reads=0,fetches=0;
 const context=vm.createContext({Date,console,FEEDBACK_SHEET_ID:'test',PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)})},CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Utilities:{DigestAlgorithm:{SHA_256:1},Charset:{UTF_8:1},computeDigest:(_,v)=>[...createHash('sha256').update(v).digest()],getUuid:randomUUID,sleep(){},formatDate:(d,zone,pattern)=>pattern==='yyyy'?String(d.getUTCFullYear()):d.toISOString().slice(0,10),parseDate:s=>new Date(s+'T00:00:00Z')},SpreadsheetApp:{openById:()=>{reads++;return{getSheetByName:()=>({getLastRow:()=>2,getRange:()=>({getValues:()=>[[new Date(),'error','</script><script>alert(1)</script>','https://dhc.lu.lv/teikas/','Jauns']]})})};}},UrlFetchApp:{fetch:()=>{fetches++;throw Error('offline');}},HtmlService:{XFrameOptionsMode:{ALLOWALL:1},createHtmlOutput:s=>({html:s,setXFrameOptionsMode(){return this;}})}});
 vm.runInContext(source,context);
 function post(values){const output=context.statsPost({clientUrl:'https://dhc.lu.lv/teikas/stats/',requestId:randomUUID(),...values});let data;vm.runInNewContext(output.html.match(/<script>([\s\S]*)<\/script>/)[1],{window:{top:{postMessage:d=>{data=d;}}}});return {data,html:output.html};}
 return {context,post,props,cache,counters:()=>({reads,fetches})};
}
test('stats authentication prevents private reads and rejects invalid origins',()=>{
 const g=gateway();
 assert.equal(g.post({action:'stats-read',token:'x'}).data.code,'unauthorized');
 assert.equal(g.post({action:'stats-login',password:'wrong'}).data.code,'unauthorized');
 assert.equal(g.post({action:'stats-login',password:'test-only-password',clientUrl:'https://evil.example/teikas/stats/'}).data.code,'invalid');
 assert.deepEqual(g.counters(),{reads:0,fetches:0});
});
test('authenticated reports survive a visit API failure; HTML cannot execute report text',()=>{
 const g=gateway(),token=g.post({action:'stats-login',password:'test-only-password'}).data.token;
 const result=g.post({action:'stats-read',token,days:7});
 assert.equal(result.data.ok,true);assert.ok(Number.isFinite(Date.parse(result.data.asOf)));assert.equal(result.data.visits,null);assert.equal(result.data.visitsError,'unavailable');
 assert.equal(result.data.reports.items[0].description,'</script><script>alert(1)</script>');
 assert.equal((result.html.match(/<script>/g)||[]).length,1);
 g.post({action:'stats-logout',token});assert.equal(g.post({action:'stats-read',token,days:7}).data.code,'unauthorized');
});
test('password changes revoke sessions and missing setup fails closed',()=>{
 const g=gateway(),token=g.post({action:'stats-login',password:'test-only-password'}).data.token;
 g.props.set('TEIKAS_STATS_PASSWORD','changed');assert.equal(g.post({action:'stats-read',token,days:7}).data.code,'unauthorized');
 g.props.delete('TEIKAS_STATS_PASSWORD');assert.equal(g.post({action:'stats-read',token,days:7}).data.code,'setup');
 assert.deepEqual(g.counters(),{reads:0,fetches:0});
});
test('GoatCounter boundaries exclude other DHC pages, events and stats',()=>{
 const {context:c}=gateway();
 for(const p of ['/','/other/','/teikas-other/','/teikas/stats/','/teikas/stats'])assert.equal(c.statsIsTeikas(p,false),false);
 assert.equal(c.statsIsTeikas('/teikas/personas/',true),false);assert.equal(c.statsIsTeikas('/teikas/personas/?q=x',false),true);
 let call=0;c.statsApi=()=>++call===1?{more:true,paths:[{id:1,path:'/'},{id:2,path:'/teikas/'}]}:{more:false,paths:[{id:3,path:'/teikas/stats/'},{id:4,path:'/teikas/personas/'}]};
 assert.deepEqual(Array.from(c.statsPathIds()),[2,4]);assert.equal(call,2);
});
test('section totals include pages beyond the top 50, and DHC rows never leak',()=>{
 const {context:c}=gateway();c.statsPathIds=()=>[1];
 c.statsApi=()=>({hits:[{path:'/',count:999},...Array.from({length:60},(_,i)=>({path:'/teikas/teksti/'+i+'/',count:1,stats:[]}))]});
 const result=c.statsVisits(7);assert.equal(result.total,60);assert.equal(result.pages.length,50);assert.equal(result.sections[0].count,60);assert.equal(result.daily.length,7);
});
test('a site with no TEIKAS paths returns genuine zero without a broad stats query',()=>{
 const {context:c}=gateway();c.statsPathIds=()=>[];c.statsApi=()=>{throw Error('must not query all DHC');};
 const result=c.statsVisits(7);assert.equal(result.total,0);assert.equal(result.pageCount,0);
});

test('the password year follows the Riga calendar year without changing its prefix',()=>{
 const g=gateway(),year=new Date().getUTCFullYear();
 g.props.set('TEIKAS_STATS_PASSWORD','test-prefix-2000');
 assert.equal(g.post({action:'stats-login',password:'test-prefix-'+year}).data.ok,true);
 assert.equal(g.post({action:'stats-login',password:'test-prefix-'+(year-1)}).data.code,'unauthorized');
});

test('all-time visits include history older than a year and fill missing days',()=>{
 const g=gateway(),c=g.context;let requestedStart;
 c.statsPathIds=()=>[1];c.statsApi=(_,params)=>{requestedStart=params.start;return {hits:[{path:'/teikas/',count:8,stats:[{day:'2020-01-01',daily:3},{day:'2020-01-03',daily:5}]}]};};
 const result=c.statsVisits(0);assert.equal(requestedStart,'1970-01-01T00:00:00.000Z');assert.equal(result.total,8);assert.equal(result.daily[0].day,'2020-01-01');assert.equal(result.daily[1].count,0);assert.equal(result.daily[2].count,5);assert.ok(result.daily.length>365);
 const token=g.post({action:'stats-login',password:'test-only-password'}).data.token;assert.equal(g.post({action:'stats-read',token,days:0}).data.ok,true);
});
