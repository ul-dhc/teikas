import { legends, collectorsById, narratorsById, placesById, legendYear, displayPersonName, resolveLegend, sourceLabel } from '../lib/data';

export const topics = [...new Set(legends.map(l=>l.volume))].sort().map(volume=>({id:volume,lv:`${volume}. sējums`,de:`Band ${volume}`,en:`Volume ${volume}`}));
export const metadataLabels:Record<string,Record<string,string>> = {
 county:Object.fromEntries([...placesById.values()].map(p=>[p.id,p.name])),
 collector:Object.fromEntries([...collectorsById.values()].map(p=>[p.id,p.fullName])),
 narrator:Object.fromEntries([...narratorsById.values()].map(p=>[p.id,p.fullName])),
 place:{},
};
const grouped = new Map<string,typeof legends>();
for(const legend of legends){
 const id=`chapter:${legend.volume}:${legend.chapter.lv||'__unknown__'}`;
 if(!grouped.has(id))grouped.set(id,[]);
 grouped.get(id)!.push(legend);
}
// Original network field contract: county=recorded place, typeId=chapter,
// topic=volume and place=primary source. No Norwegian classifications or data.
export const types = [...grouped].map(([id,items])=>{
 const first=items[0];
 return {id,code:`${first.volume}.${first.id.slice(2,4)}`,lv:first.chapter.lv||'Nav norādīts',de:first.chapter.de||first.chapter.lv||'Nicht angegeben',en:first.chapter.lv||'Unknown',topic:first.volume,
 records:items.map(legend=>{
  const collector=collectorsById.get(legend.collectorId),narrator=legend.narratorId?narratorsById.get(legend.narratorId):null;
  const resolved=resolveLegend(legend),source=resolved.primarySources[0]?.source;
  if(source)metadataLabels.place[source.id]=sourceLabel(source);
  return {id:legend.id,sourceTextId:legend.id,county:legend.placeId||'',collector:displayPersonName(collector)?collector!.id:'',narrator:displayPersonName(narrator)?narrator!.id:'',year:legendYear(legend),place:source?.id||'',placeName:resolved.place?.name||'',titleLv:legend.title.lv||legend.id,titleDe:legend.title.de||'',excerptLv:(legend.text.lv||'').slice(0,420),excerptDe:(legend.text.de||'').slice(0,420),translated:!!legend.text.de,translatedEn:!!legend.text.en?.trim(),sources:[...resolved.primarySources,...resolved.secondarySources].map(({source})=>({label:sourceLabel(source),url:source.url||''})),sourceRaw:[legend.primarySourceRaw,legend.secondarySourceRaw].filter(Boolean).join('; '),archiveSignature:legend.originalMetadata||'',sourceUrl:source?.url||''};
 })};
});
