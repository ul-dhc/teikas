import {matchPerson,textsHref,explorationHrefs,sharedPersonSelectionUrl,createDiscoveryOrder} from './model.js';
import {decodeSelection} from '../lib/selection.js';
type Lang='lv'|'de'|'en';
const ui=JSON.parse(document.querySelector('#ui-translations')!.textContent||'{}') as Record<string,Record<Lang,string>>;
const copy=Object.fromEntries((['lv','de','en'] as Lang[]).map(lang=>[lang,Object.fromEntries(Object.entries(ui).filter(([key])=>key.startsWith('persons.')).map(([key,value])=>[key.slice(8),value[lang]]))])) as Record<Lang,Record<string,string>>;
type Group={id:string;label:string;ids:string[];unknown?:boolean};
type Profile={id:string;name:string;sortName:string;role:'collector'|'narrator';unknown:boolean;gender:string;notes:string;ids:string[];themes:Group[];places:Group[];peers:Group[]};
type RecordRow={id:string;titleLv:string;titleDe:string;excerptLv:string;excerptDe:string;chapterLv:string;chapterDe:string;placeId:string;place:string};
const root=document.querySelector<HTMLElement>('[data-people]')!;
const {base,profiles,records}=JSON.parse(document.querySelector('#people-data')!.textContent!) as {base:string;profiles:Profile[];records:RecordRow[]};
const discoveryOrder=createDiscoveryOrder(profiles);
const byId=new Map(records.map(r=>[r.id,r])),peopleById=new Map(profiles.map(p=>[p.id,p]));
const names=new Map<string,Profile[]>();for(const p of profiles){const key=p.name.trim().toLocaleLowerCase('lv');names.set(key,[...(names.get(key)||[]),p]);}
const el=<T extends HTMLElement=HTMLElement>(s:string)=>root.querySelector<T>(s)!;
const query=el<HTMLInputElement>('[data-query]'),theme=el<HTMLSelectElement>('[data-theme-filter]'),place=el<HTMLSelectElement>('[data-place-filter]'),sort=el<HTMLSelectElement>('[data-sort]'),gender=el<HTMLSelectElement>('[data-gender]'),minimum=el<HTMLInputElement>('[data-minimum]'),savedOnly=el<HTMLInputElement>('[data-saved-only]');
const params=new URLSearchParams(location.search);let role=params.get('role')||'',view=params.get('view')==='table'?'table':'list',page=Math.max(1,Number(params.get('page'))||1),focusId=params.get('person')||params.get('collector')||params.get('narrator')||'',selection=new Set(decodeSelection(params.get('selection')||'',profiles)),selectionOnly=params.has('selection'),filtered:Profile[]=[];
let saved=new Set<string>();try{saved=new Set(JSON.parse(localStorage.getItem('teikas-person-saved')||localStorage.getItem('teikas-pins')||'[]').filter((id:string)=>peopleById.has(id)));}catch{}
const expanded=new Set<string>(focusId?[focusId]:[]),size=20;
query.value=params.get('q')||'';sort.value=[...sort.options].some(option=>option.value===params.get('sort'))?params.get('sort')!:'random';gender.value=params.get('gender')||'';minimum.value=String(Math.max(1,Number(params.get('min'))||1));savedOnly.checked=params.get('saved')==='1'||params.get('pinned')==='1';
const filterQuery=matchMedia('(max-width:850px)');let mobileFiltersOpen=Boolean(params.get('theme')||params.get('place')||params.get('gender')||params.get('min')||params.get('saved'));
function updateFilterDrawer(){el('.filter-sidebar').classList.toggle('filters-open',mobileFiltersOpen);el('#people-filter-body').hidden=filterQuery.matches&&!mobileFiltersOpen;el('[data-filter-toggle]').setAttribute('aria-expanded',String(mobileFiltersOpen));}
filterQuery.addEventListener('change',updateFilterDrawer);updateFilterDrawer();
const language=():Lang=>{const value=document.documentElement.dataset.uiLang;return value==='de'||value==='en'?value:'lv';};
const t=()=>copy[language()],esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const label=(p:Profile)=>t()[p.role==='collector'?(p.gender==='F'?'collectorF':'collector'):(p.gender==='F'?'narratorF':'narrator')];
const themeNames=new Map(records.map(r=>[r.chapterLv,{lv:r.chapterLv,de:r.chapterDe}]));
const themeLabel=(id:string)=>language()==='de'?(themeNames.get(id)?.de||id):id;
const localTitle=(r:RecordRow)=>language()==='de'?(r.titleDe||r.titleLv):(r.titleLv||r.titleDe);
const localExcerpt=(r:RecordRow)=>(language()==='de'?(r.excerptDe||r.excerptLv):(r.excerptLv||r.excerptDe))||'';
const legendCount=(n:number)=>language()==='lv'?`${n} ${n%10===1&&n%100!==11?'teika':'teikas'}`:`${n} ${language()==='de'?(n===1?'Sage':'Sagen'):(n===1?'legend':'legends')}`;
let excerptsLoaded=false,excerptsRequest:Promise<void>|null=null;
function syncMinimum(){
 const count=Number(minimum.value),singular=new Intl.PluralRules(language()).select(count)==='one';
 el('[data-minimum-output]').textContent=count<=1?t().all:`${count}+`;
 el('[data-minimum-help]').textContent=t()[singular?'minimumHelpOne':'minimumHelpOther'].replace('{count}',String(count));
}
function loadExcerpts(){
 if(excerptsLoaded)return Promise.resolve();
 if(!excerptsRequest)excerptsRequest=fetch(`${base}person-excerpts.json`).then(response=>{if(!response.ok)throw Error('excerpts');return response.json();}).then((rows:RecordRow[])=>{for(const row of rows){const record=byId.get(row.id);if(record)Object.assign(record,row);}excerptsLoaded=true;}).catch(()=>{excerptsRequest=null;});
 return excerptsRequest;
}
async function refreshExcerpts(){await loadExcerpts();if(!excerptsLoaded)return;root.querySelectorAll<HTMLDetailsElement>('[data-detail][open]').forEach(details=>{details.querySelector('[data-detail-content]')!.innerHTML=detailsBody(peopleById.get(details.dataset.detail!)!);});}
const peerLabel=(p:Profile,g:Group)=>g.unknown?(p.role==='narrator'?t().unknownCollector:t().unknownNarrator):g.label;
function personHref(id:string){return `${base}personas/?person=${encodeURIComponent(id)}`;}
function populateFilters(){
 const previousTheme=theme.value,previousPlace=place.value;
 theme.innerHTML=`<option value="">${t().allThemes}</option>`+[...themeNames.keys()].filter(Boolean).sort((a,b)=>themeLabel(a).localeCompare(themeLabel(b),language())).map(id=>`<option value="${esc(id)}">${esc(themeLabel(id))}</option>`).join('');
 const places=new Map(records.filter(r=>r.placeId).map(r=>[r.placeId,r.place]));
 place.innerHTML=`<option value="">${t().allPlaces}</option>`+[...places].sort((a,b)=>a[1].localeCompare(b[1],'lv')).map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('');
 theme.value=previousTheme;place.value=previousPlace;
}
function syncPersonFilterMenus(){
 for(const [key,select,searchKey] of [['theme',theme,'map.searchThemes'],['place',place,'map.searchPlaces'],['gender',gender,'map.searchGenders']] as const){
  const search=el<HTMLInputElement>(`[data-person-filter-search="${key}"]`),searchLabel=ui[searchKey][language()];
  search.placeholder=searchLabel+'…';search.setAttribute('aria-label',searchLabel);
  el(`[data-person-filter-search-label="${key}"]`).textContent=searchLabel;
  el(`[data-person-filter-label="${key}"]`).textContent=select.value?select.selectedOptions[0].textContent:(key==='gender'?t().all:ui['filters.allF'][language()]);
  const term=search.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
  el(`[data-person-filter-options="${key}"]`).innerHTML=[...select.options].map(option=>{
   const matches=(option.textContent||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().includes(term);
   return `<label ${matches?'':'hidden'}><input type="radio" name="person-filter-${key}" value="${esc(option.value)}" data-person-filter-choice="${key}" ${option.selected?'checked':''} /><span>${esc(option.textContent)}</span></label>`;
  }).join('');
 }
 syncMinimum();
 minimum.setAttribute('aria-label',t().minimum);
 el('[data-person-download-label]').textContent=ui['browser.download'][language()];
 const hasSelection=Boolean(query.value.trim()||role||theme.value||place.value||gender.value||Number(minimum.value)>1||savedOnly.checked||focusId||selectionOnly);
 el<HTMLButtonElement>('[data-reset]').hidden=!hasSelection;
 el<HTMLButtonElement>('[data-copy-link]').hidden=!hasSelection;
 el('[data-copy-link]').dataset.tooltip=t().copyLink;
}
function syncUrl(){
 const next=new URLSearchParams();for(const [key,value] of Object.entries({q:query.value.trim(),role,theme:theme.value,place:place.value,sort:sort.value==='random'?'':sort.value,gender:gender.value,min:Number(minimum.value)>1?minimum.value:'',saved:savedOnly.checked?'1':'',view:view==='table'?'table':'',page:page>1?String(page):'',person:focusId,selection:[...selection].join(',')}))if(value)next.set(key,value);
 if(selectionOnly)next.set('selection',[...selection].join(','));
 history.replaceState(null,'',`${location.pathname}${next.size?'?'+next:''}`);
}
const personMatch=(p:Profile)=>matchPerson(p,byId,query.value,theme.value,place.value) as {records:RecordRow[];places:string[]};
function placeMatchHint(p:Profile){const places=personMatch(p).places;return places.length?`<p class="result-metadata person-summary" data-person-place-match>${esc(places.length===1?t().legendPlace:t().legendPlaces)}: ${places.map(esc).join(' · ')}</p>`:'';}
function groupLink(p:Profile,g:Group){return textsHref(base,p,g.ids);}
function groupList(p:Profile,groups:Group[],kind:'themes'|'places'|'peers'){
 const item=(g:Group)=>`<li><a href="${esc(kind==='peers'?personHref(g.id):groupLink(p,g))}"><span>${esc(kind==='themes'?themeLabel(g.id):kind==='peers'?peerLabel(p,g):g.label)}</span><span>${g.ids.length}</span></a></li>`;
 return `<ul>${groups.slice(0,5).map(item).join('')}</ul>${groups.length>5?`<details><summary>${t().showAll} (${groups.length})</summary><ul>${groups.slice(5).map(item).join('')}</ul></details>`:''}`;
}
function detailsBody(p:Profile){
 const related=personMatch(p).records as RecordRow[];
 const sameNames=(names.get(p.name.trim().toLocaleLowerCase('lv'))||[]).filter(other=>other.id!==p.id);
 return `<div class="person-detail-body">${sameNames.length?`<p class="result-metadata person-identity-note">${t().identity} ${sameNames.map(other=>`<a href="${esc(personHref(other.id))}">${esc(other.name)} · ${label(other)}</a>`).join(' · ')}</p>`:''}
 <div class="read-full-person person-detail-grid"><section class="person-stat"><h3 class="person-stat-title">${t().themes} (${p.themes.length})</h3>${groupList(p,p.themes,'themes')}</section><section class="person-stat"><h3 class="person-stat-title">${t().places} (${p.places.length})</h3>${groupList(p,p.places,'places')}</section>${p.peers.length?`<section class="person-stat"><h3 class="person-stat-title">${p.role==='narrator'?t().peersCollector:t().peersNarrator} (${p.peers.length})</h3>${groupList(p,p.peers,'peers')}</section>`:''}</div>
 <section class="person-excerpts"><h3 class="result-section-title">${t().preview}</h3><ol>${related.filter(r=>r.titleLv||r.titleDe).slice(0,2).map(r=>`<li><a href="${base}teksti/${encodeURIComponent(r.id)}/">${esc(localTitle(r))}</a><p class="result-excerpt">${esc(localExcerpt(r).slice(0,240))}${localExcerpt(r).length>240?'…':''}</p></li>`).join('')}</ol></section>

 ${p.notes?`<div class="result-metadata person-source"><p>${t().notes}: ${esc(p.notes)}</p></div>`:''}</div>`;
}
function explorationActions(p:Profile){
 const hrefs=explorationHrefs(base,p);
 const actions=[{href:hrefs.map,icon:'map-pin',label:t().map},{href:hrefs.network,icon:'network',label:t().network},{href:hrefs.overview,icon:'chart-no-axes-column',label:t().overview}];
 return `<div class="exploration-actions person-exploration-actions">${actions.map(action=>`<a href="${esc(action.href)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(`${action.label}: ${p.name}`)}" data-tooltip="${esc(action.label)}"><i data-lucide="${action.icon}" aria-hidden="true"></i></a>`).join('')}</div>`;
}
function saveButton(p:Profile){
 const pinned=saved.has(p.id),action=pinned?t().unpin:t().save;
 return `<button class="pin-button person-save" type="button" data-save="${esc(p.id)}" aria-pressed="${pinned}" aria-label="${esc(`${action}: ${p.name}`)}" data-tooltip="${esc(action)}"><i data-lucide="pin" aria-hidden="true"></i></button>`;
}
function row(p:Profile){
 const matches=personMatch(p).records,ids=matches.map(r=>r.id);
 return `<li class="result-card person-row${saved.has(p.id)?' is-pinned':''}" id="person-${esc(p.id)}"><div><h2><a href="${esc(personHref(p.id))}" data-open-person="${esc(p.id)}" aria-expanded="${expanded.has(p.id)}" aria-controls="person-details-${esc(p.id)}">${esc(p.name)}</a></h2><p class="result-metadata person-meta"><span class="person-role">${label(p)}</span><span>${legendCount(p.ids.length)}</span></p>
 ${placeMatchHint(p)}
 ${p.themes.length?`<p class="result-metadata person-summary">${t().themes}: ${p.themes.slice(0,3).map(g=>`<a href="${esc(groupLink(p,g))}">${esc(themeLabel(g.id))}</a>`).join(' · ')}</p>`:''}
 ${p.peers.length?`<p class="result-metadata person-summary">${p.role==='narrator'?t().peersCollector:t().peersNarrator}: ${p.peers.slice(0,2).map(g=>`<a href="${esc(personHref(g.id))}">${esc(peerLabel(p,g))}</a>`).join(' · ')}${p.peers.length>2?` (+${p.peers.length-2})`:''}</p>`:''}
 ${(theme.value||place.value||personMatch(p).places.length)?`<p class="result-metadata person-summary">${legendCount(matches.length)} ${t().matched}</p>`:''}</div>
 <div class="person-actions"><a class="read-full person-read" href="${esc(textsHref(base,p,ids))}">${t().read} (${ids.length}) <i data-lucide="arrow-right" aria-hidden="true"></i></a><div class="person-quick-actions">${explorationActions(p)}${saveButton(p)}</div></div>
 <details class="result-preview person-details" id="person-details-${esc(p.id)}" data-detail="${esc(p.id)}" ${expanded.has(p.id)?'open':''}><summary>${t().more}</summary><div data-detail-content>${expanded.has(p.id)?detailsBody(p):''}</div></details></li>`;
}
function table(rows:Profile[]){return `<div class="people-table-wrap" tabindex="0" role="region" aria-label="${t().table}"><table class="people-table"><thead><tr class="list-head person-table-row">${['name','role','count','gender'].map(field=>{const asc=field==='count'?'count-asc':field,desc=field==='count'?'count':`${field}-desc`,direction=sort.value===asc?'ascending':sort.value===desc?'descending':'none';return `<th scope="col" aria-sort="${direction}"><button type="button" data-person-column="${field}" aria-pressed="${direction!=='none'}">${esc(t()[field])} <i data-lucide="${direction==='ascending'?'arrow-up':direction==='descending'?'arrow-down':'arrow-up-down'}" aria-hidden="true"></i></button></th>`;}).join('')}<th scope="col"><span>${t().read}</span></th></tr></thead><tbody>${rows.map(p=>`<tr class="result-card person-table-row ${saved.has(p.id)?'is-pinned':''}"><td><h2><a href="${esc(personHref(p.id))}">${esc(p.name)}</a></h2>${placeMatchHint(p)}</td><td class="result-type">${label(p)}</td><td class="result-legendcount">${p.ids.length}</td><td class="result-gender">${p.gender==='F'?t().female:p.gender==='M'?t().male:t().unknown}</td><td><a class="read-full person-read" href="${esc(textsHref(base,p,personMatch(p).records.map((r:RecordRow)=>r.id)))}">${t().read} <i data-lucide="arrow-right" aria-hidden="true"></i></a><div class="person-quick-actions">${explorationActions(p)}${saveButton(p)}</div></td></tr>`).join('')}</tbody></table></div>`;}
const mobileCards=matchMedia('(max-width:850px)');
mobileCards.addEventListener('change',()=>render());
function render(){
 if (!saved.size) savedOnly.checked=false;
 el('[data-saved-only-filter]').hidden=!saved.size;
 const effectiveView=mobileCards.matches?'list':view;
 const workspace=el('.people-workspace');workspace.dataset.view='list';workspace.dataset.personView=effectiveView;
 filtered=profiles.filter(p=>(!role||p.role===role)&&(!gender.value||(gender.value==='unknown'?!p.gender:p.gender===gender.value))&&p.ids.length>=Math.max(1,Number(minimum.value)||1)&&(!savedOnly.checked||saved.has(p.id))&&(!focusId||p.id===focusId)&&(!selectionOnly||selection.has(p.id))&&personMatch(p).records.length>0);
 filtered.sort((a,b)=>{
  const pinned=Number(saved.has(b.id))-Number(saved.has(a.id));
  if(pinned)return pinned;
  const names=a.sortName.localeCompare(b.sortName,'lv');
  const field=sort.value.replace(/-desc$/,'');
  const value=(p:Profile)=>field==='role'?label(p):field==='gender'?(p.gender==='F'?t().female:p.gender==='M'?t().male:''):p.sortName;
  const first=value(a),second=value(b);
  const missing=field==='gender'?Number(!first)-Number(!second):0;
  const textOrder=first.localeCompare(second,language())*(sort.value.endsWith('-desc')?-1:1);
  const primary=sort.value==='random'?discoveryOrder.get(a.id)!-discoveryOrder.get(b.id)!:sort.value==='count'?b.ids.length-a.ids.length:sort.value==='count-asc'?a.ids.length-b.ids.length:missing||textOrder;
  return primary||names||a.id.localeCompare(b.id);
 });
 const totalPages=Math.max(1,Math.ceil(filtered.length/size));page=Math.min(page,totalPages);const rows=filtered.slice((page-1)*size,page*size);
 el('[data-result-status]').textContent=`${filtered.length.toLocaleString(language())} ${language()==='lv'&&filtered.length%10===1&&filtered.length%100!==11?'personas ieraksts':t().people}`;
 el('[data-person-results]').innerHTML=rows.length?(effectiveView==='table'?table(rows):`<ol class="results-list people-results">${rows.map(row).join('')}</ol>`):`<div class="people-empty"><strong>${t().empty}</strong><p>${t().adjust}</p></div>`;
 const pageNumbers=[...new Set([1,page-1,page,page+1,totalPages])].filter(n=>n>0&&n<=totalPages).sort((a,b)=>a-b);
 el('[data-person-pages]').innerHTML=totalPages>1?pageNumbers.map((n,index)=>`${index&&n-pageNumbers[index-1]>1?'…':''}${n===page?`<input class="pagination-current" data-person-page-current type="number" min="1" max="${totalPages}" value="${page}" aria-label="${esc(`${t().page} ${page} ${t().of} ${totalPages}`)}" />`:`<button type="button" data-page="${n}" aria-label="${esc(`${t().page} ${n}`)}">${n}</button>`}`).join(''):'';
 el('[data-person-page-label]').textContent=(window as any).teikasT?.('browser.page',{page,total:totalPages})||`${t().page} ${page} ${t().of} ${totalPages}`;

 root.querySelectorAll<HTMLElement>('[data-role]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.role===role)));
 root.querySelectorAll<HTMLButtonElement>('button[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===effectiveView)));
 el<HTMLButtonElement>('[data-export]').disabled=!filtered.length;
 el('[data-person-download]').dataset.hasSelection=String(filtered.length>0);
 const criterion=sort.value.startsWith('count')?'count':sort.value.replace(/-desc$/,'');
 el('[data-person-sort-label]').textContent=t()[({random:'randomOrder',name:'sortName',count:'sortCount',role:'sortRole',gender:'sortGender'} as Record<string,string>)[criterion]];
 const direction=el<HTMLButtonElement>('[data-person-sort-direction]'),descending=sort.value==='count'||sort.value.endsWith('-desc');
 direction.hidden=criterion==='random';direction.dataset.direction=descending?'descending':'ascending';
 const directionLabel=ui[descending?'browser.sortAscending':'browser.sortDescending'][language()];
 direction.setAttribute('aria-label',directionLabel);direction.dataset.tooltip=directionLabel;
 direction.querySelector<HTMLElement>('[data-lucide]')!.dataset.lucide=descending?'arrow-down':'arrow-up';
 const sortSummary=el('[data-person-sort-menu] summary');if(sort.value==='random')sortSummary.dataset.tooltip=t().randomHint;else delete sortSummary.dataset.tooltip;
 root.querySelectorAll<HTMLElement>('[data-person-sort]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.personSort===criterion)));
 syncUrl();
 syncPersonFilterMenus();
 window.dispatchEvent(new Event('lucide-refresh'));
}
function translate(){
 root.querySelectorAll<HTMLElement>('[data-copy]').forEach(node=>{const key=node.dataset.copy as keyof typeof copy.lv;node.textContent=t()[key];});
 root.querySelectorAll<HTMLElement>('[data-copy-aria]').forEach(node=>node.setAttribute('aria-label',t()[node.dataset.copyAria as keyof typeof copy.lv]));
 query.placeholder=t().searchPersonOrPlace+'…';document.title=`${t().title} – Teikas`;populateFilters();render();
}
function clear(){root.querySelectorAll<HTMLInputElement>('[data-person-filter-search]').forEach(input=>input.value='');query.value='';role='';theme.value='';place.value='';gender.value='';minimum.value='1';savedOnly.checked=false;focusId='';selection.clear();selectionOnly=false;page=1;expanded.clear();render();}
function changed(){page=1;render();}
query.addEventListener('input',changed);[theme,place,gender,minimum,savedOnly].forEach(input=>input.addEventListener('change',changed));
root.querySelectorAll<HTMLInputElement>('[data-person-filter-search]').forEach(input=>input.addEventListener('input',syncPersonFilterMenus));
minimum.addEventListener('input',syncMinimum);
root.addEventListener('change',event=>{
 const choice=event.target as HTMLInputElement,key=choice.dataset.personFilterChoice;
 if(!key)return;
 const select=key==='theme'?theme:key==='place'?place:gender;
 const menu=choice.closest<HTMLDetailsElement>('[data-person-filter]')!;
 select.value=choice.value;
 select.dispatchEvent(new Event('change',{bubbles:true}));
 menu.open=false;menu.querySelector('summary')!.focus();
});
root.addEventListener('change',event=>{const input=event.target as HTMLInputElement;if(input.hasAttribute('data-person-page-current')){page=Math.max(1,Math.floor(Number(input.value)||1));render();}});
root.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.target as HTMLElement).hasAttribute('data-person-page-current')){event.preventDefault();(event.target as HTMLInputElement).dispatchEvent(new Event('change',{bubbles:true}));return;}

});
let filtersCollapsed=false;
const collapseButton=el<HTMLButtonElement>('[data-person-filter-collapse]');
function syncFilterCollapse(){
 el('.people-workspace').classList.toggle('filters-collapsed',filtersCollapsed);
 collapseButton.setAttribute('aria-expanded',String(!filtersCollapsed));
 const label=ui[filtersCollapsed?'map.expandFilters':'map.collapseFilters'][language()];
 collapseButton.setAttribute('aria-label',label);collapseButton.dataset.tooltip=label;
 el('[data-filter-collapse-label]').textContent=t().filtersTitle;
}
collapseButton.addEventListener('click',()=>{filtersCollapsed=!filtersCollapsed;syncFilterCollapse();});
window.addEventListener('ui-language-change',syncFilterCollapse);syncFilterCollapse();
el<HTMLFormElement>('.people-filter-form').addEventListener('submit',event=>event.preventDefault());
root.addEventListener('toggle',event=>{const details=event.target as HTMLDetailsElement;if(!details.matches('[data-detail]'))return;const id=details.dataset.detail!,profile=peopleById.get(id)!;details.closest('.person-row')?.querySelector('[data-open-person]')?.setAttribute('aria-expanded',String(details.open));if(details.open){expanded.add(id);details.querySelector('[data-detail-content]')!.innerHTML=detailsBody(profile);void refreshExcerpts();}else expanded.delete(id);},true);
root.addEventListener('click',async event=>{
 const origin=event.target as HTMLElement;
 // Blank row space and metadata expand the preview; nested controls retain
 // their own actions, and selecting text must not unexpectedly close it.
 const row=origin.closest('.person-row');
 if(row&&!origin.closest('a,button,input,select,textarea,label,details')&&!window.getSelection()?.toString()){
  const details=row.querySelector<HTMLDetailsElement>('[data-detail]')!;details.open=!details.open;return;
 }
 const target=origin.closest<HTMLElement>('button,a');if(!target)return;
 if(target.hasAttribute('data-filter-toggle')){mobileFiltersOpen=!mobileFiltersOpen;updateFilterDrawer();}
 if(target.hasAttribute('data-person-column')){const field=target.dataset.personColumn!,asc=field==='count'?'count-asc':field,desc=field==='count'?'count':`${field}-desc`;sort.value=sort.value===asc?desc:asc;page=1;render();el<HTMLButtonElement>(`[data-person-column="${field}"]`).focus({preventScroll:true});}
 if(target.hasAttribute('data-person-sort-direction')){sort.value=sort.value==='count'?'count-asc':sort.value==='count-asc'?'count':sort.value.endsWith('-desc')?sort.value.slice(0,-5):`${sort.value}-desc`;page=1;render();}
 if(target.hasAttribute('data-person-sort')){sort.value=target.dataset.personSort!;el<HTMLDetailsElement>('[data-person-sort-menu]').open=false;page=1;render();}
 if(target.hasAttribute('data-role')){role=target.dataset.role!;changed();}
 if(target.hasAttribute('data-view')){view=target.dataset.view!;render();}
 if(target.hasAttribute('data-reset'))clear();
 if(target.hasAttribute('data-page')){page=Number(target.dataset.page);render();el('[data-result-status]').scrollIntoView({block:'start'});root.querySelector<HTMLInputElement>('[data-person-page-current]')?.focus({preventScroll:true});}
 if(target.hasAttribute('data-open-person')){event.preventDefault();const id=target.dataset.openPerson!,details=root.querySelector<HTMLDetailsElement>(`[data-detail="${id}"]`)!;details.open=!details.open;}
 if(target.hasAttribute('data-save')){const id=target.dataset.save!,previous=new Set(saved);saved.has(id)?saved.delete(id):saved.add(id);try{localStorage.setItem('teikas-person-saved',JSON.stringify([...saved]));page=1;render();root.querySelector<HTMLElement>(`[data-save="${id}"]`)?.focus({preventScroll:true});}catch{saved=previous;el('[data-feedback]').textContent=t().storageFailed;}}
 if(target.hasAttribute('data-copy-link')){try{await navigator.clipboard.writeText(savedOnly.checked?sharedPersonSelectionUrl(location.href,filtered.map(p=>p.id)):location.href);el('[data-feedback]').textContent=t().copied;}catch{el('[data-feedback]').textContent=t().copyFailed;}}
 if(target.hasAttribute('data-export')){
  el<HTMLDetailsElement>('[data-person-download]').open=false;
  const cell=(value:unknown)=>`"${String(value??'').replace(/"/g,'""')}"`,citation='Reinsone, Sanita; Kaščejeva, Simona; Spektors, Andrejs and Pakalns, Guntis (2025). Latvian Folk Legend Corpus of LPT (in Latvian). CLARIN-LV. https://hdl.handle.net/20.500.12574/147; Teikas. LU Digitālo humanitāro zinātņu centrs. https://dhc.lu.lv/teikas/';
  const rows=[['id','name','role','gender','legend_count','matching_legend_count','notes','citation'],...filtered.map(p=>[p.id,p.name,p.role,p.gender,p.ids.length,personMatch(p).records.length,p.notes,citation])];
  const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='teikas-personas.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
});
window.addEventListener('ui-language-change',translate);populateFilters();theme.value=params.get('theme')||'';place.value=params.get('place')||'';translate();if(focusId)void refreshExcerpts();
