import {networkPalettes,paletteVariables} from './network-palettes.js';
import {layoutNetwork,nodeRadius,cameraPoint,pinchCamera,echoDistances,scatterNetwork} from './network-layout.js';
import {positionWithMotion,motionAmplitudeScale} from './network-motion.js';
import {buildRelationships,buildFreeNetwork,freeFields,defaultFreeFields,relationshipSelection,nodeConnectionSizes} from './network-data.js';
import {UNKNOWN} from './statistics.js';
import {networkCopy as copy, settingsCopy, extraCopy,nodeSizeCopy} from './copy';
type NetworkOptions={lang:()=> 'lv'|'de'|'en';types:any[];topics:any[];change:()=>void;sync:()=>void;metadataLabels:Record<string,Record<string,string>>};
export function createNetwork({lang,types,topics,change,sync,metadataLabels}:NetworkOptions){
 let layout='free',left='county',right='typeId',limit=10000,labels=true,allLabels=false,nodeSize=1,textSize=1,filtersOpen=!matchMedia('(max-width:700px)').matches;
 let palette='troll',threadBrightness=1,sizeMode='connections';
 let sizeKey='',sizeMetrics=new Map<string,any>();
 let multiSelect=false,selectionLogic='any';
 let scaleControl:string|null=null,redraw:(()=>void)|null=null,pinch:any=null;
 let settingsOpen=false,moving=!matchMedia('(prefers-reduced-motion:reduce)').matches,motion='drift',intensity=1,animation='none',shape='circle',enabledFields=[...defaultFreeFields],clock=0,frame=0,lastFrame=0;
 let selection:any=null,graph:any={nodes:[],edges:[]};
 let revealKey='',revealStarted=0;
 const revealDuration=780;
 let zoom=1,pan={x:0,y:0},positions=new Map<string,{x:number;y:number}>();
 let nodeById=new Map<string,any>();
 let displayedPositions=new Map<string,any>();
 let graphKey='',graphChanged=false,presentation=false,drag:any=null,pendingCamera:any=null;
 const tr=()=>({...copy[lang()],...settingsCopy[lang()]});
 const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 const fieldLabel=(field:string)=>(tr() as any)[field];
 function label(field:string,value:string){
  if(value===UNKNOWN)return tr().unknown;
  if(field==='topic'){const topic=topics.find(t=>t.id===value);return topic?.[lang()]||value;}
  if(field==='typeId'){const type=types.find(t=>t.id===value);return `${type?.code||value} · ${type?.[lang()]||type?.lv||value}`;}
  if(field==='translated')return value==='translated'?(extraCopy[lang()].translated):tr().untranslated;
  return metadataLabels[field]?.[value] || value;
 }
 const selectedRows=(rows:any[])=>relationshipSelection(rows,selection);
 function commit(){
  try{localStorage.setItem('teikas-network-visual',JSON.stringify({motionPaused:moving?'0':'1',motion,intensity,animation,shape,palette,threadBrightness,nodeSize,sizeMode,labelSize:textSize}));}catch{}
  change();
 }
 function read(params:URLSearchParams){
  params=new URLSearchParams(params);
  try{const stored=JSON.parse(localStorage.getItem('teikas-network-visual')||'{}');for(const key of ['motionPaused','motion','intensity','animation','shape','palette','threadBrightness','nodeSize','sizeMode','labelSize'])if(!params.has(key)&&stored[key]!==undefined)params.set(key,String(stored[key]));}catch{}

  layout=['free','hierarchical','bipartite'].includes(params.get('layout')!)?params.get('layout')!:'free';
  left=freeFields.includes(params.get('left')!)?params.get('left')!:'county';
  right=freeFields.includes(params.get('right')!)?params.get('right')!:'typeId';
  if(left===right)right=left==='typeId'?'county':'typeId';
  limit=[12,24,48,10000].includes(Number(params.get('nodes')))?Number(params.get('nodes')):10000;
  labels=params.get('labels')!=='0';allLabels=params.get('labels')==='all';nodeSize=Math.min(2,Math.max(.2,Number(params.get('nodeSize'))||1));textSize=Math.min(3,Math.max(.5,Number(params.get('labelSize'))||1));
  moving=params.get('motionPaused')==='1'?false:!matchMedia('(prefers-reduced-motion:reduce)').matches;
  motion=['drift','orbit','chaos'].includes(params.get('motion')!)?params.get('motion')!:'drift';
  animation=['none','rain','echo','wave'].includes(params.get('animation')!)?params.get('animation')!:'none';
  shape=params.get('shape')==='category'?'category':'circle';
  sizeMode=params.get('sizeMode')==='uniform'?'uniform':'connections';
  threadBrightness=Math.max(0,Math.min(2,Number(params.get('threadBrightness')??1)));if(!Number.isFinite(threadBrightness))threadBrightness=1;
  palette=networkPalettes.some(p=>p.id===params.get('palette'))?params.get('palette')!:'troll';

  intensity=Math.max(.1,Math.min(2,Number(params.get('intensity'))||1));
  enabledFields=params.has('categories')?params.get('categories')!.split(',').filter(f=>freeFields.includes(f)):[...defaultFreeFields];
  multiSelect=params.get('multi')==='1';selectionLogic=params.get('logic')==='all'?'all':'any';
  selection=null;
  try{const parsed=JSON.parse(params.get('connection')||'null');if(parsed?.kind==='nodes'&&Array.isArray(parsed.nodes)&&parsed.nodes.length&&parsed.nodes.every((n:any)=>freeFields.includes(n.field)&&typeof n.value==='string'))selection={kind:'nodes',nodes:parsed.nodes,logic:parsed.logic==='all'?'all':'any'};else if(parsed?.kind==='node'&&freeFields.includes(parsed.field)&&typeof parsed.value==='string')selection={kind:'node',field:parsed.field,value:parsed.value};else if(parsed?.kind==='edge'&&freeFields.includes(parsed.left)&&freeFields.includes(parsed.right)&&typeof parsed.leftValue==='string'&&typeof parsed.rightValue==='string')selection={kind:'edge',left:parsed.left,right:parsed.right,leftValue:parsed.leftValue,rightValue:parsed.rightValue};}catch{}
  pendingCamera=params.has('zoom')?{zoom:Math.max(.35,Math.min(8,Number(params.get('zoom'))||1)),pan:{x:Number(params.get('panX'))||0,y:Number(params.get('panY'))||0}}:null;
  zoom=1;pan={x:0,y:0};graphKey='';
 }
 function write(params:URLSearchParams){
  params.set('layout',layout);params.set('left',left);params.set('right',right);
  if(limit!==10000)params.set('nodes',String(limit));if(!labels)params.set('labels','0');else if(allLabels)params.set('labels','all');
  if(nodeSize!==1)params.set('nodeSize',String(nodeSize));if(textSize!==1)params.set('labelSize',String(textSize));
  params.set('motionPaused',moving?'0':'1');params.set('motion',motion);params.set('animation',animation);params.delete('style');params.set('shape',shape);params.set('palette',palette);params.set('threadBrightness',String(threadBrightness));params.set('intensity',String(intensity));
  params.set('categories',enabledFields.join(','));params.set('sizeMode',sizeMode);
  params.set('zoom',String(zoom));if(pan.x)params.set('panX',String(pan.x));if(pan.y)params.set('panY',String(pan.y));
  if(multiSelect)params.set('multi','1');if(selectionLogic==='all')params.set('logic','all');
  if(selection)params.set('connection',JSON.stringify(selection));
 }
 function reset(){selection=null;graphKey='';zoom=1;pan={x:0,y:0};}
 function arrange(){
  const nextKey=JSON.stringify([layout,left,right,limit,graph.nodes.map((n:any)=>[n.id,n.count]),graph.edges.map((e:any)=>[e.id,e.recordIds.length])]);
  if(nextKey!==graphKey){
   const laidOut=layoutNetwork(graph,layout,layout==='bipartite'?[left,right]:enabledFields);
   graph.nodes=laidOut;nodeById=new Map(laidOut.map((n:any)=>[n.id,n]));
   positions=new Map(laidOut.map((n:any)=>[n.id,{x:n.x,y:n.y}]));pan={x:0,y:0};zoom=layout==='free'?.84:1;graphKey=nextKey;
   if(pendingCamera){zoom=pendingCamera.zoom;pan=pendingCamera.pan;pendingCamera=null;}
  }
  return 570;
 }

 function activeNode(node:any){return selection?.kind==='nodes'?selection.nodes.some((n:any)=>n.field===node.field&&n.value===node.value):selection?.kind==='node'&&selection.field===node.field&&selection.value===node.value;}
 function activeEdge(edge:any){
  if(['node','nodes'].includes(selection?.kind))return [edge.source,edge.target].some(id=>{const n=nodeById.get(id);return activeNode(n);});
  if(selection?.kind!=='edge')return false;
  const a=nodeById.get(edge.source),b=nodeById.get(edge.target);
  return a.field===selection.left&&a.value===selection.leftValue&&b.field===selection.right&&b.value===selection.rightValue;
 }
 function nodeShape(field:string,r:number){
  if(shape==='circle'||['collector','narrator'].includes(field))return `<circle class="node-mark" r="${r}"/>`;
  if(['typeId','year'].includes(field))return `<rect class="node-mark" x="${-r}" y="${-r}" width="${r*2}" height="${r*2}" rx="${Math.max(2,r*.2)}"/>`;
  if(field==='topic')return `<polygon class="node-mark" points="0,${-r} ${r*.92},${r*.82} ${-r*.92},${r*.82}"/>`;
  if(['county','place','translated'].includes(field))return `<path class="node-mark" d="M${-r*.88} ${-r*.5} L0 ${-r} L${r*.88} ${-r*.5} L${r*.88} ${r*.5} L0 ${r} L${-r*.88} ${r*.5} Z"/>`;
  return `<path class="node-mark" d="M0 ${-r*1.3} L${r*1.3} 0 L0 ${r*1.3} L${-r*1.3} 0 Z"/>`;
 }
 function svgContent(){
  const relatedIds=new Set<string>();for(const e of graph.edges)if(activeEdge(e)){relatedIds.add(e.source);relatedIds.add(e.target);}

  const echo=echoDistances(graph,graph.nodes.filter((n:any)=>activeNode(n)||(selection?.kind==='edge'&&relatedIds.has(n.id))).map((n:any)=>n.id));
  return `<g class="ml-network-transform" ><g class="ml-network-edges">${(graph.edges.length>500?[]:graph.edges).map((edge:any,index:number)=>{
   const a=cameraPoint(positions.get(edge.source)!,zoom,pan),b=cameraPoint(positions.get(edge.target)!,zoom,pan),one=nodeById.get(edge.source),two=nodeById.get(edge.target);
   const path=`M${a.x},${a.y} L${b.x},${b.y}`;
   const name=`${label(one.field,one.value)} / ${label(two.field,two.value)}: ${edge.recordIds.length} ${tr().count}`;
   return `<g style="--thread-source-light:var(--network-${one.field}-light);--thread-source-dark:var(--network-${one.field}-dark);--thread-color:${layout==='free'?'color-mix(in srgb,color-mix(in srgb,var(--thread-source) 50%,var(--node-color)) 80%,var(--ink))':layout==='bipartite'&&palette==='troll'?'var(--network-bipartite-thread)':'var(--node-color)'};--wave-delay:${-((a.x+b.x)/2/900)*4.8}s" class="field-${two.field} ml-network-edge ${activeEdge(edge)?'is-active':''} ${selection&&!activeEdge(edge)?'is-muted':''}"><path class="ml-edge-base" pathLength="100" d="${path}" stroke-width="${activeEdge(edge)?Math.min(1.65,.45+Math.sqrt(edge.recordIds.length)*.32):.48}"/>${layout!=='free'||animation==='rain'?`<path class="ml-edge-flow" d="${path}" pathLength="100" style="--rain-duration:${4.4+(index%5)*.32}s;--rain-delay:${-(index%9)*.43}s"/>`: ''}<path class="ml-network-edge-hit" d="${path}" role="button" tabindex="0" data-network-edge="${index}" aria-label="${esc(name)}" aria-pressed="${activeEdge(edge)}" data-tooltip="${esc(name)}"></path></g>`;
  }).join('')}</g><g class="ml-network-nodes">${graph.nodes.map((node:any,index:number)=>{
   const p=cameraPoint(positions.get(node.id)!,zoom,pan),name=label(node.field,node.value),related=activeNode(node)||relatedIds.has(node.id);
   const radius=nodeRadius(node,layout,sizeMode)*nodeSize;
   const column=graph.nodes.filter((n:any)=>n.field===node.field),diagonal=layout==='hierarchical'&&column.length>10;
   const labelX=layout==='bipartite'?(node.side===0?-radius-8:radius+8):layout==='hierarchical'?(diagonal?radius+6:0):(p.x<450?radius+7:-radius-7);
   const labelY=layout==='hierarchical'?-radius-8:4,anchor=layout==='bipartite'?(node.side===0?'end':'start'):layout==='hierarchical'?(diagonal?'start':'middle'):(p.x<450?'start':'end');

   return `<g transform="translate(${p.x} ${p.y})" style="--wave-delay:${-(p.x/900)*4.8}s;--echo-delay:${Math.min(echo.get(node.id)||0,6)*.14}s" class="ml-network-node field-${node.field} ${selection&&echo.has(node.id)?'has-echo-path':''} ${activeNode(node)?'is-selected':''} ${related?'is-active':''} ${selection&&!related?'is-muted':''}" role="button" tabindex="0" data-network-node="${index}" aria-label="${esc(name)}: ${node.count} ${tr().count}" aria-pressed="${activeNode(node)}" data-tooltip="${esc(name)}: ${node.count} ${tr().count}"><g class="node-depth"><circle class="node-hit-target" r="${Math.max(radius,7)}"/>${nodeShape(node.field,radius)}</g>${labels?`<text x="${labelX}" y="${labelY}" ${diagonal?`transform="rotate(-45 ${labelX} ${labelY})"`: ''} text-anchor="${anchor}" font-size="${(layout==='bipartite'?5:8)*textSize}">${esc(name)}</text>`:''}</g>`;
  }).join('')}</g></g>`;
 }
 function render(rows:any[],filterHtml:string,textsOpen=false,downloadHtml=''){
  cancelAnimationFrame(frame);graph=layout==='free'?buildFreeNetwork(rows,enabledFields):layout==='hierarchical'?buildFreeNetwork(rows,enabledFields):buildRelationships(rows,left,right,limit);nodeById=new Map(graph.nodes.map((n:any)=>[n.id,n]));
  const degrees=new Map<string,number>();for(const edge of graph.edges)for(const id of [edge.source,edge.target])degrees.set(id,(degrees.get(id)||0)+edge.recordIds.length);for(const node of graph.nodes)node.degree=degrees.get(node.id)||0;
  if(selection?.kind==='nodes'){selection.nodes=selection.nodes.filter((n:any)=>graph.nodes.some((node:any)=>node.field===n.field&&node.value===n.value));if(!selection.nodes.length)selection=null;}else if(selection&&!selectedRows(rows).length)selection=null;
  const previousKey=graphKey;
  const nextSizeKey=rows.map(row=>row.id).join(',');
  if(sizeKey!==nextSizeKey){sizeKey=nextSizeKey;sizeMetrics=nodeConnectionSizes(rows);}
  for(const node of graph.nodes)Object.assign(node,sizeMetrics.get(node.id));
  const t=tr(),height=arrange(),categories=layout!=='bipartite'?enabledFields:[left,right];
  graphChanged=previousKey!==graphKey;
  const options=(value:string,other:string)=>freeFields.map(field=>`<option value="${field}" ${field===value?'selected':''} ${field===other?'disabled':''}>${fieldLabel(field)}</option>`).join('');
  const selected=selectedRows(rows),selectionTitle=selection?.kind==='nodes'?selection.nodes.map((n:any)=>label(n.field,n.value)).join(' / '):selection?.kind==='node'?label(selection.field,selection.value):selection?`${label(selection.left,selection.leftValue)} / ${label(selection.right,selection.rightValue)}`:t.select;
  return `<div style="${paletteVariables(palette)};--thread-brightness:${threadBrightness}" class="ml-network-workspace ${filtersOpen?'':'filters-collapsed'} ${presentation?'is-presentation':''}" ${presentation?`role="dialog" aria-modal="true" aria-label="${t.network}"`: ''}><button class="ml-network-filter-scrim" data-network-action="filters" aria-label="${t.hideFilters}" ${filtersOpen?'':'hidden'}></button><aside class="platform-filter-panel ml-network-filters" ${filtersOpen?'':'hidden'}><h3><i data-lucide="list-filter"></i>${t.filters}<button class="ml-mobile-filter-close" data-network-action="filters" aria-label="${t.hideFilters}"><i data-lucide="chevron-left"></i></button></h3>${layout!=='bipartite'?`<fieldset class="ml-network-categories"><legend>${t.show}</legend>${freeFields.map(field=>`<button type="button" class="ml-layer-chip field-${field}" data-network-action="category-${field}" aria-pressed="${enabledFields.includes(field)}"><b></b>${fieldLabel(field)}</button>`).join('')}</fieldset>`:''}${filterHtml}<button type="button" data-reset-stats><i data-lucide="rotate-ccw"></i>${t.reset}</button>${downloadHtml}</aside><section class="ml-network-surface" aria-label="${t.network}"><div class="ml-network-toolbar"><button type="button" data-network-action="filters" aria-expanded="${filtersOpen}" aria-label="${filtersOpen?t.hideFilters:t.showFilters}"><i data-lucide="list-filter"></i></button><label>${t.layout}<select aria-label="${t.layout}" data-network-setting="layout">${['bipartite','free','hierarchical'].map(mode=>`<option value="${mode}" ${mode===layout?'selected':''}>${(t as any)[mode]}</option>`).join('')}</select></label>${layout==='bipartite'?`<label>${t.left}<select aria-label="${t.left}" data-network-setting="left">${options(left,right)}</select></label><label>${t.right}<select aria-label="${t.right}" data-network-setting="right">${options(right,left)}</select></label>`:''}<button type="button" data-network-action="settings" aria-expanded="${settingsOpen}" aria-controls="ml-network-settings"><i data-lucide="settings-2"></i><span class="sr-only">${t.settings}</span></button><div class="ml-network-tools"><button type="button" data-network-action="motion" aria-pressed="${moving}" aria-label="${moving?t.static:t.dynamic}"><i data-lucide="${moving?'pause':'play'}"></i></button><button type="button" data-network-action="labels" data-label-mode="${!labels?'off':allLabels?'all':'active'}" aria-pressed="${!labels?'false':allLabels?'true':'mixed'}" data-tooltip="${t.labels}: ${!labels?t.labelsOff:allLabels?t.all:t.contextual}" aria-label="${t.labels}: ${!labels?t.labelsOff:allLabels?t.all:t.contextual}"><i data-lucide="${!labels?'eye-off':'eye'}"></i></button>${scalePicker('nodeSize',t.nodeSize,nodeSize,.2,2,'circle')}${scalePicker('textSize',t.textSize,textSize,.5,3,'type')}<button type="button" data-network-action="scatter" aria-label="${extraCopy[lang()].scatter}" data-tooltip="${extraCopy[lang()].scatter}"><i data-lucide="chart-scatter"></i></button><button type="button" data-network-action="fit" aria-label="${t.fit}" data-tooltip="${t.fit}"><i data-lucide="rotate-ccw"></i></button><button type="button" data-network-action="zoomOut" aria-label="${t.zoomOut}" data-tooltip="${t.zoomOut}"><i data-lucide="zoom-out"></i></button><output aria-label="Zoom">${Math.round(zoom*100)}%</output><button type="button" data-network-action="zoomIn" aria-label="${t.zoomIn}" data-tooltip="${t.zoomIn}"><i data-lucide="zoom-in"></i></button><button type="button" data-copy-stats aria-label="${extraCopy[lang()].share}" data-tooltip="${extraCopy[lang()].share}"><i data-lucide="link"></i></button></div><div class="ml-network-legend shape-${shape}" aria-label="${t.legend}">${categories.map(field=>`<span class="field-${field}"><b></b>${fieldLabel(field)}</span>`).join('')}</div></div><div class="ml-network-stage">${graph.edges.length>500?'<canvas class="ml-network-link-canvas" width="2000" height="1280" aria-hidden="true"></canvas>':''}${rows.length?`<svg class="ml-network-svg layout-${layout} ${graph.nodes.length>500?'is-dense':''} style-standard ${selection?'has-selection':''} animation-${animation} ${moving?'':'motion-paused'} ${allLabels?'labels-all':'labels-contextual'}" role="group" viewBox="0 0 900 ${height}" style="height:${height}px" aria-label="${t.network}"><rect class="ml-network-background" width="900" height="${height}"/>${svgContent()}</svg>`:`<div class="ml-zero-state"><strong>${t.empty}</strong><p>${t.reset}</p></div>`}<button type="button" class="ml-network-fullscreen" data-network-action="fullscreen" aria-label="${presentation?t.exitFullscreen:t.fullscreen}" data-tooltip="${presentation?t.exitFullscreen:t.fullscreen}"><i data-lucide="${presentation?'minimize-2':'maximize-2'}"></i></button></div><p class="ml-network-coverage" role="status">${graph.represented} / ${rows.length} ${t.coverage} · ${graph.nodes.length} / ${graph.totalNodes} ${t.nodes} ${t.shown} · ${graph.edges.length} ${t.links}${graph.represented<rows.length?`<br>${t.limited}`:''}</p><p class="ml-network-caption">${layout==='free'?t.freeHelp:layout==='hierarchical'?t.hierarchyHelp:t.meaning}</p><div class="ml-network-inspector"><div><h3>${esc(selectionTitle)}</h3><p>${selection?`${selected.length} ${t.count}`:t.help}</p></div><div><button type="button" data-network-action="texts" aria-expanded="${textsOpen}"><i data-lucide="list"></i>${selection?t.texts:extraCopy[lang()].texts} <b>${selected.length}</b></button>${selection?`<button type="button" data-network-action="clear"><i data-lucide="x"></i>${t.clear}</button>`:''}</div></div></section>${settingsPanel()}</div>`;
 }
 function scalePicker(key:string,title:string,value:number,min:number,max:number,icon:string){
  return `<div class="ml-network-scale"><button data-network-action="scale-${key}" aria-label="${title}" data-tooltip="${title}: ${Math.round(value*100)}%" aria-expanded="${scaleControl===key}" aria-controls="network-${key}"><i data-lucide="${icon}"></i></button>${scaleControl===key?`<div id="network-${key}" class="ml-network-scale-popover"><label>${title}<input type="range" data-network-setting="${key}" aria-label="${title}" min="${min}" max="${max}" step=".1" value="${value}"/></label><output>${Math.round(value*100)}%</output></div>`:''}</div>`;
 }
 function settingsPanel(){
  const t=tr(),sizing=nodeSizeCopy[lang()],help=extraCopy[lang()].motionHelp;
  const picker=(key:string,values:string[],value:string)=>`<select data-network-setting="${key}" aria-label="${(t as any)[key]}">${values.map(v=>`<option value="${v}" ${value===v?'selected':''}>${(t as any)[v]}</option>`).join('')}</select>`;
  const animationHelp=extraCopy[lang()].animationHelp;
  const buttons=(key:string,values:string[],current:string)=>`<div class="ml-network-segmented">${values.map(v=>`<button data-network-action="${key}-${v}" aria-pressed="${v===current}">${key==='moving'?`<i data-lucide="${v==='dynamic'?'play':'pause'}"></i>`:''}${(t as any)[v]}</button>`).join('')}</div>`;
  return `${settingsOpen?`<button class="ml-network-settings-scrim" data-network-action="settings" aria-label="${t.close}"></button>`:''}<aside id="ml-network-settings" class="ml-network-settings" role="dialog" aria-modal="false" ${settingsOpen?'':'hidden'} aria-label="${t.settings}"><header><div><span>${'Teikas'}</span><h3>${t.settings}</h3></div><button data-network-action="settings" aria-label="${t.close}"><i data-lucide="x"></i></button></header><fieldset><legend>${lang()==='lv'?'Mezglu atlase':lang()==='de'?'Knotenauswahl':'Node selection'}</legend><label class="ml-network-multi"><input type="checkbox" data-network-setting="multi" ${multiSelect?'checked':''}/>${extraCopy[lang()].multi}</label>${multiSelect?`<label class="ml-network-filter-field">${extraCopy[lang()].match}<select data-network-setting="logic" aria-label="${extraCopy[lang()].match}"><option value="any" ${selectionLogic==='any'?'selected':''}>${extraCopy[lang()].any}</option><option value="all" ${selectionLogic==='all'?'selected':''}>${extraCopy[lang()].every}</option></select></label>`:''}</fieldset><fieldset><legend>${sizing.label}</legend><select data-network-setting="sizeMode" aria-label="${sizing.label}"><option value="uniform" ${sizeMode==='uniform'?'selected':''}>${sizing.uniform}</option><option value="connections" ${sizeMode==='connections'?'selected':''}>${sizing.connections}</option></select><p>${sizing.hint}</p></fieldset><fieldset class="ml-palette-section"><legend>${extraCopy[lang()].palette}</legend><div class="ml-palette-picker">${networkPalettes.map(p=>`<button type="button" data-network-action="palette-${p.id}" aria-pressed="${palette===p.id}"><span class="ml-palette-swatches" aria-hidden="true">${p.light.map((color,i)=>`<b style="--swatch-light:${color};--swatch-dark:${p.dark[i]}"></b>`).join('')}</span><span>${p.name}</span><i data-lucide="check"></i></button>`).join('')}</div></fieldset><fieldset class="ml-mobile-scale-setting"><legend>${t.nodeSize}</legend><input type="range" min=".2" max="2" step=".1" value="${nodeSize}" data-network-setting="nodeSize" aria-label="${t.nodeSize}"/></fieldset><fieldset class="ml-mobile-scale-setting"><legend>${t.textSize}</legend><input type="range" min=".5" max="3" step=".1" value="${textSize}" data-network-setting="textSize" aria-label="${t.textSize}"/></fieldset><fieldset><legend>${t.movement}</legend>${buttons('moving',['dynamic','static'],moving?'dynamic':'static')}<p>${t.motionHelp}</p></fieldset><fieldset><legend>${t.motion}</legend>${picker('motion',['drift','orbit','chaos'],motion)}<label class="ml-motion-intensity"><span>${t.intensity}<output>${Math.round(intensity*100)}%</output></span><input type="range" min=".1" max="2" step=".05" value="${intensity}" data-network-setting="intensity" aria-label="${t.intensity}"/></label><p>${(help as any)[motion]}</p></fieldset><fieldset><legend>${extraCopy[lang()].brightness}</legend><label class="ml-motion-intensity"><span><output>${Math.round(threadBrightness*100)}%</output></span><input type="range" min="0" max="2" step=".05" value="${threadBrightness}" data-network-setting="threadBrightness" aria-label="${extraCopy[lang()].brightness}"/></label></fieldset><fieldset><legend>${t.animation}</legend>${picker('animation',['none','rain','echo','wave'],animation)}<p>${(animationHelp as any)[animation]}</p></fieldset><fieldset><legend>${t.shape}</legend>${buttons('shape',['category','circle'],shape)}</fieldset><button data-network-action="defaults"><i data-lucide="rotate-ccw"></i>${t.defaults}</button></aside>`;
 }
 function updateCamera(root:HTMLElement){root.querySelector('.ml-network-tools>output')!.textContent=`${Math.round(zoom*100)}%`;redraw?.();sync();}

 function refreshSVG(root:HTMLElement){const svg=root.querySelector('.ml-network-svg');if(svg){svg.querySelector('.ml-network-transform')?.remove();svg.insertAdjacentHTML('beforeend',svgContent());mount(root);}}
 function select(root:HTMLElement,index:number,edge=false,additive=false){
  if(edge){const e=graph.edges[index],a=nodeById.get(e.source),b=nodeById.get(e.target);selection={kind:'edge',left:a.field,right:b.field,leftValue:a.value,rightValue:b.value};if(b.field==='record')selection={kind:'node',field:'record',value:b.value};}
  else{const n=graph.nodes[index];if(multiSelect||additive){const chosen=selection?.kind==='nodes'?[...selection.nodes]:selection?.kind==='node'?[{field:selection.field,value:selection.value}]:[];const found=chosen.findIndex((v:any)=>v.field===n.field&&v.value===n.value);if(found>=0)chosen.splice(found,1);else chosen.push({field:n.field,value:n.value});selection=chosen.length?{kind:'nodes',nodes:chosen,logic:selectionLogic}:null;}else selection=activeNode(n)?null:{kind:'node',field:n.field,value:n.value};}
  commit();root.querySelector<HTMLElement>(edge?`[data-network-edge="${index}"]`:`[data-network-node="${index}"]`)?.focus({preventScroll:true});
 }
 function handleClick(root:HTMLElement,target:Element,event?:MouseEvent){
  if(event&&graph.edges.length>500&&target.matches('.ml-network-background,.ml-network-svg')){
   const svg=root.querySelector<SVGSVGElement>('.ml-network-svg')!,point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
   const p=point.matrixTransform(svg.getScreenCTM()!.inverse()),x=450+(p.x-450-pan.x)/zoom,y=285+(p.y-285-pan.y)/zoom;
   let distance=3/zoom,index=-1;graph.edges.forEach((e:any,i:number)=>{const a=displayedPositions.get(e.source)||positions.get(e.source),b=displayedPositions.get(e.target)||positions.get(e.target),dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(x-a.x-t*dx,y-a.y-t*dy);if(d<distance){distance=d;index=i;}});
   if(index>=0){select(root,index,true);return true;}
  }

  const node=target.closest<HTMLElement>('[data-network-node]'),edge=target.closest<HTMLElement>('[data-network-edge]');
  if(node||edge){select(root,Number(node?.dataset.networkNode??edge?.dataset.networkEdge),!!edge,!!event?.shiftKey);return true;}
  if(selection&&target.matches('.ml-network-background,.ml-network-svg,.ml-network-stage')){selection=null;commit();return true;}
  const action=target.closest<HTMLElement>('[data-network-action]')?.dataset.networkAction;if(!action)return false;
  if(action==='texts'){presentation=false;return false;}
  if(action==='fullscreen'){presentation=!presentation;settingsOpen=false;scaleControl=null;commit();root.querySelector<HTMLElement>('[data-network-action="fullscreen"]')?.focus({preventScroll:true});return true;}
  if(action==='zoomIn'||action==='zoomOut'){zoom=Math.max(.35,Math.min(8,zoom*(action==='zoomIn'?1.35:1/1.35)));updateCamera(root);return true;}
  if(action==='fit'){clock=0;graphKey='';arrange();refreshSVG(root);return true;}
  if(action.startsWith('category-')){const field=action.slice(9);enabledFields=enabledFields.includes(field)?enabledFields.filter(f=>f!==field):[...enabledFields,field];reset();}
  if(action==='settings'){settingsOpen=!settingsOpen;scaleControl=null;}
  if(action.startsWith('scale-')){const key=action.slice(6);scaleControl=scaleControl===key?null:key;}
  if(action.startsWith('palette-')){const next=action.slice(8);if(networkPalettes.some(p=>p.id===next))palette=next;}
  if(action.startsWith('moving-'))moving=action==='moving-dynamic';
  if(action.startsWith('shape-'))shape=action.slice(6);
  if(action==='scatter'){positions=scatterNetwork(graph,positions,layout,nodeSize);}
  if(action==='motion')moving=!moving;
  if(action==='defaults'){multiSelect=false;selectionLogic='any';scaleControl=null;clock=0;moving=!matchMedia('(prefers-reduced-motion:reduce)').matches;motion='drift';intensity=1;animation='none';shape='circle';palette='troll';threadBrightness=1;sizeMode='connections';nodeSize=1;textSize=1;labels=true;allLabels=false;}
  if(action==='filters')filtersOpen=!filtersOpen;
  if(action==='clear')selection=null;
  if(action==='labels'){if(!labels){labels=true;allLabels=false;}else if(!allLabels)allLabels=true;else{labels=false;allLabels=false;}}
  commit();const focusTarget=action==='filters'?(filtersOpen?'.ml-network-filters .ml-mobile-filter-close':'.ml-network-toolbar [data-network-action="filters"]'):action==='settings'?'[aria-controls="ml-network-settings"]':`[data-network-action="${action}"]`;root.querySelector<HTMLElement>(focusTarget)?.focus({preventScroll:true});return true;
 }
 function handleSetting(root:HTMLElement,target:HTMLInputElement|HTMLSelectElement){
  const setting=target.dataset.networkSetting;if(!setting)return false;
  if(setting==='multi')multiSelect=(target as HTMLInputElement).checked;
  if(setting==='logic'){selectionLogic=target.value;if(selection?.kind==='nodes')selection.logic=selectionLogic;}
  if(setting.startsWith('category-')){const field=setting.slice(9);enabledFields=(target as HTMLInputElement).checked?[...enabledFields,field]:enabledFields.filter(f=>f!==field);reset();}
  if(setting==='motion'){clock=0;}
  if(setting==='moving')moving=target.value==='1';if(setting==='motion')motion=target.value;if(setting==='intensity')intensity=Number(target.value);if(setting==='animation')animation=target.value;if(setting==='shape')shape=target.value;
  if(setting==='layout')layout=target.value;
  if(setting==='sizeMode')sizeMode=target.value==='uniform'?'uniform':'connections';
  if(setting==='left')left=target.value;if(setting==='right')right=target.value;
  if(setting==='limit')limit=Number(target.value);
  if(setting==='threadBrightness')threadBrightness=Number(target.value);
  if(setting==='nodeSize')nodeSize=Number(target.value);if(setting==='textSize')textSize=Number(target.value);
  if(['layout','left','right','limit'].includes(setting))reset();
  commit();root.querySelector<HTMLElement>(`[data-network-setting="${setting}"]`)?.focus({preventScroll:true});return true;
 }
 function attach(root:HTMLElement){
  root.addEventListener('input',event=>{
   const input=event.target as HTMLInputElement;if(input.dataset.networkSetting!=='threadBrightness')return;
   threadBrightness=Number(input.value);root.querySelector<HTMLElement>('.ml-network-workspace')?.style.setProperty('--thread-brightness',String(threadBrightness));
   const output=input.closest('label')?.querySelector('output');if(output)output.textContent=Math.round(threadBrightness*100)+'%';redraw?.();sync();
  });
  const graphPoint=(svg:SVGSVGElement,x:number,y:number)=>{const matrix=svg.getScreenCTM();if(!matrix)return null;const point=svg.createSVGPoint();point.x=x;point.y=y;return point.matrixTransform(matrix.inverse());};
  root.addEventListener('wheel',event=>{
   const svg=(event.target as Element).closest<SVGSVGElement>('.ml-network-svg');if(!svg)return;
   event.preventDefault();
   zoom=Math.max(.35,Math.min(8,zoom*(event.ctrlKey?Math.exp(-event.deltaY*.01):event.deltaY>0?.86:1.16)));updateCamera(root);
  },{passive:false});
  root.addEventListener('touchstart',event=>{
   const svg=(event.target as Element).closest<SVGSVGElement>('.ml-network-svg');if(!svg||event.touches.length!==2)return;
   event.preventDefault();const [first,second]=Array.from(event.touches),midpoint=graphPoint(svg,(first.clientX+second.clientX)/2,(first.clientY+second.clientY)/2);if(!midpoint)return;
   pinch={svg,midpoint,distance:Math.hypot(second.clientX-first.clientX,second.clientY-first.clientY),zoom,pan:{...pan}};
   if(drag?.svg.hasPointerCapture(drag.pointer))drag.svg.releasePointerCapture(drag.pointer);drag=null;
  },{passive:false});
  root.addEventListener('touchmove',event=>{
   if(!pinch)return;event.preventDefault();if(event.touches.length!==2)return;
   const [first,second]=Array.from(event.touches),midpoint=graphPoint(pinch.svg,(first.clientX+second.clientX)/2,(first.clientY+second.clientY)/2);if(!midpoint)return;
   const next=pinchCamera(pinch,midpoint,Math.hypot(second.clientX-first.clientX,second.clientY-first.clientY));zoom=next.zoom;pan=next.pan;updateCamera(root);
  },{passive:false});
  root.addEventListener('touchend',event=>{if(pinch){if(event.cancelable)event.preventDefault();suppressClick=true;if(!event.touches.length){pinch=null;setTimeout(()=>suppressClick=false,200);}}});
  root.addEventListener('touchcancel',()=>{pinch=null;});
  document.addEventListener('click',event=>{
   const target=event.target as Element;
   if(scaleControl&&!target.closest('.ml-network-scale')){scaleControl=null;commit();}
   if(!settingsOpen||!root.isConnected||target.closest('#ml-network-settings,[data-network-action="settings"]'))return;
   settingsOpen=false;commit();
  });
  root.addEventListener('keydown',event=>{if(scaleControl&&event.key==='Escape'){event.preventDefault();const previous=scaleControl;scaleControl=null;commit();root.querySelector<HTMLElement>(`[data-network-action="scale-${previous}"]`)?.focus();return;}if(settingsOpen&&event.key==='Escape'){event.preventDefault();settingsOpen=false;commit();root.querySelector<HTMLElement>('[aria-controls="ml-network-settings"]')?.focus();return;}if(presentation&&event.key==='Tab'){const items=[...root.querySelectorAll<HTMLElement>('.ml-network-workspace button:not(:disabled),.ml-network-workspace [tabindex="0"],.ml-network-workspace select,.ml-network-workspace input')].filter(el=>el.tabIndex>=0&&!el.closest('[hidden],[inert]')&&el.getClientRects().length>0);if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items.at(-1)?.focus();}else if(!event.shiftKey&&document.activeElement===items.at(-1)){event.preventDefault();items[0]?.focus();}}if(presentation&&filtersOpen&&matchMedia('(max-width:850px)').matches&&event.key==='Escape'){event.preventDefault();filtersOpen=false;commit();root.querySelector<HTMLElement>('.ml-network-toolbar [data-network-action="filters"]')?.focus({preventScroll:true});return;}if(presentation&&event.key==='Escape'){event.preventDefault();presentation=false;commit();root.querySelector<HTMLElement>('[data-network-action="fullscreen"]')?.focus({preventScroll:true});return;}const target=event.target as HTMLElement;if(target.matches('[data-network-node],[data-network-edge]')&&['Enter',' '].includes(event.key)){event.preventDefault();if(target.hasAttribute('data-network-node'))select(root,Number(target.dataset.networkNode),false,event.shiftKey);else handleClick(root,target);}});
  root.addEventListener('pointerdown',event=>{
   suppressClick=false;
   if(event.button!==0||pinch)return;const target=event.target as Element,svg=target.closest<SVGSVGElement>('.ml-network-svg');
   if(!svg)return;
   const node=target.closest<HTMLElement>('[data-network-node]'),index=node?Number(node.dataset.networkNode):null;
   const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const origin=point.matrixTransform(svg.getScreenCTM()!.inverse());
   drag={svg,pointer:event.pointerId,index,origin,additive:event.shiftKey,start:index===null?{...pan}:{...positions.get(graph.nodes[index].id)!},client:{x:event.clientX,y:event.clientY},moved:false};svg.setPointerCapture(event.pointerId);
  });
  root.addEventListener('pointermove',event=>{
   if(pinch||!drag||event.pointerId!==drag.pointer)return;
   if(Math.hypot(event.clientX-drag.client.x,event.clientY-drag.client.y)<5&&!drag.moved)return;
   drag.moved=true;const point=drag.svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const p=point.matrixTransform(drag.svg.getScreenCTM().inverse());
   const dx=p.x-drag.origin.x,dy=p.y-drag.origin.y;
   if(drag.index===null){pan={x:drag.start.x+dx,y:drag.start.y+dy};updateCamera(root);return;}else positions.set(graph.nodes[drag.index].id,{x:drag.start.x+dx/zoom,y:drag.start.y+dy/zoom});
   refreshSVG(root);
  });
  root.addEventListener('pointerup',event=>{if(!drag)return;const previous=drag;drag=null;if(previous.svg.hasPointerCapture(event.pointerId))previous.svg.releasePointerCapture(event.pointerId);if(previous.moved){event.preventDefault();suppressClick=true;}else if(previous.index!==null){select(root,previous.index,false,previous.additive);suppressClick=true;}setTimeout(()=>suppressClick=false,200);});
  root.addEventListener('pointercancel',()=>{drag=null;});
 }
 function mount(root:HTMLElement){
  root.querySelectorAll<HTMLInputElement>('input[type="range"][data-network-setting]').forEach(input=>{const min=Number(input.min),max=Number(input.max);input.style.setProperty('--slider-progress',`${(Number(input.value)-min)/(max-min)*100}%`);});
  cancelAnimationFrame(frame);themeObserver?.disconnect();viewportObserver?.disconnect();
  const svg=root.querySelector<SVGSVGElement>('.ml-network-svg');if(!svg)return;
  const reducedMotion=matchMedia('(prefers-reduced-motion:reduce)').matches,dense=graph.nodes.length>500;
  const nextRevealKey=JSON.stringify([layout,selection]);
  if(nextRevealKey!==revealKey){revealKey=nextRevealKey;revealStarted=selection&&layout!=='free'&&!reducedMotion?performance.now():0;}
  const revealing=()=>revealStarted>0&&performance.now()-revealStarted<revealDuration;
  const revealPoints=(edge:any,a:any,b:any)=>{
   if(!activeEdge(edge)||layout==='free'||reducedMotion||!revealing())return [a,b];
   const t=Math.min(1,Math.max(0,(performance.now()-revealStarted)/revealDuration));
   const progress=1-Math.pow(1-t,3);
   const reverse=activeNode(nodeById.get(edge.target))&&!activeNode(nodeById.get(edge.source));
   const start=reverse?b:a,end=reverse?a:b;
   return [start,{x:start.x+(end.x-start.x)*progress,y:start.y+(end.y-start.y)*progress}];
  };
  const nodes=[...svg.querySelectorAll<SVGGElement>('[data-network-node]')],edgePaths=[...svg.querySelectorAll('.ml-network-edge')].map(el=>[...el.querySelectorAll('path')]);
  const hitTargets=nodes.map(node=>node.querySelector<SVGCircleElement>('.node-hit-target')!);
  const depths=nodes.map(node=>node.querySelector<SVGElement>('.node-depth')!);
  const texts=nodes.map(node=>node.querySelector<SVGTextElement>('text'));
  let screenPositions=new Map<string,any>();
  const canvas=root.querySelector<HTMLCanvasElement>('.ml-network-link-canvas'),ctx=canvas?.getContext('2d');
  let canvasTransform=[1,0,0,1,0,0];
  const resizeCanvas=()=>{
   if(!canvas)return;
   const bounds=canvas.getBoundingClientRect(),matrix=svg.getScreenCTM();if(!matrix)return;
   const ratio=Math.min(window.devicePixelRatio||1,2);
   canvas.width=Math.max(1,Math.round(bounds.width*ratio));canvas.height=Math.max(1,Math.round(bounds.height*ratio));
   // Match the SVG viewport, including its letterbox margins. Connections can
   // extend past the viewBox during motion and pan, just as the nodes do.
   canvasTransform=[matrix.a*ratio,matrix.b*ratio,matrix.c*ratio,matrix.d*ratio,(matrix.e-bounds.left)*ratio,(matrix.f-bounds.top)*ratio];
  };
  resizeCanvas();
  const fieldColors=new Map<string,string>();graph.nodes.forEach((n:any,i:number)=>{if(!fieldColors.has(n.field)){const computed=getComputedStyle(nodes[i]);fieldColors.set(n.field,computed.getPropertyValue('--node-color').trim());}});
  // Resolve CSS variables to real canvas colours once, including theme changes.
  const colourProbe=document.createElement('span');svg.parentElement!.append(colourProbe);
  for(const [field,value] of fieldColors){colourProbe.style.color=value;fieldColors.set(field,getComputedStyle(colourProbe).color);}colourProbe.remove();
  let effectElapsed=0;
  const echo=echoDistances(graph,graph.nodes.filter((n:any)=>activeNode(n)).map((n:any)=>n.id).concat(selection?.kind==='edge'?graph.edges.filter((e:any)=>activeEdge(e)).flatMap((e:any)=>[e.source,e.target]):[]));
  colourProbe.style.color='var(--ink)';svg.parentElement!.append(colourProbe);const neutralColor=getComputedStyle(colourProbe).color;
  const threadColours=new Map<string,string>();
  const threadColour=(edge:any)=>{
   const from=nodeById.get(edge.source).field,to=nodeById.get(edge.target).field,key=layout==='free'?[from,to].sort().join(':'):from+':'+to;
   if(threadColours.has(key))return threadColours.get(key)!;
   const target=fieldColors.get(to)||'gray',source=fieldColors.get(from)||'gray';
   colourProbe.style.color=layout==='free'?`color-mix(in srgb,color-mix(in srgb,${source} 50%,${target}) 80%,${neutralColor})`:layout==='bipartite'&&palette==='troll'?'var(--network-bipartite-thread)':target;
   const color=getComputedStyle(colourProbe).color;threadColours.set(key,color);return color;
  };
  const edgeStyle=getComputedStyle(svg),freeEdgeAlpha=parseFloat(edgeStyle.getPropertyValue('--network-free-edge-alpha'))||.3,structuredEdgeAlpha=parseFloat(edgeStyle.getPropertyValue('--network-structured-edge-alpha'))||.1,mutedEdgeAlpha=parseFloat(edgeStyle.getPropertyValue('--network-muted-edge-alpha'))||.09,idleEdgeWidth=parseFloat(edgeStyle.getPropertyValue('--network-idle-edge-width'))||.75;
  const edges=graph.edges.map((e:any)=>({e,a:activeEdge(e),color:threadColour(e),width:activeEdge(e)?Math.min(1.65,.45+Math.sqrt(e.recordIds.length)*.32):idleEdgeWidth,phase:Math.floor(((cameraPoint(positions.get(e.source)!,zoom,pan).x+cameraPoint(positions.get(e.target)!,zoom,pan).x)/2/900)*12)/12,echoDelay:Math.min(echo.get(e.source)??Infinity,echo.get(e.target)??Infinity,6)*140,hasEcho:echo.has(e.source)||echo.has(e.target)}));
  colourProbe.remove();
  const edgeGroups=new Map<string,typeof edges>();for(const edge of edges){const key=edge.color+':'+edge.a+':'+edge.width+(animation==='wave'?':'+edge.phase:animation==='echo'?':'+edge.echoDelay+':'+edge.hasEcho:'');const group=edgeGroups.get(key)||[];group.push(edge);edgeGroups.set(key,group);}
  const draw=()=>{
   const matrix=svg.getScreenCTM(),amplitudeScale=motionAmplitudeScale(matrix?Math.hypot(matrix.a,matrix.b)*zoom:1);
   displayedPositions=new Map();screenPositions=new Map();
   graph.nodes.forEach((n:any,i:number)=>{const base=positions.get(n.id)!,p=layout==='free'&&!reducedMotion&&drag?.index!==i?positionWithMotion(n.id,base,clock,motion,intensity,undefined,amplitudeScale):{...base,scale:1,opacity:1};displayedPositions.set(n.id,p);const screen=cameraPoint(p,zoom,pan);screenPositions.set(n.id,screen);nodes[i].setAttribute('transform',`translate(${screen.x} ${screen.y})`);const depthScale=sizeMode==='uniform'?1:p.scale;depths[i].setAttribute('transform',`scale(${depthScale})`);hitTargets[i].setAttribute('r',String(Math.max(nodeRadius(n,layout,sizeMode)*nodeSize,7/depthScale)));if(texts[i]&&layout==='free'){const radius=nodeRadius(n,layout,sizeMode)*nodeSize*depthScale;texts[i]!.setAttribute('x',String(screen.x<450?radius+7:-radius-7));texts[i]!.setAttribute('text-anchor',screen.x<450?'start':'end');}nodes[i].style.setProperty('--depth-opacity',String(p.opacity));});
   if(motion==='orbit'&&layout==='free'){const parent=nodes[0]?.parentElement;const ordered=[...nodes].sort((a,b)=>displayedPositions.get(graph.nodes[Number(a.dataset.networkNode)].id).scale-displayedPositions.get(graph.nodes[Number(b.dataset.networkNode)].id).scale);ordered.forEach((node,i)=>{if(parent?.children[i]!==node)parent?.insertBefore(node,parent.children[i]||null);});}
   // Keep selected nodes above overlaps, including after Orbit depth sorting.
   for(const node of nodes)if(node.classList.contains('is-selected'))node.parentElement?.append(node);
   if(ctx&&canvas){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.setTransform(...canvasTransform as [number,number,number,number,number,number]);
    ctx.setLineDash([]);ctx.lineDashOffset=0;ctx.filter='none';
    for(const group of edgeGroups.values()){const {a,color,width,phase,echoDelay,hasEcho}=group[0];
     const wavePhase=((effectElapsed/4800+phase)%1+1)%1;
     const pulse=animation==='wave'?Math.max(0,1-Math.abs(wavePhase-.08)/.1):animation==='echo'&&hasEcho?Math.max(0,Math.sin(Math.PI*Math.min(1,Math.max(0,(effectElapsed-echoDelay)/1700)))):0;
     const baseAlpha=a?.78:selection?mutedEdgeAlpha:layout==='free'?freeEdgeAlpha:structuredEdgeAlpha;ctx.globalAlpha=Math.min(1,baseAlpha*(1+pulse*2.2)*threadBrightness);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();
     for(const {e} of group){const [one,two]=revealPoints(e,screenPositions.get(e.source)!,screenPositions.get(e.target)!);ctx.moveTo(one.x,one.y);ctx.lineTo(two.x,two.y);}ctx.stroke();
     if(layout!=='free'||animation==='rain'){ctx.globalAlpha=Math.min(1,(a?.94:animation==='rain'?.72:.065)*(1+pulse*1.4)*threadBrightness);ctx.strokeStyle=color;ctx.lineWidth=a?Math.min(1.9,width+.25):animation==='rain'?.9:.72;ctx.setLineDash(animation==='rain'?[1.15,5.25]:[]);ctx.lineDashOffset=animation==='rain'?-clock/50:0;ctx.stroke();ctx.setLineDash([]);}
    }ctx.restore();
   }else graph.edges.forEach((e:any,i:number)=>{const a=screenPositions.get(e.source)!,b=screenPositions.get(e.target)!;const [start,end]=revealPoints(e,a,b);edgePaths[i]?.forEach(p=>p.setAttribute('d',p.classList.contains('ml-network-edge-hit')?`M${a.x},${a.y} L${b.x},${b.y}`:`M${start.x},${start.y} L${end.x},${end.y}`));});
  };
  redraw=draw;draw();lastFrame=performance.now();
  viewportObserver=new ResizeObserver(()=>{resizeCanvas();draw();});viewportObserver.observe(svg);
  const tick=(now:number)=>{frame=requestAnimationFrame(tick);if(revealStarted&&!revealing()){revealStarted=0;draw();}if(document.hidden||drag||(!revealing()&&(!moving||reducedMotion||(layout!=='free'&&animation==='none')))){lastFrame=now;return;}if(dense&&now-lastFrame<32)return;const elapsed=Math.min(100,now-lastFrame);clock+=elapsed;effectElapsed+=elapsed;lastFrame=now;draw();};
  frame=requestAnimationFrame(tick);
  const observer=new MutationObserver(()=>{mount(root);observer.disconnect();});observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  // A remount releases the previous theme observer together with its frame.
  themeObserver?.disconnect();themeObserver=observer;
 }
 let themeObserver:MutationObserver|null=null;
 let viewportObserver:ResizeObserver|null=null;

 let suppressClick=false;
 return {copy:tr,label,render,read,write,reset,selectedRows,handleClick,handleSetting,attach,mount,get presentation(){return presentation;},get graphChanged(){return graphChanged;},get suppressClick(){return suppressClick;}};
}
