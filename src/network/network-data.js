import {UNKNOWN} from './statistics.js';
export const relationshipFields = ['county','collector','narrator','typeId','topic'];
export const nodeId = (field,value) => JSON.stringify([field,value]);
export function buildRelationships(rows,left='county',right='typeId',limit=24) {
 if(!freeFields.includes(left)||!freeFields.includes(right)||left===right)throw new Error('Choose two different metadata categories');
 const counts = field => {
  const map=new Map();
  for(const row of rows){const value=row[field]||UNKNOWN;map.set(value,(map.get(value)||0)+1);}
  return [...map].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'no',{numeric:true}));
 };
 const leftCounts=counts(left),rightCounts=counts(right);
 const shownLeft=leftCounts.slice(0,limit),shownRight=rightCounts.slice(0,limit);
 const included=new Set([...shownLeft.map(([value])=>nodeId(left,value)),...shownRight.map(([value])=>nodeId(right,value))]);
 const edges=new Map(),represented=new Set();
 for(const row of rows){
  const source=nodeId(left,row[left]||UNKNOWN),target=nodeId(right,row[right]||UNKNOWN);
  if(!included.has(source)||!included.has(target))continue;
  const id=JSON.stringify([source,target]);
  if(!edges.has(id))edges.set(id,{id,source,target,recordIds:[]});
  edges.get(id).recordIds.push(row.id);represented.add(row.id);
 }
 const nodes=[...shownLeft.map(([value,count])=>({id:nodeId(left,value),field:left,value,count,side:0})),...shownRight.map(([value,count])=>({id:nodeId(right,value),field:right,value,count,side:1}))];
 return {nodes,edges:[...edges.values()],represented:represented.size,totalNodes:leftCounts.length+rightCounts.length};
}
export function buildHierarchy(rows,limit=24) {
 const counts=new Map();
 for(const row of rows)counts.set(row.typeId,(counts.get(row.typeId)||0)+1);
 const types=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'no',{numeric:true})).slice(0,limit);
 const included=new Set(types.map(([id])=>id)),shown=rows.filter(row=>included.has(row.typeId));
 const topics=new Map(),edges=new Map();
 const nodes=types.map(([value,count])=>({id:nodeId('typeId',value),field:'typeId',value,count,side:1}));
 for(const row of shown){
  topics.set(row.topic,(topics.get(row.topic)||0)+1);
  const source=nodeId('topic',row.topic),target=nodeId('typeId',row.typeId),id=JSON.stringify([source,target]);
  if(!edges.has(id))edges.set(id,{id,source,target,recordIds:[]});
  edges.get(id).recordIds.push(row.id);
 }
 nodes.unshift(...[...topics].map(([value,count])=>({id:nodeId('topic',value),field:'topic',value,count,side:0})));
 return {nodes,edges:[...edges.values()],represented:shown.length,totalNodes:counts.size+new Set(rows.map(row=>row.topic)).size};
}
export function relationshipSelection(rows,selection) {
 if(!selection)return rows;
 if(selection.kind==='nodes')return rows.filter(row=>selection.logic==='all'?selection.nodes.every(node=>metadataValue(row,node.field)===node.value):selection.nodes.some(node=>metadataValue(row,node.field)===node.value));
 if(selection.kind==='node')return rows.filter(row=>metadataValue(row,selection.field)===selection.value);
 return rows.filter(row=>metadataValue(row,selection.left)===selection.leftValue&&metadataValue(row,selection.right)===selection.rightValue);
}

export const freeFields = [...relationshipFields,'place'];
export const defaultFreeFields = ['county','collector','typeId','topic'];
const metadataValue = (row,field) => field==='translated' ? (row.translated?'translated':'untranslated') : String(row[field] || UNKNOWN);
// Metadata nodes connect directly when they occur in the same legend record.
// Keep exact record IDs behind each weighted connection for text inspection.
export function buildFreeNetwork(rows,fields=defaultFreeFields) {
 const enabled=[...new Set(fields.filter(field=>freeFields.includes(field)))],nodes=new Map(),edges=new Map();
 for(const row of rows){
  const ids=enabled.map((field,side)=>{
   const value=metadataValue(row,field),id=nodeId(field,value);
   if(!nodes.has(id))nodes.set(id,{id,field,value,count:0,side:side+1});
   nodes.get(id).count++;return id;
  });
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
   const source=ids[i],target=ids[j],id=JSON.stringify([source,target]);
   if(!edges.has(id))edges.set(id,{id,source,target,recordIds:[]});
   edges.get(id).recordIds.push(row.id);
  }
 }
 return {nodes:[...nodes.values()],edges:[...edges.values()],represented:enabled.length?rows.length:0,totalNodes:nodes.size};
}
