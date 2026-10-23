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
 if(view==='network') {
  params.set('layout','free');
  params.set('categories','collector,narrator');
  const nodes=[
   ...(record.collector && record.collectorId ? [{field:'collector',value:record.collectorId}] : []),
   ...(record.narrator && record.narratorId ? [{field:'narrator',value:record.narratorId}] : []),
  ];
  if(nodes.length)params.set('connection',JSON.stringify({kind:'nodes',nodes,logic:'any'}));
 }
 return `${base}dati/?${params}#${view}`;
}

export const legendContextHint={
 lv:'Teikas, kas saistītas ar šīs teikas pierakstītāju vai teicēju.',
 de:'Sagen, die mit dem Sammler oder Erzähler dieser Sage verbunden sind.',
 en:'Legends connected through this legend’s collector or narrator.',
};
