import {encodeSelection} from '../lib/selection.js';

// Identity remains the source ID: matching names are never silently merged.
export function buildProfiles(people, records) {
 const byPerson=new Map();
 for(const record of records) for(const id of [record.collectorId,record.narratorId].filter(Boolean)) {
  if(!byPerson.has(id))byPerson.set(id,[]);
  byPerson.get(id).push(record);
 }
 return people.map(person=>{
  const related=byPerson.get(person.id)||[],role=person.id.startsWith('collector-')?'collector':'narrator';
  const aggregate=(field,label)=>{
   const groups=new Map();
   for(const record of related){const value=record[field];if(!value)continue;
    if(!groups.has(value))groups.set(value,{id:value,label:record[label]||'',unknown:!record[label],ids:[]});
    groups.get(value).ids.push(record.id);
   }
   return [...groups.values()].sort((a,b)=>b.ids.length-a.ids.length||a.label.localeCompare(b.label,'lv'));
  };
  return {id:person.id,name:person.fullname,sortName:person.sortname||person.fullname,unknown:person.unknown===true,gender:person.gender||'',notes:person.notes||'',role,
   ids:related.map(record=>record.id),themes:aggregate('chapterLv','chapterLv'),places:aggregate('placeId','place'),
   peers:aggregate(role==='collector'?'narratorId':'collectorId',role==='collector'?'narrator':'collector')};
 });
}

// A combined theme/place filter must match the same legend, not two unrelated texts.
export function matchingRecords(profile, byId, theme='', place='') {
 return profile.ids.map(id=>byId.get(id)).filter(record=>record&&(!theme||record.chapterLv===theme)&&(!place||record.placeId===place));
}

// Places describe the person's legend records, rather than their residence.
export function matchPerson(profile, byId, query='', theme='', place='') {
 const normalize=value=>String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('lv').trim();
 const term=normalize(query),eligible=matchingRecords(profile,byId,theme,place);
 const placeRecords=term?eligible.filter(record=>record.place && normalize(record.place).includes(term)):[];
 const records=!term || (normalize(profile.name).includes(term)||normalize(profile.sortName).includes(term))?eligible:placeRecords;
 return {records,places:[...new Set(placeRecords.map(record=>record.place))].sort((a,b)=>a.localeCompare(b,'lv'))};
}

export function textsHref(base, profile, ids=profile.ids) {
 const params=new URLSearchParams({[profile.role]:profile.id,selection:encodeSelection(ids)});
 return `${base}teksti/?${params}`;
}

// Unknown-person source IDs represent a bucket, not a known identity in the explorers.
// Scope that bucket by exact text IDs so missing-person normalization cannot broaden it.
export function explorationHrefs(base, profile) {
 const networkParams=new URLSearchParams({
  layout:'hierarchical',
  categories:['county','collector','narrator','typeId'].join(','),
  connection:JSON.stringify({kind:'node',field:profile.role,value:profile.unknown?'__unknown__':profile.id}),
 });
 if(profile.unknown){
  const params=new URLSearchParams({selection:encodeSelection(profile.ids)});
  networkParams.set('selection',encodeSelection(profile.ids));
  return {map:`${base}karte/?${params}`,network:`${base}dati/?${networkParams}#network`,overview:`${base}dati/?${params}#overview`};
 }
 networkParams.set(profile.role,profile.id);
 return {
  map:`${base}karte/?${new URLSearchParams({[`${profile.role}Mode`]:'selection',[profile.role]:profile.name})}`,
  network:`${base}dati/?${networkParams}#network`,
  overview:`${base}dati/?${new URLSearchParams({[profile.role]:profile.name})}#overview`,
 };
}

export function sharedPersonSelectionUrl(href, ids) {
 const url=new URL(href);
 for(const key of ['saved','pinned','page'])url.searchParams.delete(key);
 url.searchParams.set('selection',ids.join(','));
 return url.href;
}

// Weighted random sampling without replacement. One score per page load keeps
// filters/pagination stable. Square-root weights favour larger contributions
// without allowing a few prolific collectors to dominate every visit.
export function createDiscoveryOrder(profiles, random=Math.random) {
 return new Map(profiles.map(profile=>{
  const weight=profile.unknown?1:Math.sqrt(Math.max(1,profile.ids.length));
  const draw=Math.max(Number.EPSILON,Math.min(1-Number.EPSILON,random()));
  return [profile.id,-Math.log(draw)/weight];
 }));
}
