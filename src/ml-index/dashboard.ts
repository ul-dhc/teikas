import {dashboardCopy} from './dashboard-copy';
import {treemap} from './treemap.js';
import {flattenTypes, selectRecords, countsBy, selectionLink, UNKNOWN} from './statistics.js';
import type {types as sourceTypes, topics as sourceTopics} from './data';

type Type = typeof sourceTypes[number];
type Topic = typeof sourceTopics[number];
type Filter = 'county' | 'collector' | 'narrator' | 'translation';
type Filters = Partial<Record<Filter,string>>;
type Row = Type['records'][number] & {typeId:string;code:string;typeLv:string;typeDe:string;topic:string};
type Scope = {topic?:Topic;type?:Type};
type Options = {types:Type[];topics:Topic[];base:string;lang:()=> 'lv'|'de'|'en';scopeChange:(topic?:Topic,type?:Type)=>void;stateChange:()=>void};
export function createDashboard(options: Options) {
 const {types,topics,base,lang} = options;
 const all = flattenTypes(types) as Row[];
 const root = document.getElementById('ml-dashboard-content')!;
 const tooltip=document.createElement('div');
 tooltip.className='ml-hover-tooltip';tooltip.id='ml-dashboard-tooltip';tooltip.setAttribute('role','tooltip');tooltip.hidden=true;document.body.append(tooltip);
 let tooltipTarget:Element|null=null;
 function hideTooltip(){tooltip.hidden=true;tooltipTarget?.removeAttribute('aria-describedby');tooltipTarget=null;}
 function showTooltip(target:Element){
  hideTooltip();tooltipTarget=target;tooltip.textContent=target.getAttribute('data-tooltip');tooltip.hidden=false;target.setAttribute('aria-describedby',tooltip.id);
  const pie=target.closest('.ml-volume-pie'),rect=(pie||target).getBoundingClientRect(),box=tooltip.getBoundingClientRect();
  tooltip.style.left=`${Math.max(8,Math.min(innerWidth-box.width-8,rect.left+rect.width/2-box.width/2))}px`;
  tooltip.style.top=`${pie&&rect.bottom+box.height+16<innerHeight?rect.bottom+8:rect.top>box.height+16?rect.top-box.height-8:Math.min(innerHeight-box.height-8,rect.bottom+8)}px`;
 }
 root.addEventListener('pointerover',event=>{const target=(event.target as Element).closest('[data-tooltip]');if(target&&target!==tooltipTarget)showTooltip(target);});
 root.addEventListener('pointerout',event=>{if(tooltipTarget&&!tooltipTarget.contains((event as PointerEvent).relatedTarget as Node))hideTooltip();});
 root.addEventListener('focusin',event=>{const target=(event.target as Element).closest('[data-tooltip]');if(target)showTooltip(target);});
 root.addEventListener('focusout',hideTooltip);
 window.addEventListener('scroll',()=>{const target=tooltipTarget;if(target&&target===document.activeElement){const rect=target.getBoundingClientRect();if(rect.bottom>0&&rect.top<innerHeight)showTooltip(target);else hideTooltip();}else hideTooltip();},true);window.addEventListener('resize',hideTooltip);
 root.addEventListener('keydown',event=>{if(event.key==='Escape')hideTooltip();});
 const tr = (key:keyof typeof dashboardCopy.en) => dashboardCopy[lang()][key];
 const esc = (value:unknown) => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 const name = (type:Type) => lang()==='de'?(type.de||type.lv):type.lv;
 const key = (type:Type) => type.id;
 type Sort = 'count-desc'|'count-asc'|'name'|'code';
 const sortFields=['type','county','collector'];
 let sorts:Record<string,Sort> = {};
 let filters:Filters = {};
 let scope:Scope = {};
 let panelOpen = false;
 let previewSize = 12;
 let typeQuery = '';
 const expandedLists=new Set<string>();
 let textMode = localStorage.getItem('teikas-content-mode') || 'parallel';
 const cohort = (skip='') => selectRecords(all,{topic:scope.topic?.id,type:scope.type?.id},filters,skip) as Row[];
 const countUnique = (rows:Row[],field:'county'|'collector'|'narrator'|'typeId') => new Set(rows.map(row=>row[field]).filter(Boolean)).size;
 function read(params:URLSearchParams) {
  filters = {};
  sorts = {};
  for(const field of sortFields){const value=params.get(`sort_${field}`);if(value&&['count-desc','count-asc','name',...(field==='type'?['code']:[])].includes(value))sorts[field]=value as Sort;}
  for (const field of ['county','collector','narrator','translation'] as Filter[]) {
   const value=params.get(field);
   if (!value) continue;
   if (field==='translation' && !['translated','original'].includes(value)) continue;
   if (['county','collector','narrator'].includes(field) && value!==UNKNOWN && !all.some(row=>(row as any)[field]===value)) continue;
   filters[field]=value;
  }
  panelOpen=params.get('texts')==='1';
  typeQuery=''; previewSize=12;
 }
 function write(params:URLSearchParams) {
  for (const [field,value] of Object.entries(filters)) if(value)params.set(field,value);
  if(panelOpen)params.set('texts','1');
  for(const [field,value] of Object.entries(sorts))if(value!=='count-desc')params.set(`sort_${field}`,value);
 }
 function ring(value:number, total:number, label:string, tone='blue') {
  const percent=new Intl.NumberFormat(lang(),{maximumFractionDigits:1}).format(total?value/total*100:0);
  return `<div class="ml-ring tone-${tone}" style="--ring-share:${total?value/total*100:0}%" role="img" aria-label="${esc(label)}: ${value} / ${total}"><div><strong>${percent}%</strong></div></div>`;
 }
 function metrics(rows:Row[]) {
  const values=[
   {label:tr('selection'),value:rows.length,icon:'file-stack',note:`${Math.round(rows.length/all.length*100)}% ${tr('fullCollection')}`,tone:'blue'},
   {label:tr('types'),value:countUnique(rows,'typeId'),icon:'layers',note:tr('legendTypes'),tone:'rose'},
   {label:tr('counties'),value:countUnique(rows,'county'),icon:'map-pin',note:tr('placesKnown'),tone:'slate'},
   {label:tr('collectors'),value:countUnique(rows,'collector'),icon:'notebook-pen',note:tr('collectorsKnown'),tone:'blue'},
  ];
  return `<div class="ml-kpis">${values.map(v=>`<article class="ml-kpi tone-${v.tone}"><div class="ml-kpi-icon"><i data-lucide="${v.icon}"></i></div><div><span>${v.label}</span><strong ${v.label===tr('selection')?'data-selected-count':''}>${v.value.toLocaleString(lang())}</strong><small>${v.note}</small></div></article>`).join('')}</div>`;
 }
 function chartHeading(label:string, extra='') {
  return `<div class="ml-card-heading"><h3>${label}</h3>${extra||`<small>${tr('click')}</small>`}</div>`;
 }
 function sortControl(field:string,label:string) {
  const choices=[['count-desc',tr('mostFirst')],['count-asc',tr('fewestFirst')],['name',tr('alphabetical')],...(field==='type'?[['code',tr('byCode')]]:[])];
  const current=sorts[field]||'count-desc';
  return `<div class="ml-facet-sort"><button type="button" data-sort="${field}" aria-haspopup="menu" aria-expanded="false" aria-controls="ml-sort-${field}" aria-label="${tr('sort')}: ${label}"><span>${choices.find(([value])=>value===current)![1]}</span><i data-lucide="chevron-down"></i></button><div class="ml-sort-menu" id="ml-sort-${field}" role="menu" aria-label="${tr('sort')}: ${label}" hidden>${choices.map(([value,text])=>`<button type="button" role="menuitemradio" aria-checked="${current===value}" data-sort-option="${field}" data-sort-value="${value}" tabindex="-1"><span>${text}</span><i data-lucide="check"></i></button>`).join('')}</div></div>`;
 }
 function compare(field:string,a:{count:number;label:string;code?:string},b:{count:number;label:string;code?:string}) {
  const alphabetical=()=>a.label.localeCompare(b.label,lang(),{numeric:true});
  switch(sorts[field]||'count-desc'){
   case 'name':return alphabetical();
   case 'code':return (a.code||'').localeCompare(b.code||'',lang(),{numeric:true});
   case 'count-asc':return a.count-b.count||alphabetical();
   default:return b.count-a.count||alphabetical();
  }
 }
 function rowButton(field:string,value:string,label:string,count:number,max:number,selected:boolean,sub='') {
  const disabled=count===0&&!selected;
  return `<li><button type="button" class="ml-facet-row ${selected?'is-selected':''}" data-facet="${field}" data-value="${esc(value)}" aria-pressed="${selected}" ${disabled?'disabled':''}><span class="ml-facet-name">${esc(label)}${sub?`<small>${esc(sub)}</small>`:''}</span><b>${count}</b><span class="ml-facet-track" aria-hidden="true"><span style="width:${max?count/max*100:0}%"></span></span></button></li>`;
 }
 function topicsChart() {
  const counts=countsBy(cohort('topic'),'topic') as Map<string,number>;
  const total=[...counts.values()].reduce((sum,count)=>sum+count,0);
  const ordered=[...topics].sort((a,b)=>a.id.localeCompare(b.id,lang(),{numeric:true}));
  const max=Math.max(...counts.values(),1);
  const tone=(topic:Topic)=>`ml-volume-${topics.indexOf(topic)%3}`;
  const percent=(count:number)=>new Intl.NumberFormat(lang(),{maximumFractionDigits:1}).format(total?count/total*100:0);
  const description=(topic:Topic,count:number)=>`${topic[lang()]}: ${count} ${(lang()==='de'?tr('corpus'):tr('corpus').toLowerCase())} (${percent(count)}%)`;
  let angle=-Math.PI/2;
  const sectors=ordered.map(topic=>{
   const count=counts.get(topic.id)||0;if(!count||!total)return '';
   const start=angle;angle+=count/total*Math.PI*2;
   const point=(radians:number)=>`${100+96*Math.cos(radians)} ${100+96*Math.sin(radians)}`;
   const path=count===total?'M 100 4 A 96 96 0 1 1 100 196 A 96 96 0 1 1 100 4 Z':`M 100 100 L ${point(start)} A 96 96 0 ${angle-start>Math.PI?1:0} 1 ${point(angle)} Z`;
   return `<path d="${path}" class="ml-pie-sector ${tone(topic)} ${scope.topic?.id===topic.id?'is-selected':''}" role="button" tabindex="0" data-facet="topic" data-value="${esc(topic.id)}" aria-pressed="${scope.topic?.id===topic.id}" aria-label="${esc(description(topic,count))}" data-tooltip="${esc(description(topic,count))}"/>`;
  }).join('');
  return `<section class="ml-dash-card ml-topic-chart">${chartHeading(tr('topics'))}<p class="ml-chart-subtitle">${tr('volumeCaption')}</p><div class="ml-volume-layout"><svg class="ml-volume-pie" viewBox="0 0 200 200" role="group" aria-label="${tr('topics')}"><circle cx="100" cy="100" r="96" fill="var(--line)"/>${sectors}</svg><ol class="ml-volume-cards">${ordered.map(topic=>{const count=counts.get(topic.id)||0;return `<li><button type="button" class="${tone(topic)} ${scope.topic?.id===topic.id?'is-selected':''}" data-facet="topic" data-value="${esc(topic.id)}" aria-pressed="${scope.topic?.id===topic.id}" data-tooltip="${esc(description(topic,count))}" style="--volume-share:${count/max*100}%" ${!count&&scope.topic?.id!==topic.id?'disabled':''}><span class="ml-volume-label">${esc(topic[lang()])}</span><strong>${count}</strong><small>${percent(count)}%</small><span class="ml-volume-bar" aria-hidden="true"><span></span></span></button></li>`}).join('')}</ol></div></section>`;
 }
 function typesChart() {
  const counts=countsBy(cohort('type'),'typeId') as Map<string,number>;
  const set=types.filter(type=>(!scope.topic||type.topic===scope.topic.id)).sort((a,b)=>compare('type',{count:counts.get(a.id)||0,label:name(a),code:a.code},{count:counts.get(b.id)||0,label:name(b),code:b.code}));
  const max=Math.max(...counts.values(),1);
  const compact=typeQuery.toLowerCase().replace(/\s/g,'');
  const visible=set.filter(type=>!compact||`${type.code}${type.lv}${type.de}`.toLowerCase().replace(/\s/g,'').includes(compact));
  const tiles=treemap(visible.map(type=>({type,count:counts.get(type.id)||0})),100,65);
  return `<section class="ml-dash-card ml-type-chart">${chartHeading(tr('types'),sortControl('type',tr('types')))}<p class="ml-chart-subtitle">${tr('mosaicCaption')}</p><label class="ml-type-chart-search"><span class="sr-only">${tr('typeSearch')}</span><input class="platform-search" type="search" id="ml-dash-type-search" placeholder="${tr('typeSearch')}" value="${esc(typeQuery)}"/></label><div class="ml-chapter-mosaic" role="group" aria-label="${tr('types')}">${!tiles.length?`<p class="ml-mosaic-empty">${tr('noMatchingChapters')}</p>`:''}${tiles.map(tile=>{const type=tile.type;const label=`${name(type)} · ${topics.find(topic=>topic.id===type.topic)?.[lang()]||type.code}: ${tile.count} ${(lang()==='de'?tr('corpus'):tr('corpus').toLowerCase())}`;return `<button type="button" data-facet="type" data-value="${esc(key(type))}" aria-pressed="${scope.type?.id===type.id}" aria-label="${esc(label)}" data-tooltip="${esc(label)}" class="ml-mosaic-tile ml-volume-${topics.findIndex(topic=>topic.id===type.topic)%3} ${scope.type?.id===type.id?'is-selected':''} ${tile.width<7||tile.height<8?'is-small':tile.width>=20&&tile.height>=15?'is-large':tile.width>=12&&tile.height>=12?'is-medium':''}" style="left:${tile.x}%;top:${tile.y/65*100}%;width:${tile.width}%;height:${tile.height/65*100}%"><span>${esc(name(type))}</span><strong>${tile.count}</strong><small>${esc(type.code)}</small></button>`}).join('')}</div><div class="ml-chart-details" data-chart-list="type"><button type="button" data-toggle-chart-list="type" aria-expanded="${expandedLists.has('type')}" aria-controls="ml-chart-list-type"><i data-lucide="chevron-down"></i>${tr('allChapters')} (${visible.length})</button><ol class="ml-facet-list" id="ml-chart-list-type" ${expandedLists.has('type')?'':'hidden'}>${visible.map(type=>rowButton('type',key(type),name(type),counts.get(type.id)||0,max,scope.type?.id===type.id,type.code)).join('')}</ol></div></section>`;
 }
 function namedChart(field:'county'|'collector'|'narrator',label:string) {
  const counts=countsBy(cohort(field),field) as Map<string,number>;
  if(filters[field]&&!counts.has(filters[field]!))counts.set(filters[field]!,0);
  const sorted=[...counts].sort((a,b)=>compare(field,{count:a[1],label:a[0]===UNKNOWN?tr('unknown'):a[0]},{count:b[1],label:b[0]===UNKNOWN?tr('unknown'):b[0]}));
  const entries=field==='county'?sorted.filter(([value])=>value!==UNKNOWN):sorted;
  const max=Math.max(...entries.map(([,count])=>count),1);
  const expanded=expandedLists.has(field);
  const shown=expanded?entries:entries.slice(0,8);
  const selected=entries.find(([value])=>value===filters[field]);
  if(selected&&!shown.some(([value])=>value===selected[0]))shown.push(selected);
  const bars=shown.map(([value,count])=>field==='collector'?`<li><button type="button" class="ml-collector-bar ${filters[field]===value?'is-selected':''}" data-facet="${field}" data-value="${esc(value)}" aria-pressed="${filters[field]===value}" style="--bar-share:${count/max*100}%"><span class="ml-collector-fill" aria-hidden="true"></span><span class="ml-collector-name">${esc(value===UNKNOWN?tr('unknown'):value)}</span><b>${count}</b></button></li>`:rowButton(field,value,value,count,max,filters[field]===value)).join('');
  return `<section class="ml-dash-card ml-${field}-chart ${expanded?'is-expanded':''}">${chartHeading(label,sortControl(field,label))}${field==='county'?`<p class="ml-chart-subtitle">${tr('placesCaption')}</p>`:''}<ol class="ml-facet-list ${field==='collector'?'ml-collector-bars':''}">${bars}</ol>${field==='county'?`<button class="ml-undated-choice ${filters.county===UNKNOWN?'is-selected':''}" type="button" data-facet="county" data-value="${UNKNOWN}" aria-pressed="${filters.county===UNKNOWN}">${tr('unknownPlace')} <strong>${counts.get(UNKNOWN)||0}</strong></button>`:''}<div class="ml-chart-details"><button type="button" data-toggle-chart-list="${field}" aria-expanded="${expanded}"><i data-lucide="chevron-down"></i>${field==='county'?tr('allPlaces'):tr('allCollectors')} (${entries.length})</button></div></section>`;
 }

 function translationChart() {
  const rows=cohort('translation');
  const german=rows.filter(row=>row.translated).length;
  const english=rows.filter(row=>row.translatedEn).length;
  return `<section class="ml-dash-card ml-translation-chart">${chartHeading(tr('translations'),'<small>'+tr('fromSelection')+'</small>')}<div class="ml-translation-languages"><div class="ml-translation-language">${ring(german,rows.length,tr('translated'),'blue')}<div><h4>${tr('translated')}</h4><p>${german} / ${rows.length} ${(lang()==='de'?tr('corpus'):tr('corpus').toLowerCase())}</p><div class="ml-translation-choices">${['translated','original'].map(value=>`<button type="button" data-facet="translation" data-value="${value}" aria-pressed="${filters.translation===value}">${tr(value as 'translated'|'original')}</button>`).join('')}</div></div></div><div class="ml-translation-language">${ring(english,rows.length,tr('englishTranslation'),'blue')}<div><h4>${tr('englishTranslation')}</h4><p>${english} / ${rows.length} ${(lang()==='de'?tr('corpus'):tr('corpus').toLowerCase())}</p>${!english?`<small>${tr('awaitingEnglish')}</small>`:''}</div></div></div></section>`;
 }
 function label(field:Filter,value:string) {
  if(value===UNKNOWN)return tr('unknown');
  if(field==='translation')return tr(value as 'translated'|'original');
  return value;
 }
 function chips() {
  const choices:Array<{field:string;value:string;label:string}>=[];
  if(scope.topic)choices.push({field:'topic',value:scope.topic.id,label:scope.topic[lang()]});
  if(scope.type)choices.push({field:'type',value:key(scope.type),label:name(scope.type)});
  for(const [field,value] of Object.entries(filters))choices.push({field,value:value!,label:label(field as Filter,value!)});
  return `<div class="ml-dashboard-filters" aria-label="${tr('active')}">${choices.length?choices.map(choice=>`<button type="button" data-remove-filter="${choice.field}" aria-label="${esc(tr('remove')+': '+choice.label)}">${esc(choice.label)}<i data-lucide="x"></i></button>`).join(''):''}${choices.length?`<button type="button" data-reset-stats class="ml-reset">${tr('reset')}<i data-lucide="rotate-ccw"></i></button>`:''}</div>`;
 }
 function previewText(row:Row) {
  const no=row.excerptLv||'',en=row.excerptDe||'';
  const shorten=(text:string)=>esc(text.length>220?text.slice(0,220).trimEnd()+'…':text);
  if(textMode==='parallel')return `<p lang="lv">${shorten(no)}</p>${en?`<p class="ml-preview-en" lang="de">${shorten(en)}</p>`:''}`;
  return `<p lang="${textMode==='de'&&en?'de':'lv'}">${shorten(textMode==='de'&&en?en:no)}</p>${textMode==='de'&&!en?`<small>${tr('unavailable')}</small>`:''}`;
 }
 function textPanel(rows:Row[]) {
  if(!panelOpen)return '';
  const sorted=[...rows].sort((a,b)=>a.sourceTextId.localeCompare(b.sourceTextId,'en',{numeric:true}));
  return `<aside class="ml-text-panel" aria-labelledby="ml-text-panel-title" ${matchMedia('(max-width:950px)').matches?'role="dialog" aria-modal="true"':''}><div class="ml-text-panel-heading"><div><span>${tr('preview')}</span><h3 id="ml-text-panel-title">${tr('sideTitle')} <b>${rows.length}</b></h3></div><button type="button" data-close-texts aria-label="${tr('close')}"><i data-lucide="x"></i></button></div><p class="ml-panel-hint">${tr('sideHint')}</p>${rows.length?`<a class="button primary icon-link ml-selection-explorer" href="${selectionLink(base,rows)}" target="_blank" rel="noopener">${tr('openExplorer')}<i data-lucide="external-link"></i></a>`:''}<div class="ml-preview-mode" role="group" aria-label="${tr('textLanguage')}">${['lv','de','parallel'].map(mode=>`<button type="button" data-preview-mode="${mode}" aria-pressed="${textMode===mode}">${mode==='parallel'?'LV & DE':mode.toUpperCase()}</button>`).join('')}</div><div class="ml-preview-scroll">${!rows.length?`<p>${tr('noRecords')}</p><p>${tr('emptyHint')}</p>`:`<ol>${sorted.slice(0,previewSize).map(row=>`<li><small>${esc(row.sourceTextId)} · ${esc(row.typeLv)}</small><h4><a href="${base}teikas/${row.id}/" target="_blank" rel="noopener">${esc(textMode==='de'?(row.titleDe||row.titleLv):row.titleLv)}</a></h4><p class="ml-preview-metadata">${esc([row.place,row.year,row.collector].filter(Boolean).join(' · '))}</p>${previewText(row)}<a class="ml-read-full icon-link" href="${base}teikas/${row.id}/" target="_blank" rel="noopener">${tr('read')}<i data-lucide="external-link"></i></a></li>`).join('')}</ol>${sorted.length>previewSize?`<button type="button" data-more-texts class="ml-more-texts">${tr('more')} (${Math.min(12,sorted.length-previewSize)})</button>`:''}`}</div></aside>`;
 }
 const resultRows=()=>cohort();
 function render(nextScope:Scope=scope) {
  hideTooltip();
  if(scope.topic!==nextScope.topic)typeQuery='';
  if(scope.topic!==nextScope.topic||scope.type!==nextScope.type)previewSize=12;
  scope=nextScope;
  const rows=cohort();
  const selectedRows=resultRows();
  root.innerHTML=`<div class="ml-research-dashboard ${panelOpen?'has-text-panel':''}"><div class="ml-dashboard-canvas"><header class="ml-research-heading"><div><h2 id="ml-dashboard-title" tabindex="-1">${tr('title')}</h2><p>${tr('hint')}</p></div><div class="ml-research-actions"><button type="button" data-export-stats ${!rows.length?'disabled':''}><i data-lucide="download"></i>${tr('csv')}</button><button type="button" data-share-stats aria-label="${tr('share')}" data-tooltip="${tr('share')}"><i data-lucide="link"></i></button><button type="button" data-toggle-texts class="ml-show-texts" aria-expanded="${panelOpen}"><i data-lucide="list"></i><span>${tr('texts')}</span><b>${selectedRows.length}</b></button></div></header><p id="ml-stats-status" role="status"></p>${chips()}${metrics(rows)}<div class="ml-research-grid">${topicsChart()}${namedChart('collector',tr('collectors'))}${typesChart()}${namedChart('county',tr('counties'))}${translationChart()}</div>${!rows.length?`<div class="ml-zero-state" role="status"><strong>${tr('noRecords')}</strong><p>${tr('emptyHint')}</p><button type="button" data-reset-stats>${tr('reset')}</button></div>`:''}</div>${textPanel(selectedRows)}</div>`;
  const modal=panelOpen&&document.getElementById('ml-dashboard')?.hidden===false&&matchMedia('(max-width:950px)').matches;
  document.querySelectorAll<HTMLElement>('.ml-dashboard-canvas,.site-header,.ml-hero,.ml-view-switch,.ml-method,.site-footer').forEach(element=>element.inert=modal);
  document.body.classList.toggle('ml-panel-visible',modal);
  document.documentElement.classList.toggle('ml-modal-open',modal);
  if(modal&&!root.querySelector('.ml-text-panel')?.contains(document.activeElement))root.querySelector<HTMLElement>('[data-close-texts]')?.focus({preventScroll:true});
  window.dispatchEvent(new Event('lucide-refresh'));
 }
 function update() { previewSize=12;render();options.stateChange(); }
 function toggle(field:string,value:string) {
  
  if(field==='topic') {
   const topic=scope.topic?.id===value?undefined:topics.find(topic=>topic.id===value);
   options.scopeChange(topic,undefined);return;
  }
  if(field==='type') {
   const type=scope.type&&key(scope.type)===value?undefined:types.find(type=>key(type)===value);
   options.scopeChange(type?topics.find(topic=>topic.id===type.topic):scope.topic,type);return;
  }
  if(filters[field as Filter]===value)delete filters[field as Filter];else filters[field as Filter]=value;
  update();
 }
 function remove(field:string) {
  
  if(field==='topic'){options.scopeChange(undefined,undefined);return;}
  if(field==='type'){options.scopeChange(scope.topic,undefined);return;}
  delete filters[field as Filter];update();
 }
 function closeSortMenus() {
  root.querySelectorAll<HTMLElement>('.ml-sort-menu').forEach(menu=>menu.hidden=true);
  root.querySelectorAll('[data-sort]').forEach(button=>button.setAttribute('aria-expanded','false'));
 }
 function openSortMenu(button:HTMLElement,last=false) {
  closeSortMenus();button.setAttribute('aria-expanded','true');
  const menu=document.getElementById(button.getAttribute('aria-controls')!)!;menu.hidden=false;
  const items=menu.querySelectorAll<HTMLElement>('button');
  (last?items[items.length-1]:menu.querySelector<HTMLElement>('[aria-checked="true"]')||items[0])?.focus({preventScroll:true});
 }
 document.addEventListener('click',event=>{if(!(event.target as Element).closest('.ml-facet-sort'))closeSortMenus();});
 function highlightVolume(target:Element|null){
  const choice=target?.closest('[data-facet="topic"]');
  root.querySelectorAll('.ml-topic-chart [data-facet="topic"]').forEach(element=>element.classList.toggle('is-hovered',!!choice&&element.getAttribute('data-value')===choice.getAttribute('data-value')));
 }
 root.addEventListener('pointerover',event=>highlightVolume(event.target as Element));
 root.addEventListener('pointerout',event=>highlightVolume(event.relatedTarget instanceof Element?event.relatedTarget:null));
 root.addEventListener('focusin',event=>highlightVolume(event.target as Element));
 root.addEventListener('focusout',()=>highlightVolume(null));
 root.addEventListener('keydown',event=>{
  const target=event.target as HTMLElement;
  if(target.matches('.ml-pie-sector')&&['Enter',' '].includes(event.key)){event.preventDefault();const value=target.dataset.value!;toggle('topic',value);root.querySelector<HTMLElement>(`.ml-pie-sector[data-value="${CSS.escape(value)}"]`)?.focus({preventScroll:true});return;}
  if(target.dataset.sort&&['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();openSortMenu(target,event.key==='ArrowUp');return;}
  const menu=target.closest<HTMLElement>('.ml-sort-menu');if(!menu)return;
  const trigger=root.querySelector<HTMLElement>(`[aria-controls="${menu.id}"]`)!;
  const items=[...menu.querySelectorAll<HTMLElement>('button')],index=items.indexOf(target);
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next].focus();}
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeSortMenus();trigger.focus({preventScroll:true});}
  if(event.key==='Tab'){closeSortMenus();trigger.focus({preventScroll:true});}
 });
 root.addEventListener('click',async event=>{
  const target=event.target as Element;
  const button=target.closest<HTMLElement>('button,[data-facet]');if(!button)return;
  if(button.dataset.toggleChartList){const id=button.dataset.toggleChartList;expandedLists.has(id)?expandedLists.delete(id):expandedLists.add(id);render();root.querySelector<HTMLElement>(`[data-toggle-chart-list="${id}"]`)?.focus({preventScroll:true});return;}
  if(button.dataset.sort){const open=button.getAttribute('aria-expanded')==='true';if(open)closeSortMenus();else openSortMenu(button);return;}
  if(button.dataset.sortOption){const field=button.dataset.sortOption;sorts[field]=button.dataset.sortValue as Sort;render();options.stateChange();root.querySelector<HTMLElement>(`[data-sort="${field}"]`)?.focus({preventScroll:true});return;}
  if(button.dataset.facet){const field=button.dataset.facet,value=button.dataset.value!;toggle(field,value);root.querySelector<HTMLElement>(`[data-facet="${CSS.escape(field)}"][data-value="${CSS.escape(value)}"]`)?.focus({preventScroll:true});return;}
  if(button.dataset.removeFilter){remove(button.dataset.removeFilter);return;}
  if(button.hasAttribute('data-reset-stats')){filters={};typeQuery='';options.scopeChange(undefined,undefined);return;}
  if(button.hasAttribute('data-toggle-texts')||button.hasAttribute('data-close-texts')){
   const closing=panelOpen;panelOpen=!closing;render();options.stateChange();
   const target=closing?root.querySelector<HTMLElement>('[data-toggle-texts]'):root.querySelector<HTMLElement>('[data-close-texts]');target?.focus({preventScroll:true});return;
  }
  if(button.dataset.previewMode){textMode=button.dataset.previewMode;render();root.querySelector<HTMLElement>(`[data-preview-mode="${textMode}"]`)?.focus({preventScroll:true});return;}
  if(button.hasAttribute('data-more-texts')){const scroll=root.querySelector('.ml-preview-scroll')?.scrollTop||0;previewSize+=12;render();const panel=root.querySelector('.ml-preview-scroll');if(panel)panel.scrollTop=scroll;return;}
  if(button.hasAttribute('data-share-stats')){
   try{await navigator.clipboard.writeText(location.href);document.getElementById('ml-stats-status')!.textContent=tr('copied');}catch{document.getElementById('ml-stats-status')!.textContent=tr('copyFailed');}return;
  }
  if(button.hasAttribute('data-export-stats')){
   const rows=resultRows(),columns=['source_id','record_id','chapter_id','chapter_lv','chapter_de','topic','title_lv','title_de','place_name','place','collector','narrator','record_or_source_year','german_translation','archive_signature','source_url','record_url'];
   const cell=(value:unknown)=>{const text=String(value??'');return `"${(/^[=+@\-\t\r]/.test(text)?"'"+text:text).replace(/"/g,'""')}"`;};
   const values=rows.map((row:Row)=>[row.sourceTextId,row.id,row.typeId,row.typeLv,row.typeDe,row.topic,row.titleLv,row.titleDe,row.county,row.place,row.collector,row.narrator,row.year,row.translated,row.archiveSignature,row.sourceUrl,new URL(`${base}teikas/${row.id}/`,location.origin).href]);
   const blob=new Blob(['\uFEFF'+[columns,...values].map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const href=URL.createObjectURL(blob),link=document.createElement('a');link.href=href;link.download='teikas-statistics-selection.csv';link.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
  }
 });
 root.addEventListener('input',event=>{
  if((event.target as HTMLElement).id!=='ml-dash-type-search')return;
  const input=event.target as HTMLInputElement;typeQuery=input.value;
  const chart=root.querySelector('.ml-type-chart');
  if(chart){
   hideTooltip();
   const replacement=document.createElement('div');replacement.innerHTML=typesChart();
   // Keep the focused input and its caret intact while updating chart results.
   for(const selector of ['.ml-chapter-mosaic','.ml-chart-details']){
    const current=chart.querySelector(selector),next=replacement.querySelector(selector);
    if(current&&next)current.replaceWith(next);
   }
   window.dispatchEvent(new Event('lucide-refresh'));
  }
 });
 document.addEventListener('keydown',event=>{
  if(panelOpen&&document.getElementById('ml-dashboard')?.hidden===false&&matchMedia('(max-width:950px)').matches&&event.key==='Tab'){
   const focusable=[...root.querySelectorAll<HTMLElement>('.ml-text-panel a[href],.ml-text-panel button:not(:disabled)')];
   const first=focusable[0],last=focusable.at(-1);
   if(event.shiftKey&&(document.activeElement===first||!root.querySelector('.ml-text-panel')?.contains(document.activeElement))){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&(document.activeElement===last||!root.querySelector('.ml-text-panel')?.contains(document.activeElement))){event.preventDefault();first?.focus();}
  }
  if(event.key==='Escape'&&panelOpen&&document.getElementById('ml-dashboard')?.hidden===false){panelOpen=false;render();options.stateChange();root.querySelector<HTMLElement>('[data-toggle-texts]')?.focus({preventScroll:true});}
 });
 matchMedia('(max-width:950px)').addEventListener('change',()=>render());
 return {read,write,render};
}
