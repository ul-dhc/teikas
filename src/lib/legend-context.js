// Follow documented identities; missing people never link unrelated legends.
export function relatedLegendRecords(records, legendId) {
 const source=records.find(record=>record.id===legendId);
 if(!source)return records;
 const identity=(record,field)=>record[field]?(record[`${field}Id`]??record[field]):'';
 return records.filter(record=>record.id===source.id ||
  (identity(source,'collector') && identity(record,'collector')===identity(source,'collector')) ||
  (identity(source,'narrator') && identity(record,'narrator')===identity(source,'narrator')));
}
export function legendDataHref(base, record, view) {
 const params=new URLSearchParams({legend:record.id});
 return `${base}dati/?${params}#${view}`;
}

// A focal legend stays distinct from the records reached through each person.
export function legendBranches(records, legendId) {
 const source=records.find(record=>record.id===legendId);
 if(!source)return [];
 return ['collector','narrator'].filter(field=>source[field]&&source[field]!=='__unknown__').map(field=>({
  field,value:source[field],records:records.filter(record=>record.id!==legendId&&record[field]===source[field]),
 }));
}
export function legendOverview(records, legendId) {
 const source=records.find(record=>record.id===legendId);
 if(!source)return null;
 const count=predicate=>records.filter(predicate).length;
 return {source,volumeCount:count(record=>record.topic===source.topic),chapterCount:count(record=>record.id.slice(0,4)===source.id.slice(0,4)),subsectionCount:count(record=>record.id.slice(0,6)===source.id.slice(0,6)),relatedCount:new Set(legendBranches(records,legendId).flatMap(branch=>branch.records.map(record=>record.id))).size};
}
