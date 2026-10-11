import {buildRelationships,buildHierarchy,relationshipFields,relationshipSelection} from './network-data.js';
import {UNKNOWN} from './statistics.js';
const copy={
  "lv": {
    "overview": "Pārskats",
    "network": "Tīkls",
    "title": "Saiknes kolekcijā",
    "hint": "Izpēti datu kopā norādītās saiknes starp personām, vietām un nodaļām.",
    "filters": "Filtri",
    "layout": "Izkārtojums",
    "free": "Brīvs",
    "hierarchical": "Hierarhisks",
    "bipartite": "Divdaļīgs",
    "left": "Kreisā kategorija",
    "right": "Labā kategorija",
    "limit": "Punkti katrā kategorijā",
    "all": "Visi",
    "labels": "Nosaukumi",
    "contextual": "Atbilstoši kontekstam",
    "nodeSize": "Punktu izmērs",
    "textSize": "Teksta izmērs",
    "fit": "Ietilpināt skatā",
    "zoomIn": "Tuvināt",
    "zoomOut": "Attālināt",
    "fullscreen": "Pilnekrāns",
    "clear": "Notīrīt atlasi",
    "select": "Izvēlies punktu vai saikni",
    "help": "Klikšķini punktu vai līniju, lai skatītu teikas. Velc punktu, lai to pārvietotu; velc fonu, lai pārvietotu skatu.",
    "meaning": "Saiknes rāda ierakstus ar kopīgiem metadatiem. Biezāka līnija nozīmē vairāk teiku, nevis vēsturisku ietekmi.",
    "hierarchyHelp": "Sējums → nodaļa → teikas. Atsevišķas teikas redzamas atlasē ar ne vairāk kā 60 tekstiem.",
    "coverage": "pārstāvētās teikas",
    "nodes": "punkti",
    "links": "saiknes",
    "limited": "Redzamas lielākās kategorijas. Palielini punktu limitu vai sašaurini atlasi, lai skatītu pārējās.",
    "raw": "Vārdi saglabāti avota rakstībā; varianti var parādīties atsevišķi.",
    "selected": "Atlasītā saikne",
    "texts": "Rādīt šos tekstus",
    "allChoices": "Visi",
    "translation": "Tulkojums",
    "unknown": "Nezināms",
    "county": "Vietas",
    "collector": "Pierakstītāji",
    "narrator": "Teicēji",
    "typeId": "Nodaļas",
    "topic": "Sējumi",
    "record": "Teikas",
    "empty": "Šiem filtriem nav saikņu",
    "reset": "Notīrīt filtrus",
    "showFilters": "Rādīt filtrus",
    "hideFilters": "Paslēpt filtrus",
    "legend": "Kategorijas",
    "count": "teikas",
    "shown": "redzami"
  },
  "de": {
    "overview": "Übersicht",
    "network": "Netzwerk",
    "title": "Verbindungen in der Sammlung",
    "hint": "Erkunden Sie dokumentierte Beziehungen zwischen Personen, Orten und Kapiteln.",
    "filters": "Filter",
    "layout": "Anordnung",
    "free": "Frei",
    "hierarchical": "Hierarchisch",
    "bipartite": "Zweigeteilt",
    "left": "Linke Kategorie",
    "right": "Rechte Kategorie",
    "limit": "Knoten je Kategorie",
    "all": "Alle",
    "labels": "Beschriftungen",
    "contextual": "Kontextbezogen",
    "nodeSize": "Knotengröße",
    "textSize": "Textgröße",
    "fit": "Ansicht anpassen",
    "zoomIn": "Vergrößern",
    "zoomOut": "Verkleinern",
    "fullscreen": "Vollbild",
    "clear": "Auswahl aufheben",
    "select": "Knoten oder Verbindung auswählen",
    "help": "Klicken Sie auf Knoten oder Linien, um Sagen zu sehen. Ziehen Sie Knoten zum Verschieben oder den Hintergrund zum Schwenken.",
    "meaning": "Verbindungen zeigen Einträge mit gemeinsamen Metadaten. Dickere Linien bedeuten mehr Sagen, keine historische Einflussnahme.",
    "hierarchyHelp": "Band → Kapitel → Sagen. Einzelne Sagen erscheinen bei höchstens 60 Texten.",
    "coverage": "vertretene Sagen",
    "nodes": "Knoten",
    "links": "Verbindungen",
    "limited": "Die größten Kategorien werden angezeigt. Erhöhen Sie die Knotengrenze oder schränken Sie die Auswahl ein.",
    "raw": "Namen behalten die Quellenschreibweise; Varianten können getrennt erscheinen.",
    "selected": "Ausgewählte Verbindung",
    "texts": "Diese Texte anzeigen",
    "allChoices": "Alle",
    "translation": "Übersetzung",
    "unknown": "Unbekannt",
    "county": "Orte",
    "collector": "Sammler",
    "narrator": "Erzähler",
    "typeId": "Kapitel",
    "topic": "Bände",
    "record": "Sagen",
    "empty": "Keine Verbindungen für diese Filter",
    "reset": "Filter zurücksetzen",
    "showFilters": "Filter anzeigen",
    "hideFilters": "Filter ausblenden",
    "legend": "Kategorien",
    "count": "Sagen",
    "shown": "angezeigt"
  },
  "en": {
    "overview": "Overview",
    "network": "Network",
    "title": "Connections in the collection",
    "hint": "Explore documented links between people, places and chapters.",
    "filters": "Filters",
    "layout": "Layout",
    "free": "Free",
    "hierarchical": "Hierarchical",
    "bipartite": "Bipartite",
    "left": "Left category",
    "right": "Right category",
    "limit": "Nodes per category",
    "all": "All",
    "labels": "Labels",
    "contextual": "Contextual",
    "nodeSize": "Node size",
    "textSize": "Text size",
    "fit": "Fit view",
    "zoomIn": "Zoom in",
    "zoomOut": "Zoom out",
    "fullscreen": "Fullscreen",
    "clear": "Clear selection",
    "select": "Select a node or connection",
    "help": "Click a node or line to see its legends. Drag a node to move it; drag the background to pan.",
    "meaning": "Connections represent records sharing the selected metadata. Thicker lines mean more legends, not historical influence.",
    "hierarchyHelp": "Volume → chapter → legends. Individual legends appear when the displayed set contains at most 60 texts.",
    "coverage": "legends represented",
    "nodes": "nodes",
    "links": "connections",
    "limited": "Largest categories shown. Increase the node limit or narrow the filters to reveal other categories.",
    "raw": "Names retain their source spelling; variants may appear separately.",
    "selected": "Selected connection",
    "texts": "Show these texts",
    "allChoices": "All",
    "translation": "Translation",
    "unknown": "Unknown",
    "county": "Places",
    "collector": "Collectors",
    "narrator": "Narrators",
    "typeId": "Chapters",
    "topic": "Volumes",
    "record": "Legends",
    "empty": "No connections for these filters",
    "reset": "Clear filters",
    "showFilters": "Show filters",
    "hideFilters": "Hide filters",
    "legend": "Categories",
    "count": "legends",
    "shown": "shown"
  }
};
type NetworkOptions={lang:()=> 'lv'|'de'|'en';types:any[];topics:any[];change:()=>void};
export function createNetwork({lang,types,topics,change}:NetworkOptions){
 let layout='bipartite',left='county',right='typeId',limit=24,labels=true,allLabels=false,nodeSize=1,textSize=1,filtersOpen=!matchMedia('(max-width:700px)').matches;
 let selection:any=null,graph:any={nodes:[],edges:[]},sourceRows:any[]=[];
 let zoom=1,pan={x:0,y:0},positions=new Map<string,{x:number;y:number}>();
 let graphKey='',graphChanged=false,drag:any=null;
 const tr=()=>copy[lang()];
 const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 const fieldLabel=(field:string)=>(tr() as any)[field];
 function label(field:string,value:string){
  if(value===UNKNOWN)return tr().unknown;
  if(field==='topic'){const topic=topics.find(t=>t.id===value);return topic?.[lang()]||value;}
  if(field==='typeId'){const type=types.find(t=>t.id===value);return `${lang()==='de'?(type?.de||type?.lv):type?.lv}`;}
  if(field==='record'){const row=sourceRows.find(r=>r.id===value);return (lang()==='de'?(row?.titleDe||row?.titleLv):row?.titleLv)||value;}
  return value;
 }
 const selectedRows=(rows:any[])=>relationshipSelection(rows,selection);
 function read(params:URLSearchParams){
  layout=['free','hierarchical','bipartite'].includes(params.get('layout')!)?params.get('layout')!:'bipartite';
  left=relationshipFields.includes(params.get('left')!)?params.get('left')!:'county';
  right=relationshipFields.includes(params.get('right')!)?params.get('right')!:'typeId';
  if(left===right)right=left==='typeId'?'county':'typeId';
  limit=[12,24,48,10000].includes(Number(params.get('nodes')))?Number(params.get('nodes')):24;
  labels=params.get('labels')!=='0';allLabels=params.get('labels')==='all';nodeSize=Math.min(2,Math.max(.5,Number(params.get('nodeSize'))||1));textSize=Math.min(1.6,Math.max(.7,Number(params.get('labelSize'))||1));
  selection=null;
  try{const parsed=JSON.parse(params.get('connection')||'null');if(parsed?.kind==='node'&&[...relationshipFields,'record'].includes(parsed.field)&&typeof parsed.value==='string')selection={kind:'node',field:parsed.field,value:parsed.value};else if(parsed?.kind==='edge'&&relationshipFields.includes(parsed.left)&&relationshipFields.includes(parsed.right)&&typeof parsed.leftValue==='string'&&typeof parsed.rightValue==='string')selection={kind:'edge',left:parsed.left,right:parsed.right,leftValue:parsed.leftValue,rightValue:parsed.rightValue};}catch{}
  zoom=1;pan={x:0,y:0};graphKey='';
 }
 function write(params:URLSearchParams){
  params.set('layout',layout);params.set('left',left);params.set('right',right);
  if(limit!==24)params.set('nodes',String(limit));if(!labels)params.set('labels','0');else if(allLabels)params.set('labels','all');
  if(nodeSize!==1)params.set('nodeSize',String(nodeSize));if(textSize!==1)params.set('labelSize',String(textSize));
  if(selection)params.set('connection',JSON.stringify(selection));
 }
 function reset(){selection=null;graphKey='';zoom=1;pan={x:0,y:0};}
 function arrange(){
  const height=Math.max(540,Math.max(...[0,1,2].map(side=>graph.nodes.filter((n:any)=>n.side===side).length))*30+80);
  const nextKey=JSON.stringify([layout,left,right,limit,graph.nodes.map((n:any)=>[n.id,n.count]),graph.edges.map((e:any)=>[e.id,e.recordIds.length])]);
  if(nextKey!==graphKey){
   positions=new Map();pan={x:0,y:0};zoom=1;graphKey=nextKey;
   graph.nodes.forEach((node:any)=>{
    const column=graph.nodes.filter((n:any)=>n.side===node.side),index=column.indexOf(node);
    if(layout==='free'){
     const angle=index*2.399963,radius=30+Math.sqrt(index)*24;
     positions.set(node.id,{x:(node.side===0?300:700)+Math.cos(angle)*radius,y:310+Math.sin(angle)*radius});
    }else positions.set(node.id,{x:layout==='hierarchical'?[100,460,830][node.side]:(node.side===0?160:740),y:50+(index+.5)*(height-100)/column.length});
   });
   if(layout==='free'){
    // Deterministic settling, with no perpetual animation or pairwise record graph.
    for(let step=0;step<100;step++){
     for(const edge of graph.edges){const a=positions.get(edge.source)!,b=positions.get(edge.target)!,dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,f=(d-175)*.018/d;a.x+=dx*f;a.y+=dy*f;b.x-=dx*f;b.y-=dy*f;}
     const nodes=graph.nodes;
     for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=positions.get(nodes[i].id)!,b=positions.get(nodes[j].id)!,dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;if(d<48){const f=(48-d)*.08;a.x-=dx/d*f;a.y-=dy/d*f;b.x+=dx/d*f;b.y+=dy/d*f;}}
     for(const node of nodes){const p=positions.get(node.id)!;p.x=Math.max(60,Math.min(800,p.x));p.y=Math.max(40,Math.min(600,p.y));}
    }
   }
  }
  return layout==='free'?640:height;
 }
 function activeNode(node:any){return selection?.kind==='node'&&selection.field===node.field&&selection.value===node.value;}
 function activeEdge(edge:any){
  if(selection?.kind==='node')return [edge.source,edge.target].some(id=>{const n=graph.nodes.find((n:any)=>n.id===id);return activeNode(n);});
  if(selection?.kind!=='edge')return false;
  const a=graph.nodes.find((n:any)=>n.id===edge.source),b=graph.nodes.find((n:any)=>n.id===edge.target);
  return a.field===selection.left&&a.value===selection.leftValue&&b.field===selection.right&&b.value===selection.rightValue;
 }
 const short=(text:string,max=34)=>text.length>max?text.slice(0,max-1)+'…':text;
 function svgContent(){
  return `<g class="ml-network-transform" transform="translate(${pan.x} ${pan.y}) scale(${zoom})"><g class="ml-network-edges">${graph.edges.map((edge:any,index:number)=>{
   const a=positions.get(edge.source)!,b=positions.get(edge.target)!,one=graph.nodes.find((n:any)=>n.id===edge.source),two=graph.nodes.find((n:any)=>n.id===edge.target);
   const path=layout==='free'?`M${a.x},${a.y} L${b.x},${b.y}`:`M${a.x},${a.y} C${(a.x+b.x)/2},${a.y} ${(a.x+b.x)/2},${b.y} ${b.x},${b.y}`;
   const name=`${label(one.field,one.value)} / ${label(two.field,two.value)}: ${edge.recordIds.length} ${tr().count}`;
   return `<g class="ml-network-edge ${activeEdge(edge)?'is-active':''} ${selection&&!activeEdge(edge)?'is-muted':''}"><path d="${path}" stroke-width="${Math.min(7,.6+Math.sqrt(edge.recordIds.length)*.55)}"/><path class="ml-network-edge-hit" d="${path}" role="button" tabindex="0" data-network-edge="${index}" data-tooltip="${esc(name)}" aria-label="${esc(name)}" aria-pressed="${activeEdge(edge)}"></path></g>`;
  }).join('')}</g><g class="ml-network-nodes">${graph.nodes.map((node:any,index:number)=>{
   const p=positions.get(node.id)!,name=label(node.field,node.value),related=activeNode(node)||graph.edges.some((e:any)=>activeEdge(e)&&[e.source,e.target].includes(node.id));
   const radius=(4+Math.min(12,Math.sqrt(node.count)*.7))*nodeSize;
   const labelX=layout==='bipartite'&&node.side===0?-radius-7:radius+7,anchor=layout==='bipartite'&&node.side===0?'end':'start';
   const labelLimit=Math.max(12,Math.floor((layout==='free'?25:layout==='bipartite'&&node.side===0?18:36)/textSize));
   return `<g transform="translate(${p.x} ${p.y})" class="ml-network-node field-${node.field} ${related?'is-active':''} ${selection&&!related?'is-muted':''}" role="button" tabindex="0" data-network-node="${index}" data-tooltip="${esc(name)}: ${node.count} ${tr().count}" aria-label="${esc(name)}: ${node.count} ${tr().count}" aria-pressed="${activeNode(node)}"><circle r="${radius}"/>${labels?`<text x="${labelX}" y="4" text-anchor="${anchor}" font-size="${12*textSize}">${esc(short(name,labelLimit))}</text>`:''}</g>`;
  }).join('')}</g></g>`;
 }
 function render(rows:any[],filterHtml:string){
  sourceRows=rows;graph=layout==='hierarchical'?buildHierarchy(rows,limit):buildRelationships(rows,left,right,limit);
  if(selection&&!selectedRows(rows).length)selection=null;
  const previousKey=graphKey;
  const t=tr(),height=arrange(),categories=layout==='hierarchical'?['topic','typeId',...(graph.nodes.some((n:any)=>n.field==='record')?['record']:[])]:[left,right];
  graphChanged=previousKey!==graphKey;
  const options=(value:string,other:string)=>relationshipFields.map(field=>`<option value="${field}" ${field===value?'selected':''} ${field===other?'disabled':''}>${fieldLabel(field)}</option>`).join('');
  const selected=selectedRows(rows),selectionTitle=selection?.kind==='node'?label(selection.field,selection.value):selection?`${label(selection.left,selection.leftValue)} / ${label(selection.right,selection.rightValue)}`:t.select;
  return `<div class="ml-network-workspace ${filtersOpen?'':'filters-collapsed'}"><aside class="ml-network-filters" ${filtersOpen?'':'hidden'}><h3><i data-lucide="list-filter"></i>${t.filters}</h3>${filterHtml}<button type="button" data-reset-stats><i data-lucide="rotate-ccw"></i>${t.reset}</button><p>${t.raw}</p></aside><section class="ml-network-surface" aria-label="${t.network}"><div class="ml-network-toolbar"><button type="button" data-network-action="filters" aria-expanded="${filtersOpen}" aria-label="${filtersOpen?t.hideFilters:t.showFilters}"><i data-lucide="list-filter"></i></button><label>${t.layout}<select aria-label="${t.layout}" data-network-setting="layout">${['bipartite','free','hierarchical'].map(mode=>`<option value="${mode}" ${mode===layout?'selected':''}>${(t as any)[mode]}</option>`).join('')}</select></label>${layout!=='hierarchical'?`<label>${t.left}<select aria-label="${t.left}" data-network-setting="left">${options(left,right)}</select></label><label>${t.right}<select aria-label="${t.right}" data-network-setting="right">${options(right,left)}</select></label>`:''}<label>${t.limit}<select aria-label="${t.limit}" data-network-setting="limit">${[12,24,48,10000].map(n=>`<option value="${n}" ${limit===n?'selected':''}>${n===10000?t.all:n}</option>`).join('')}</select></label></div><div class="ml-network-tools"><button type="button" data-network-action="labels" aria-pressed="${labels}" data-tooltip="${t.labels}: ${!labels?'–':allLabels?t.all:t.contextual}" aria-label="${t.labels}: ${!labels?'–':allLabels?t.all:t.contextual}"><i data-lucide="${labels?'eye':'eye-off'}"></i></button><label><i data-lucide="circle"></i><span class="sr-only">${t.nodeSize}</span><input type="range" data-network-setting="nodeSize" aria-label="${t.nodeSize}" min=".5" max="2" step=".1" value="${nodeSize}"/></label><label><i data-lucide="type"></i><span class="sr-only">${t.textSize}</span><input type="range" data-network-setting="textSize" aria-label="${t.textSize}" min=".7" max="1.6" step=".1" value="${textSize}"/></label><button type="button" data-network-action="zoomOut" aria-label="${t.zoomOut}" data-tooltip="${t.zoomOut}"><i data-lucide="zoom-out"></i></button><button type="button" data-network-action="zoomIn" aria-label="${t.zoomIn}" data-tooltip="${t.zoomIn}"><i data-lucide="zoom-in"></i></button><button type="button" data-network-action="fit" aria-label="${t.fit}" data-tooltip="${t.fit}"><i data-lucide="scan"></i></button><button type="button" data-network-action="fullscreen" aria-label="${t.fullscreen}" data-tooltip="${t.fullscreen}"><i data-lucide="maximize-2"></i></button><div class="ml-network-legend" aria-label="${t.legend}">${categories.map(field=>`<span class="field-${field}"><b></b>${fieldLabel(field)}</span>`).join('')}</div></div><p class="ml-network-caption">${layout==='hierarchical'?t.hierarchyHelp:t.meaning}</p><div class="ml-network-stage">${rows.length?`<svg class="ml-network-svg layout-${layout} ${allLabels?'labels-all':'labels-contextual'}" role="group" viewBox="0 0 1000 ${height}" style="height:${height}px" aria-label="${t.network}"><rect class="ml-network-background" width="1000" height="${height}"/>${svgContent()}</svg>`:`<div class="ml-zero-state"><strong>${t.empty}</strong><p>${t.reset}</p></div>`}</div><p class="ml-network-coverage" role="status">${graph.represented} / ${rows.length} ${t.coverage} · ${graph.nodes.length} / ${graph.totalNodes} ${t.nodes} ${t.shown} · ${graph.edges.length} ${t.links}${graph.represented<rows.length?`<br>${t.limited}`:''}</p><div class="ml-network-inspector"><div><h3>${esc(selectionTitle)}</h3><p>${selection?`${selected.length} ${t.count}`:t.help}</p></div>${selection?`<div><button type="button" data-network-action="texts"><i data-lucide="list"></i>${t.texts}</button><button type="button" data-network-action="clear"><i data-lucide="x"></i>${t.clear}</button></div>`:''}</div></section></div>`;
 }
 function refreshSVG(root:HTMLElement){const svg=root.querySelector('.ml-network-svg');if(svg){svg.querySelector('.ml-network-transform')?.remove();svg.insertAdjacentHTML('beforeend',svgContent());}}
 function select(root:HTMLElement,index:number,edge=false){
  if(edge){const e=graph.edges[index],a=graph.nodes.find((n:any)=>n.id===e.source),b=graph.nodes.find((n:any)=>n.id===e.target);selection={kind:'edge',left:a.field,right:b.field,leftValue:a.value,rightValue:b.value};if(b.field==='record')selection={kind:'node',field:'record',value:b.value};}
  else{const n=graph.nodes[index];selection=activeNode(n)?null:{kind:'node',field:n.field,value:n.value};}
  change();root.querySelector<HTMLElement>(edge?`[data-network-edge="${index}"]`:`[data-network-node="${index}"]`)?.focus({preventScroll:true});
 }
 function handleClick(root:HTMLElement,target:Element){
  const node=target.closest<HTMLElement>('[data-network-node]'),edge=target.closest<HTMLElement>('[data-network-edge]');
  if(node||edge){select(root,Number(node?.dataset.networkNode??edge?.dataset.networkEdge),!!edge);return true;}
  const action=target.closest<HTMLElement>('[data-network-action]')?.dataset.networkAction;if(!action)return false;
  if(action==='texts')return false;
  if(action==='fullscreen'){const surface=root.querySelector<HTMLElement>('.ml-network-surface')!;if(document.fullscreenElement)document.exitFullscreen?.();else surface.requestFullscreen?.().catch(()=>{});return true;}
  if(action==='zoomIn'||action==='zoomOut'){zoom=Math.max(.3,Math.min(4,zoom*(action==='zoomIn'?1.2:1/1.2)));refreshSVG(root);return true;}
  if(action==='fit'){graphKey='';arrange();refreshSVG(root);return true;}
  if(action==='filters')filtersOpen=!filtersOpen;
  if(action==='clear')selection=null;
  if(action==='labels'){if(!labels){labels=true;allLabels=false;}else if(!allLabels)allLabels=true;else{labels=false;allLabels=false;}}
  change();root.querySelector<HTMLElement>(`[data-network-action="${action}"]`)?.focus({preventScroll:true});return true;
 }
 function handleSetting(root:HTMLElement,target:HTMLInputElement|HTMLSelectElement){
  const setting=target.dataset.networkSetting;if(!setting)return false;
  if(setting==='layout')layout=target.value;
  if(setting==='left')left=target.value;if(setting==='right')right=target.value;
  if(setting==='limit')limit=Number(target.value);
  if(setting==='nodeSize')nodeSize=Number(target.value);if(setting==='textSize')textSize=Number(target.value);
  if(['layout','left','right','limit'].includes(setting))reset();
  change();root.querySelector<HTMLElement>(`[data-network-setting="${setting}"]`)?.focus({preventScroll:true});return true;
 }
 function attach(root:HTMLElement){
  root.addEventListener('keydown',event=>{const target=event.target as HTMLElement;if(target.matches('[data-network-node],[data-network-edge]')&&['Enter',' '].includes(event.key)){event.preventDefault();handleClick(root,target);}});
  root.addEventListener('pointerdown',event=>{
   if(event.button!==0)return;const target=event.target as Element,svg=target.closest<SVGSVGElement>('.ml-network-svg');
   if(!svg||target.closest('[data-network-edge]'))return;
   const node=target.closest<HTMLElement>('[data-network-node]'),index=node?Number(node.dataset.networkNode):null;
   const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const origin=point.matrixTransform(svg.getScreenCTM()!.inverse());
   drag={svg,pointer:event.pointerId,index,origin,start:index===null?{...pan}:{...positions.get(graph.nodes[index].id)!},client:{x:event.clientX,y:event.clientY},moved:false};svg.setPointerCapture(event.pointerId);
  });
  root.addEventListener('pointermove',event=>{
   if(!drag||event.pointerId!==drag.pointer)return;
   if(Math.hypot(event.clientX-drag.client.x,event.clientY-drag.client.y)<5&&!drag.moved)return;
   drag.moved=true;const point=drag.svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const p=point.matrixTransform(drag.svg.getScreenCTM().inverse());
   const dx=p.x-drag.origin.x,dy=p.y-drag.origin.y;
   if(drag.index===null)pan={x:drag.start.x+dx,y:drag.start.y+dy};else positions.set(graph.nodes[drag.index].id,{x:drag.start.x+dx/zoom,y:drag.start.y+dy/zoom});
   refreshSVG(root);
  });
  root.addEventListener('pointerup',event=>{if(!drag)return;const previous=drag;drag=null;if(previous.svg.hasPointerCapture(event.pointerId))previous.svg.releasePointerCapture(event.pointerId);if(previous.moved){event.preventDefault();suppressClick=true;}else if(previous.index!==null){select(root,previous.index);suppressClick=true;}setTimeout(()=>suppressClick=false,0);});
  root.addEventListener('pointercancel',()=>{drag=null;});
 }
 let suppressClick=false;
 return {copy:tr,label,render,read,write,reset,selectedRows,handleClick,handleSetting,attach,get graphChanged(){return graphChanged;},get suppressClick(){return suppressClick;}};
}
