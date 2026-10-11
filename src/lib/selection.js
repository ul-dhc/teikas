// Consecutive source IDs keep corpus selections short enough for static hosting.
// Expand only against known records, never by generating arbitrary numeric ranges.
export function encodeSelection(ids) {
 const sorted=[...new Set(ids)].sort(),parts=[];
 for(let i=0;i<sorted.length;i++){
  const start=sorted[i];let end=start;
  while(i+1<sorted.length&&/^\d+$/.test(end)&&sorted[i+1].length===end.length&&Number(sorted[i+1])===Number(end)+1)end=sorted[++i];
  parts.push(start===end?start:`${start}~${end}`);
 }
 return parts.join(',');
}
export function decodeSelection(value, records) {
 const selected=new Set(),known=new Set(records.map(record=>record.id));
 for(const part of value.split(',').filter(Boolean)){
  const match=part.match(/^(\d+)~(\d+)$/);
  if(match&&match[1].length===match[2].length){
   for(const id of known)if(id.length===match[1].length&&id>=match[1]&&id<=match[2])selected.add(id);
  }else if(known.has(part.trim()))selected.add(part.trim());
 }
 return [...selected];
}
