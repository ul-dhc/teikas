import { enhanceSelects } from './select-menu';
import {createNetwork} from './network';
import {dashboardCopy} from './copy';
import {flattenTypes, selectRecords, countsBy, selectionLink, UNKNOWN} from './statistics.js';
import type {types as sourceTypes, topics as sourceTopics} from './data';

type Type = typeof sourceTypes[number];
type Topic = typeof sourceTopics[number];
type Filter = 'county' | 'collector' | 'narrator' | 'decade' | 'translation';
type Filters = Partial<Record<Filter,string>>;
type Row = Type['records'][number] & {typeId:string;code:string;typeLv:string;typeDe:string;topic:string};
type Scope = {topic?:Topic;type?:Type};
type Options = {types:Type[];topics:Topic[];base:string;lang:()=> 'lv'|'de'|'en';scopeChange:(topic?:Topic,type?:Type)=>void;stateChange:()=>void;metadataLabels:Record<string,Record<string,string>>};
export function createDashboard(options: Options) {
 const {types,topics,base,lang,metadataLabels} = options;
 const named=(field:string,value:string)=>metadataLabels[field]?.[value]||value;
 const all = flattenTypes(types) as Row[];
 const root = document.getElementById('ml-dashboard-content')!;
 const networkEnabled=!!root.closest('.ml-data-page');
 let view='overview';
 const network=createNetwork({types,topics,lang,metadataLabels,sync:options.stateChange,change:()=>{previewSize=12;render();options.stateChange();}});
 network.attach(root);
 const tr = (key:keyof typeof dashboardCopy.en) => dashboardCopy[lang()][key];
 const esc = (value:unknown) => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 const name = (type:Type) => type[lang()]||type.lv;
 const key = (type:Type) => type.code.replace(/\s/g,'');
 type Sort = 'count-desc'|'count-asc'|'name'|'code';
 const sortFields=['topic','type','county','collector'];
 let sorts:Record<string,Sort> = {};
 let filters:Filters = {};
 let scope:Scope = {};
 let panelOpen = false;
 let previewSize = 12;
 let typeQuery = '';
 let textMode = localStorage.getItem('teikas-network-content-mode') || 'parallel';
 const cohort = (skip='') => selectRecords(all,{topic:scope.topic?.id,type:scope.type?.id},filters,skip) as Row[];
 const countUnique = (rows:Row[],field:'county'|'collector'|'narrator'|'typeId') => new Set(rows.map(row=>row[field]).filter(Boolean)).size;
 function read(params:URLSearchParams) {
  view=networkEnabled&&params.get('view')==='network'?'network':'overview';
  network.read(params);
  filters = {};
  sorts = {};
  for(const field of sortFields){const value=params.get(`sort_${field}`);if(value&&['count-desc','count-asc','name',...(field==='type'?['code']:[])].includes(value))sorts[field]=value as Sort;}
  for (const field of ['county','collector','narrator','decade','translation'] as Filter[]) {
   const value=params.get(field);
   if (!value || (field==='decade'&&view==='network')) continue;
   if (field==='decade' && value!=='undated' && !all.some(row=>row.year&&String(Math.floor(Number(row.year)/10)*10)===value)) continue;
   if (field==='translation' && !['translated','original'].includes(value)) continue;
   if (['county','collector','narrator'].includes(field) && value!==UNKNOWN && !all.some(row=>(row as any)[field]===value)) continue;
   filters[field]=value;
  }
  panelOpen=params.get('texts')==='1';
  typeQuery=''; previewSize=12;
 }
 function write(params:URLSearchParams) {
  if(networkEnabled&&view==='network'){params.set('view','network');network.write(params);}
  for (const [field,value] of Object.entries(filters)) if(value)params.set(field,value);
  if(panelOpen)params.set('texts','1');
  for(const [field,value] of Object.entries(sorts))if(value!=='count-desc')params.set(`sort_${field}`,value);
 }
 function ring(value:number, total:number, label:string, tone='blue') {
  const percent=new Intl.NumberFormat(lang(),{maximumFractionDigits:1}).format(total?value/total*100:0);
  return `<div class="ml-ring tone-${tone}" style="--ring-share:${total?value/total*100:0}%" role="img" aria-label="${esc(label)}: ${value} / ${total}"><div><strong>${percent}%</strong></div></div>`;
 }
 function metrics(rows:Row[]) {
  const dates=rows.filter(row=>row.year).length;
  const values=[
   {label:tr('selection'),value:rows.length,icon:'file-stack',note:`${Math.round(rows.length/all.length*100)}% ${tr('fullCollection')}`,tone:'blue'},
   {label:tr('types'),value:countUnique(rows,'typeId'),icon:'layers',note:tr('legendTypes'),tone:'rose'},
   {label:tr('counties'),value:countUnique(rows,'county'),icon:'map-pin',note:tr('placesKnown'),tone:'mint'},
   {label:tr('collectors'),value:countUnique(rows,'collector'),icon:'notebook-pen',note:tr('collectorsKnown'),tone:'blue'},
  ];
  return `<div class="ml-kpis">${values.map(v=>`<article class="ml-kpi tone-${v.tone}"><div class="ml-kpi-icon"><i data-lucide="${v.icon}"></i></div><div><span>${v.label}</span><strong ${v.label===tr('selection')?'data-selected-count':''}>${v.value.toLocaleString(lang())}</strong><small>${v.note}</small></div></article>`).join('')}<article class="ml-kpi tone-mint">${ring(dates,rows.length,tr('dated'),'mint')}<div><span>${tr('dated')}</span><strong>${dates.toLocaleString(lang())}</strong><small>${rows.length-dates} ${tr('undated').toLowerCase()}</small></div></article></div>`;
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
  const max=Math.max(...counts.values(),1);
  return `<section class="ml-dash-card ml-topic-chart">${chartHeading(tr('topics'),sortControl('topic',tr('topics')))}<ol class="ml-facet-list">${[...topics].sort((a,b)=>compare('topic',{count:counts.get(a.id)||0,label:a[lang()]},{count:counts.get(b.id)||0,label:b[lang()]})).map(topic=>rowButton('topic',topic.id,topic[lang()],counts.get(topic.id)||0,max,scope.topic?.id===topic.id)).join('')}</ol></section>`;
 }
 function typesChart() {
  const counts=countsBy(cohort('type'),'typeId') as Map<string,number>;
  const set=types.filter(type=>(!scope.topic||type.topic===scope.topic.id)).sort((a,b)=>compare('type',{count:counts.get(a.id)||0,label:name(a),code:a.code},{count:counts.get(b.id)||0,label:name(b),code:b.code}));
  const max=Math.max(...counts.values(),1);
  const compact=typeQuery.toLowerCase().replace(/\s/g,'');
  const visible=set.filter(type=>!compact||`${type.code}${type.lv}${type.de}`.toLowerCase().replace(/\s/g,'').includes(compact));
  return `<section class="ml-dash-card ml-type-chart">${chartHeading(tr('types'),sortControl('type',tr('types')))}<label class="ml-type-chart-search"><span class="sr-only">${tr('typeSearch')}</span><input class="platform-search" type="search" id="ml-dash-type-search" placeholder="${tr('typeSearch')}" value="${esc(typeQuery)}"/></label><ol class="ml-facet-list">${visible.map(type=>rowButton('type',key(type),name(type),counts.get(type.id)||0,max,scope.type?.id===type.id,type.code)).join('')}</ol></section>`;
 }
 function namedChart(field:'county'|'collector'|'narrator',label:string) {
  const counts=countsBy(cohort(field),field) as Map<string,number>;
  if(filters[field]&&!counts.has(filters[field]!))counts.set(filters[field]!,0);
  const sorted=[...counts].sort((a,b)=>compare(field,{count:a[1],label:a[0]===UNKNOWN?tr('unknown'):named(field,a[0])},{count:b[1],label:b[0]===UNKNOWN?tr('unknown'):named(field,b[0])}));
  const max=Math.max(...counts.values(),1);
  return `<section class="ml-dash-card ml-${field}-chart">${chartHeading(label,sortControl(field,label))}<ol class="ml-facet-list">${sorted.map(([value,count])=>rowButton(field,value,value===UNKNOWN?tr('unknown'):named(field,value),count,max,filters[field]===value)).join('')}</ol></section>`;
 }
 function datesChart() {
  const counts=countsBy(cohort('decade'),'decade') as Map<string,number>;
  const dated=all.filter(row=>row.year).map(row=>Math.floor(Number(row.year)/10)*10);
  const first=Math.min(...dated),last=Math.max(...dated),max=Math.max(...[...counts].filter(([key])=>key!=='undated').map(([,n])=>n),1);
  const bins=Array.from({length:(last-first)/10+1},(_,i)=>String(first+i*10));
  return `<section class="ml-dash-card ml-time-chart">${chartHeading(tr('years'))}<p class="ml-chart-subtitle">${tr('dateCaption')}</p><ol class="ml-histogram">${bins.map(decade=>{const count=counts.get(decade)||0,selected=filters.decade===decade;return `<li><button type="button" data-facet="decade" data-value="${decade}" aria-pressed="${selected}" class="${selected?'is-selected':''}" ${!count&&!selected?'disabled':''} aria-label="${decade}–${Number(decade)+9}: ${count} ${tr('corpus')}"><b>${count}</b><span class="ml-histogram-track" aria-hidden="true"><span style="height:${count/max*100}%"></span></span><small>${decade}</small></button></li>`}).join('')}</ol><button class="ml-undated-choice ${filters.decade==='undated'?'is-selected':''}" type="button" data-facet="decade" data-value="undated" aria-pressed="${filters.decade==='undated'}">${tr('undated')} <strong>${counts.get('undated')||0}</strong></button></section>`;
 }
 function translationChart() {
  const rows=cohort('translation');const counts=countsBy(rows,'translation') as Map<string,number>;
  const translated=counts.get('translated')||0;
  return `<section class="ml-dash-card ml-translation-chart">${chartHeading(tr('translation'))}<div class="ml-donut-layout">${ring(translated,rows.length,tr('translated'),'mint')}<ol class="ml-donut-legend">${['translated','original'].map(value=>`<li><button type="button" data-facet="translation" data-value="${value}" aria-pressed="${filters.translation===value}" class="${filters.translation===value?'is-selected':''}"><span class="ml-legend-dot ${value}"></span><span>${tr(value as 'translated'|'original')}</span><b>${counts.get(value)||0}</b></button></li>`).join('')}</ol></div></section>`;
 }
 function label(field:Filter,value:string) {
  if(value===UNKNOWN)return tr('unknown');
  if(field==='decade')return value==='undated'?tr('undated'):`${value}–${Number(value)+9}`;
  if(field==='translation')return tr(value as 'translated'|'original');
  return named(field,value);
 }
 function chips() {
  const choices:Array<{field:string;value:string;label:string}>=[];
  if(scope.topic)choices.push({field:'topic',value:scope.topic.id,label:scope.topic[lang()]});
  if(scope.type)choices.push({field:'type',value:key(scope.type),label:scope.type.code});
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
  return `<aside class="ml-text-panel ${networkEnabled?'ml-inline-texts':''} ${view==='network'?'ml-network-texts':''}" aria-labelledby="ml-text-panel-title" ${!networkEnabled&&matchMedia('(max-width:950px)').matches?'role="dialog" aria-modal="true"':''}><div class="ml-text-panel-heading"><div><span>${tr('preview')}</span><h3 id="ml-text-panel-title">${tr('sideTitle')} <b>${rows.length}</b></h3></div><button type="button" data-close-texts aria-label="${tr('close')}"><i data-lucide="x"></i></button></div><p class="ml-panel-hint">${tr('sideHint')}</p>${rows.length?`<a class="icon-link ml-selection-explorer" href="${selectionLink(base,rows)}" target="_blank" rel="noopener">${tr('openExplorer')}<i data-lucide="external-link"></i></a>`:''}<div class="ml-preview-mode" role="group" aria-label="${tr('textLanguage')}">${['lv','de','parallel'].map(mode=>`<button type="button" data-preview-mode="${mode}" aria-pressed="${textMode===mode}">${mode==='parallel'?'LV & DE':mode.toUpperCase()}</button>`).join('')}</div><div class="ml-preview-scroll">${!rows.length?`<p>${tr('noRecords')}</p><p>${tr('emptyHint')}</p>`:`<ol>${sorted.slice(0,previewSize).map(row=>`<li><small>${esc(row.sourceTextId)} · ${esc(row.code)}</small><h4><a href="${base}teksti/${row.id}/" target="_blank" rel="noopener">${esc(textMode==='de'?(row.titleDe||row.titleLv):row.titleLv)}</a></h4><p class="ml-preview-metadata">${esc([row.placeName,row.year,named('collector',row.collector)].filter(Boolean).join(' · '))}</p>${previewText(row)}<a class="ml-read-full icon-link" href="${base}teksti/${row.id}/" target="_blank" rel="noopener">${tr('read')}<i data-lucide="external-link"></i></a></li>`).join('')}</ol>${sorted.length>previewSize?`<button type="button" data-more-texts class="ml-more-texts">${tr('more')} (${Math.min(12,sorted.length-previewSize)})</button>`:''}`}</div></aside>`;
 }
 function networkFilters() {
  const select=(field:string,title:string,current:string,choices:Array<[string,string]>)=>`<label class="ml-network-filter-field">${title}<select aria-label="${title}" data-network-filter="${field}"><option value="">${tr('all')}</option>${choices.map(([value,text])=>`<option value="${esc(value)}" ${current===value?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`;
  return select('topic',tr('topics'),scope.topic?.id||'',topics.map(t=>[t.id,t[lang()]]))+
   select('type',tr('types'),scope.type?key(scope.type):'',types.filter(t=>!scope.topic||t.topic===scope.topic.id).map(t=>[key(t),`${t.code} · ${name(t)}`]))+
   (['county','collector','narrator'] as const).map(field=>select(field,tr(field==='county'?'counties':field==='collector'?'collectors':'narrators'),filters[field]||'',[...countsBy(cohort(field),field)].sort((a,b)=>named(field,a[0]).localeCompare(named(field,b[0]),lang())).map(([value,count])=>[value,`${value===UNKNOWN?tr('unknown'):named(field,value)} (${count})`]))).join('')+
   select('translation',tr('translation'),filters.translation||'',[['translated',tr('translated')],['original',tr('original')]]);
 }
 const resultRows=():Row[]=>view==='network'?network.selectedRows(cohort()):cohort();
 function render(nextScope:Scope=scope) {
  const previousStage=root.querySelector('.ml-network-stage');
  const stageScroll={top:previousStage?.scrollTop||0,left:previousStage?.scrollLeft||0};
  if(scope.topic!==nextScope.topic)typeQuery='';
  if(scope.topic!==nextScope.topic||scope.type!==nextScope.type)previewSize=12;
  scope=nextScope;
  const rows=cohort();
  const networkHtml=view==='network'?network.render(rows,networkFilters(),panelOpen,`<button type="button" data-export-stats ${!rows.length?'disabled':''}><i data-lucide="download"></i>${tr('csv')}</button>`):'';
  const selectedRows=resultRows();
  const periods=[...new Set(all.filter(row=>row.year).map(row=>String(Math.floor(Number(row.year)/10)*10)))].sort();
  root.innerHTML=`<div class="ml-research-dashboard ${panelOpen&&!networkEnabled?'has-text-panel':''}"><div class="ml-dashboard-canvas"><header class="ml-research-heading">${networkEnabled?`<div class="ml-data-view-switch" role="group" aria-label="${network.copy().network}">${['overview','network'].map(mode=>`<a href="${base}dati/tikls/${location.search}#${mode}" data-data-view="${mode}" aria-current="${view===mode?'page':'false'}"><i data-lucide="${mode==='overview'?'chart-no-axes-column':'network'}"></i>${mode==='overview'?network.copy().overview:network.copy().network}</a>`).join('')}</div>`:''}<div class="ml-research-intro"><h2 id="ml-dashboard-title" class="${networkEnabled?'sr-only':''}" tabindex="-1">${view==='network'?network.copy().title:tr('title')}</h2>${networkEnabled?'':`<p>${tr('hint')}</p>`}</div>${view==='network'?'':`<div class="ml-research-actions">${view==='network'?'':`<label class="ml-period-control"><span class="sr-only">${tr('period')}</span><select id="ml-period"><option value="">${tr('allYears')}</option>${periods.map(period=>`<option value="${period}" ${filters.decade===period?'selected':''}>${period}–${Number(period)+9}</option>`).join('')}<option value="undated" ${filters.decade==='undated'?'selected':''}>${tr('undated')}</option></select></label>`}<button type="button" data-export-stats ${!rows.length?'disabled':''}><i data-lucide="download"></i>${tr('csv')}</button><button type="button" data-share-stats aria-label="${tr('share')}" title="${tr('share')}"><i data-lucide="link"></i></button>${view==='network'?'':`<button type="button" data-toggle-texts class="ml-show-texts" aria-expanded="${panelOpen}"><i data-lucide="list"></i><span>${tr('texts')}</span><b>${selectedRows.length}</b></button>`}</div>`}</header><p id="ml-stats-status" role="status"></p>${chips()}${view==='network'?networkHtml:`${metrics(rows)}<div class="ml-research-grid">${topicsChart()}${typesChart()}${namedChart('county',tr('counties'))}${datesChart()}${namedChart('collector',tr('collectors'))}${translationChart()}</div>`}${!rows.length?`<div class="ml-zero-state" role="status"><strong>${tr('noRecords')}</strong><p>${tr('emptyHint')}</p><button type="button" data-reset-stats>${tr('reset')}</button></div>`:''}</div>${textPanel(selectedRows)}</div>`;
  if(view==='network'){const panel=root.querySelector('.ml-network-texts');if(panel)root.querySelector('.ml-network-surface')?.append(panel);}
  network.mount(root);
  enhanceSelects(root);
  const stage=root.querySelector('.ml-network-stage');if(stage&&!network.graphChanged){stage.scrollTop=stageScroll.top;stage.scrollLeft=stageScroll.left;}
  const modal=!networkEnabled&&panelOpen&&document.getElementById('ml-dashboard')?.hidden===false&&matchMedia('(max-width:950px)').matches;
  document.querySelectorAll<HTMLElement>('.ml-dashboard-canvas,.site-header,.ml-hero,.ml-view-switch,.ml-method,.site-footer').forEach(element=>element.inert=modal);
  document.querySelectorAll<HTMLElement>('.ml-research-heading,.ml-data-view-switch,.ml-dashboard-filters,.site-header,.ml-hero,.site-footer').forEach(element=>element.inert=modal||network.presentation);
  document.body.classList.toggle('ml-network-presented',network.presentation);
  document.body.classList.toggle('ml-panel-visible',modal);
  document.documentElement.classList.toggle('ml-modal-open',modal);
  if(modal&&!root.querySelector('.ml-text-panel')?.contains(document.activeElement))root.querySelector<HTMLElement>('[data-close-texts]')?.focus({preventScroll:true});
  window.dispatchEvent(new Event('lucide-refresh'));
 }
 function update() { network.reset();previewSize=12;render();options.stateChange(); }
 function toggle(field:string,value:string) {
  network.reset();
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
  network.reset();
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
 root.addEventListener('keydown',event=>{
  const target=event.target as HTMLElement;
  if(target.dataset.sort&&['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();openSortMenu(target,event.key==='ArrowUp');return;}
  const menu=target.closest<HTMLElement>('.ml-sort-menu');if(!menu)return;
  const trigger=root.querySelector<HTMLElement>(`[aria-controls="${menu.id}"]`)!;
  const items=[...menu.querySelectorAll<HTMLElement>('button')],index=items.indexOf(target);
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next].focus();}
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeSortMenus();trigger.focus({preventScroll:true});}
  if(event.key==='Tab'){closeSortMenus();trigger.focus({preventScroll:true});}
 });
 root.addEventListener('click',async event=>{
  if(network.suppressClick)return;
  const target=event.target as Element;
  if(target.closest('[data-network-action="fullscreen"]'))panelOpen=false;
  if(network.handleClick(root,target,event))return;
  const button=target.closest<HTMLElement>('button,a[data-data-view]');if(!button)return;
  if(button.dataset.dataView){if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();view=button.dataset.dataView;if(view==='network')delete filters.decade;network.reset();render();options.stateChange();root.querySelector<HTMLElement>(`[data-data-view="${view}"]`)?.focus({preventScroll:true});return;}
  if(button.dataset.networkAction==='texts'){panelOpen=!panelOpen;previewSize=12;render();options.stateChange();if(panelOpen){const panel=root.querySelector<HTMLElement>('.ml-network-texts');panel?.scrollIntoView({block:'start',behavior:'instant'});panel?.querySelector<HTMLElement>('[data-close-texts]')?.focus({preventScroll:true});}else root.querySelector<HTMLElement>('[data-network-action="texts"]')?.focus({preventScroll:true});return;}
  if(button.dataset.sort){const open=button.getAttribute('aria-expanded')==='true';if(open)closeSortMenus();else openSortMenu(button);return;}
  if(button.dataset.sortOption){const field=button.dataset.sortOption;sorts[field]=button.dataset.sortValue as Sort;render();options.stateChange();root.querySelector<HTMLElement>(`[data-sort="${field}"]`)?.focus({preventScroll:true});return;}
  if(button.dataset.facet){const field=button.dataset.facet,value=button.dataset.value!;toggle(field,value);root.querySelector<HTMLElement>(`[data-facet="${CSS.escape(field)}"][data-value="${CSS.escape(value)}"]`)?.focus({preventScroll:true});return;}
  if(button.dataset.removeFilter){remove(button.dataset.removeFilter);return;}
  if(button.hasAttribute('data-reset-stats')){network.reset();filters={};typeQuery='';options.scopeChange(undefined,undefined);return;}
  if(button.hasAttribute('data-toggle-texts')||button.hasAttribute('data-close-texts')){
   const closing=panelOpen;panelOpen=!closing;render();options.stateChange();
   const target=closing?root.querySelector<HTMLElement>(view==='network'?'[data-network-action="texts"]':'[data-toggle-texts]'):root.querySelector<HTMLElement>('[data-close-texts]');if(networkEnabled&&!closing)root.querySelector<HTMLElement>('.ml-inline-texts')?.scrollIntoView({block:'start',behavior:'instant'});target?.focus({preventScroll:true});return;
  }
  if(button.dataset.previewMode){textMode=button.dataset.previewMode;render();root.querySelector<HTMLElement>(`[data-preview-mode="${textMode}"]`)?.focus({preventScroll:true});return;}
  if(button.hasAttribute('data-more-texts')){const scroll=root.querySelector('.ml-preview-scroll')?.scrollTop||0;previewSize+=12;render();const panel=root.querySelector('.ml-preview-scroll');if(panel)panel.scrollTop=scroll;return;}
  if(button.hasAttribute('data-share-stats')){
   try{await navigator.clipboard.writeText(location.href);document.getElementById('ml-stats-status')!.textContent=tr('copied');}catch{document.getElementById('ml-stats-status')!.textContent=tr('copyFailed');}return;
  }
  if(button.hasAttribute('data-export-stats')){
   const rows=resultRows(),columns=['source_id','record_id','chapter_code','chapter_lv','chapter_de','volume','title_lv','title_de','place','source','collector','narrator','collection_year','german_translation','archive_signature','source_url','record_url'];
   const cell=(value:unknown)=>{const text=String(value??'');return `"${(/^[=+@\-\t\r]/.test(text)?"'"+text:text).replace(/"/g,'""')}"`;};
   const values=rows.map(row=>[row.sourceTextId,row.id,row.code,row.typeLv,row.typeDe,row.topic,row.titleLv,row.titleDe,named('county',row.county),named('place',row.place),named('collector',row.collector),named('narrator',row.narrator),row.year,row.translated,row.archiveSignature,row.sourceUrl,new URL(`${base}teksti/${row.id}/`,location.origin).href]);
   const blob=new Blob(['\uFEFF'+[columns,...values].map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const href=URL.createObjectURL(blob),link=document.createElement('a');link.href=href;link.download='teikas-network-selection.csv';link.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
  }
 });
 root.addEventListener('change',event=>{
  const target=event.target as HTMLSelectElement;
  if(network.handleSetting(root,target))return;
  if(target.dataset.networkFilter){const field=target.dataset.networkFilter;network.reset();if(field==='topic'){options.scopeChange(topics.find(t=>t.id===target.value),undefined);}else if(field==='type'){const type=types.find(t=>key(t)===target.value);options.scopeChange(type?topics.find(t=>t.id===type.topic):scope.topic,type);}else{if(target.value)filters[field as Filter]=target.value;else delete filters[field as Filter];update();}root.querySelector<HTMLElement>(`[data-network-filter="${field}"]`)?.focus({preventScroll:true});return;}
  if((event.target as HTMLElement).id==='ml-period'){const value=(event.target as HTMLSelectElement).value;if(value)filters.decade=value;else delete filters.decade;update();root.querySelector<HTMLElement>('#ml-period')?.focus({preventScroll:true});}
 });
 root.addEventListener('input',event=>{
  if((event.target as HTMLElement).id!=='ml-dash-type-search')return;
  const input=event.target as HTMLInputElement;typeQuery=input.value;const start=input.selectionStart,end=input.selectionEnd;
  const chart=root.querySelector('.ml-type-chart');if(chart){const replacement=document.createElement('div');replacement.innerHTML=typesChart();chart.replaceWith(replacement.firstElementChild!);const next=root.querySelector<HTMLInputElement>('#ml-dash-type-search')!;next.focus({preventScroll:true});if(start!==null&&end!==null)next.setSelectionRange(start,end);}
 });
 document.addEventListener('keydown',event=>{
  if(!networkEnabled&&panelOpen&&document.getElementById('ml-dashboard')?.hidden===false&&matchMedia('(max-width:950px)').matches&&event.key==='Tab'){
   const focusable=[...root.querySelectorAll<HTMLElement>('.ml-text-panel a[href],.ml-text-panel button:not(:disabled)')];
   const first=focusable[0],last=focusable.at(-1);
   if(event.shiftKey&&(document.activeElement===first||!root.querySelector('.ml-text-panel')?.contains(document.activeElement))){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&(document.activeElement===last||!root.querySelector('.ml-text-panel')?.contains(document.activeElement))){event.preventDefault();first?.focus();}
  }
  if(event.key==='Escape'&&panelOpen&&document.getElementById('ml-dashboard')?.hidden===false){panelOpen=false;render();options.stateChange();root.querySelector<HTMLElement>(view==='network'?'[data-network-action="texts"]':'[data-toggle-texts]')?.focus({preventScroll:true});}
 });
 matchMedia('(max-width:950px)').addEventListener('change',()=>render());
 return {read,write,render};
}
