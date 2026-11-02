import {legendBranches,legendOverview,legendDataHref} from '../lib/legend-context.js';
type RecordRow={id:string;topic:string;typeLv:string;typeDe:string;titleLv:string;titleDe:string;county:string;placeName:string;collector:string;narrator:string;year:string|null;translated:boolean;translatedEn?:boolean;sources?:{label:string;url:string}[];sourceRaw?:string};
type Payload={base:string;types:any[];metadataLabels:Record<string,Record<string,string>>};
const copy={
 lv:{overview:'Teikas pārskats',network:'Teikas saistību tīkls',overviewHint:'Vienas teikas raksturojums un vieta krājumā.',networkHint:'Izvēlētā teika un citas teikas, ko ar to saista pierakstītājs vai teicējs.',selected:'Izvēlētā teika',related:'saistītas teikas',volume:'Sējums',chapter:'Nodaļa',section:'Apakšnodaļa',position:'Vieta krājumā',only:'Vienīgā teika šajā grupā',oneOf:'Viena no',records:'teikām',openGroup:'Atvērt šīs grupas teikas',metadata:'Teikas raksturojums',place:'Pierakstīšanas vieta',year:'Ieraksta vai avota gads',collector:'Pierakstītājs',narrator:'Teicējs',languages:'Teksta valodas',sources:'Avoti',missing:'Nav norādīts',lv:'Latviešu',de:'Vācu',en:'Angļu',profile:'Atvērt teikas profilu',map:'Atvērt karti',other:'Citas šīs personas teikas',more:'Rādīt vēl',less:'Rādīt mazāk',noOthers:'Citu šīs personas teiku krājumā nav.',noPeople:'Teicējs un pierakstītājs nav norādīti, tāpēc personu saites nevar parādīt.',missingNarrator:'Teicējs nav norādīts.',missingCollector:'Pierakstītājs nav norādīts.',allRelated:'Atvērt saistītās teikas pārlūkā',networkAria:'Saiknes starp izvēlēto teiku, personām un citām viņu teikām'},
 de:{overview:'Übersicht der Sage',network:'Beziehungsnetz der Sage',overviewHint:'Merkmale einer Sage und ihre Stellung in der Sammlung.',networkHint:'Die ausgewählte Sage und weitere Sagen desselben Sammlers oder Erzählers.',selected:'Ausgewählte Sage',related:'verbundene Sagen',volume:'Band',chapter:'Kapitel',section:'Unterkapitel',position:'Stellung in der Sammlung',only:'Die einzige Sage in dieser Gruppe',oneOf:'Eine von',records:'Sagen',openGroup:'Sagen dieser Gruppe öffnen',metadata:'Merkmale der Sage',place:'Aufzeichnungsort',year:'Aufzeichnungs- oder Quellenjahr',collector:'Sammler',narrator:'Erzähler',languages:'Textsprachen',sources:'Quellen',missing:'Nicht angegeben',lv:'Lettisch',de:'Deutsch',en:'Englisch',profile:'Sagenprofil öffnen',map:'Karte öffnen',other:'Weitere Sagen dieser Person',more:'Mehr anzeigen',less:'Weniger anzeigen',noOthers:'Keine weiteren Sagen dieser Person in der Sammlung.',noPeople:'Sammler und Erzähler sind nicht angegeben; Personenverbindungen sind daher nicht verfügbar.',missingNarrator:'Erzähler nicht angegeben.',missingCollector:'Sammler nicht angegeben.',allRelated:'Verbundene Sagen im Browser öffnen',networkAria:'Verbindungen zwischen der ausgewählten Sage, Personen und ihren weiteren Sagen'},
 en:{overview:'Legend overview',network:'Legend relationship network',overviewHint:'One legend’s characteristics and its place in the collection.',networkHint:'The selected legend and other legends connected through its collector or narrator.',selected:'Selected legend',related:'related legends',volume:'Volume',chapter:'Chapter',section:'Subsection',position:'Place in the collection',only:'The only legend in this group',oneOf:'One of',records:'legends',openGroup:'Open legends in this group',metadata:'Legend characteristics',place:'Recording place',year:'Recording or source year',collector:'Collector',narrator:'Narrator',languages:'Text languages',sources:'Sources',missing:'Not recorded',lv:'Latvian',de:'German',en:'English',profile:'Open legend profile',map:'Open map',other:'Other legends from this person',more:'Show more',less:'Show less',noOthers:'No other legends from this person in the collection.',noPeople:'The collector and narrator are not recorded, so person connections are unavailable.',missingNarrator:'Narrator not recorded.',missingCollector:'Collector not recorded.',allRelated:'Open related legends in the browser',networkAria:'Connections between the selected legend, people and their other legends'},
};
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function renderLegendExploration(payload:Payload,id:string,view:string){
 const {base,metadataLabels}=payload;
 const records:RecordRow[]=payload.types.flatMap(type=>type.records.map((record:RecordRow)=>({...record,topic:type.topic,typeLv:type.lv,typeDe:type.de})));
 const context=legendOverview(records,id)!;
 const source=context.source as RecordRow;
 const branches=legendBranches(records,id) as {field:'collector'|'narrator';value:string;records:RecordRow[]}[];
 const root=document.getElementById('ml-dashboard-content')!;
 const expanded=new Set<string>();
 let observer:ResizeObserver|undefined;
 const lang=()=>{const value=document.documentElement.dataset.uiLang;return value==='de'||value==='en'?value:'lv'};
 const title=(record:RecordRow)=>lang()==='de'?(record.titleDe||record.titleLv):record.titleLv;
 const profile=`${base}teksti/${id}/`;
 const href=(record:RecordRow)=>legendDataHref(base,record,'network');
 const groupLink=(params:Record<string,string>)=>`${base}teksti/?${new URLSearchParams(params)}`;
 const mapLink=`${base}karte/?${new URLSearchParams({legend:id,...(source.county?{selectedPlace:source.county}:{})})}`;
 function render(){
  observer?.disconnect();
  const t=copy[lang()];
  document.title=`${view==='network'?t.network:t.overview}: ${title(source)||id} – Teikas`;
  document.getElementById('ml-title-filters')!.replaceChildren();
  root.className='legend-exploration';
  root.innerHTML=`<header class="legend-exploration-heading"><p class="legend-eyebrow">${view==='network'?t.network:t.overview}</p><h2 id="ml-dashboard-title"><a href="${profile}">${esc(title(source)||id)}</a></h2><p class="legend-id">ID ${id}</p><p>${view==='network'?t.networkHint:t.overviewHint}</p><nav class="legend-exploration-actions"><a href="${profile}"><i data-lucide="book-open" aria-hidden="true"></i>${t.profile}</a><a href="${mapLink}"><i data-lucide="map-pin" aria-hidden="true"></i>${t.map}</a></nav></header>${view==='network'?network(t):overview(t)}`;
  (window as any).renderLucideIcons?.();
  if(view==='network'){observer=new ResizeObserver(drawConnections);observer.observe(root.querySelector('.legend-person-network')!);drawConnections();}
 }
 function overview(t:typeof copy.lv){
  const hierarchy:{label:string;value:string;count:number;params:Record<string,string>}[]=[
   {label:t.volume,value:`${source.topic}.`,count:context.volumeCount,params:{volume:source.topic}},
   {label:t.chapter,value:lang()==='de'?source.typeDe:source.typeLv,count:context.chapterCount,params:{section:id.slice(0,4)}},
   {label:t.section,value:title(source),count:context.subsectionCount,params:{section:id.slice(0,6)}},
  ];
  const rows=[['ID',id],[t.place,source.placeName||t.missing],[t.year,source.year||t.missing],[t.collector,metadataLabels.collector[source.collector]||t.missing],[t.narrator,metadataLabels.narrator[source.narrator]||t.missing],[t.languages,[t.lv,...(source.translated?[t.de]:[]),...(source.translatedEn?[t.en]:[])].join(' · ')]];
  const sources=source.sources||[];
  const sourceList=sources.length?`<ul>${sources.map(item=>{let url='';try{const candidate=new URL(item.url);if(['https:','http:'].includes(candidate.protocol))url=candidate.href}catch{}return `<li>${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(item.label)}</a>`:esc(item.label)}</li>`}).join('')}</ul>`:`<p>${esc(source.sourceRaw||t.missing)}</p>`;
  return `<section class="legend-position" aria-labelledby="legend-position-title"><h3 id="legend-position-title">${t.position}</h3><div class="legend-hierarchy">${hierarchy.map(item=>`<article><span>${item.label}</span><h4>${esc(item.value||t.missing)}</h4><p>${item.count===1?t.only:`${t.oneOf} <strong>${item.count}</strong> ${t.records}`}</p><a href="${groupLink(item.params)}">${t.openGroup}<i data-lucide="arrow-right" aria-hidden="true"></i></a></article>`).join('')}</div></section><div class="legend-overview-details"><section><h3>${t.metadata}</h3><dl>${rows.map(([label,value])=>`<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl></section><section><h3>${t.sources}</h3>${sourceList}</section></div>`;
 }
 function network(t:typeof copy.lv){
  const relatedIds=[...new Set(branches.flatMap(branch=>branch.records.map(record=>record.id)))];
  const missingPerson=branches.length===1?`<div class="legend-person-unknown unknown-${branches[0].field==='collector'?'narrator':'collector'}">${branches[0].field==='collector'?t.missingNarrator:t.missingCollector}</div>`:'';
  return `<section aria-label="${t.networkAria}"><p class="legend-network-count"><strong>1</strong> ${t.selected.toLocaleLowerCase(lang())} · <strong>${context.relatedCount}</strong> ${t.related}</p><div class="legend-person-network"><svg class="legend-person-lines" aria-hidden="true"></svg><article class="legend-focal-node" data-legend-node="focal"><span>${t.selected}</span><h3>${esc(title(source)||id)}</h3><small>${id}</small></article><div class="legend-person-branches">${branches.map(branch=>`<section class="legend-person-branch branch-${branch.field}"><header class="legend-person-node" data-legend-node="${branch.field}"><i data-lucide="${branch.field==='collector'?'notebook-pen':'mic'}" aria-hidden="true"></i><div><span>${t[branch.field]}</span><h3>${esc(metadataLabels[branch.field][branch.value]||branch.value)}</h3></div></header><p class="legend-branch-caption">${t.other} (${branch.records.length})</p><ol>${branch.records.slice(0,expanded.has(branch.field)?undefined:6).map(record=>`<li data-legend-node="${branch.field}-${record.id}" data-person-parent="${branch.field}"><a href="${href(record)}"><span>${esc(title(record)||record.id)}</span><small>${record.id}</small></a></li>`).join('')}</ol>${branch.records.length>6?`<button type="button" data-expand-person="${branch.field}" aria-expanded="${expanded.has(branch.field)}">${expanded.has(branch.field)?t.less:`${t.more} (${branch.records.length-6})`}</button>`:''}${!branch.records.length?`<p>${t.noOthers}</p>`:''}</section>`).join('')}${missingPerson}</div>${!branches.length?`<p class="legend-no-people">${t.noPeople}</p>`:''}</div>${relatedIds.length?`<a class="legend-related-link" href="${groupLink({selection:relatedIds.join(',')})}">${t.allRelated}<i data-lucide="arrow-right" aria-hidden="true"></i></a>`:''}</section>`;
 }
 function drawConnections(){
  const canvas=root.querySelector<HTMLElement>('.legend-person-network');if(!canvas)return;
  const svg=canvas.querySelector<SVGSVGElement>('svg')!;
  const bounds=canvas.getBoundingClientRect();
  svg.setAttribute('viewBox',`0 0 ${bounds.width} ${bounds.height}`);
  const rect=(name:string)=>canvas.querySelector<HTMLElement>(`[data-legend-node="${name}"]`)!.getBoundingClientRect();
  const focal=rect('focal');const paths:string[]=[];
  for(const branch of branches){
   const person=rect(branch.field),x1=focal.left+focal.width/2-bounds.left,y1=focal.bottom-bounds.top,x2=person.left+person.width/2-bounds.left,y2=person.top-bounds.top;
   if(matchMedia('(max-width:700px)').matches&&branch.field==='narrator'&&branches.length>1){
    const start=focal.right-bounds.left,sy=focal.top+focal.height/2-bounds.top,end=person.right-bounds.left,ey=person.top+person.height/2-bounds.top,gutter=bounds.width-8;
    paths.push(`<path class="line-narrator" d="M${start},${sy} H${gutter} V${ey} H${end}"/>`);
   }else paths.push(`<path class="line-${branch.field}" d="M${x1},${y1} C${x1},${y1+28} ${x2},${y2-28} ${x2},${y2}"/>`);
   for(const node of canvas.querySelectorAll<HTMLElement>(`[data-person-parent="${branch.field}"]`)){
    const target=node.getBoundingClientRect(),right=branch.field==='narrator',start=(right?person.right:person.left)-bounds.left,end=(right?target.right:target.left)-bounds.left,gutter=(right?Math.max(start,end)+16:Math.min(start,end)-16),sy=person.top+person.height/2-bounds.top,ey=target.top+target.height/2-bounds.top;
    paths.push(`<path class="line-${branch.field}" d="M${start},${sy} H${gutter} V${ey} H${end}"/>`);
   }
  }
  svg.innerHTML=paths.join('');
 }
 root.addEventListener('click',event=>{const button=(event.target as Element).closest<HTMLButtonElement>('[data-expand-person]');if(!button)return;const field=button.dataset.expandPerson!;expanded.has(field)?expanded.delete(field):expanded.add(field);render();root.querySelector<HTMLButtonElement>(`[data-expand-person="${field}"]`)?.focus({preventScroll:true});});
 window.addEventListener('ui-language-change',render);
 render();
}
