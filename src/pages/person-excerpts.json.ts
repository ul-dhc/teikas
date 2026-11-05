import {browseRecords} from '../lib/data';
export function GET(){
 const records=browseRecords.map(({id,titleLv,titleDe,excerptLv,excerptDe})=>({id,titleLv,titleDe,excerptLv:excerptLv.slice(0,260),excerptDe:excerptDe.slice(0,260)}));
 return new Response(JSON.stringify(records),{headers:{'Content-Type':'application/json; charset=utf-8'}});
}
