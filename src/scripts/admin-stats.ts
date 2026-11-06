export {};
type VisitPage={path:string;title:string;count:number};
type Visits={sections:{key:string;count:number}[];asOf:string;total:number;pageCount:number;daily:{day:string;count:number}[];pages:VisitPage[]};
type Report={date:string;kind:string;description:string;page:string;status:string};
type Response={ok:boolean;asOf?:string;code?:string;token?:string;visits?:Visits|null;visitsError?:string;reports?:{total:number;truncated:boolean;items:Report[]}};
const root=document.querySelector<HTMLElement>('[data-admin-stats]')!;
const el=<T extends HTMLElement=HTMLElement>(selector:string)=>root.querySelector<T>(selector)!;
const ui=JSON.parse(document.querySelector('#ui-translations')!.textContent||'{}') as Record<string,Record<string,string>>;
const lang=()=>document.documentElement.dataset.uiLang||'lv';
const tr=(key:string)=>ui[`adminStats.${key}`]?.[lang()]||ui[`adminStats.${key}`]?.lv||key;
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const format=(n:number)=>n.toLocaleString(lang());
let token='',days=7,activeTab='visits',state:Response|null=null,generation=0,busy=false;
const pending=new Map<string,{resolve:(data:Response)=>void;reject:(error:Error)=>void;cleanup:()=>void}>();

function send(action:string,values:Record<string,string>={}):Promise<Response>{
 return new Promise((resolve,reject)=>{
  const id=crypto.randomUUID(),frame=document.createElement('iframe'),form=document.createElement('form');
  frame.name='stats-'+id;frame.hidden=true;frame.title='Statistics response';document.body.append(frame);
  form.method='post';form.target=frame.name;form.action=root.dataset.endpoint!;form.hidden=true;
  for(const [name,value] of Object.entries({action,requestId:id,clientUrl:location.href,...values})){const input=document.createElement('input');input.type='hidden';input.name=name;input.value=value;form.append(input);}
  document.body.append(form);
  const timer=window.setTimeout(()=>{cleanup();reject(new Error('unavailable'));},90000);
  const cleanup=()=>{window.clearTimeout(timer);pending.delete(id);frame.remove();form.remove();};
  pending.set(id,{resolve,reject,cleanup});form.submit();form.remove();
 });
}
window.addEventListener('message',event=>{
 if(event.data?.type!=='teikas-stats')return;
 let origin:URL;try{origin=new URL(event.origin);}catch{return;}
 if(origin.protocol!=='https:'||!(origin.hostname==='script.google.com'||origin.hostname==='script.googleusercontent.com'||origin.hostname.endsWith('.googleusercontent.com')))return;
 const request=pending.get(event.data.requestId);if(!request)return;
 request.cleanup();event.data.ok?request.resolve(event.data):request.reject(new Error(event.data.code||'unavailable'));
});

function message(key:string){el('[data-stats-status]').textContent=key?tr(key):'';}
function translate(){root.querySelectorAll<HTMLElement>('[data-stat-copy]').forEach(node=>node.textContent=tr(node.dataset.statCopy!));document.title=tr('title')+' – Teikas';el('[data-stats-period-label]').textContent=tr('days'+days);el('[data-stats-tabs]').setAttribute('aria-label',tr('title'));el('[data-stats-day]').setAttribute('aria-label',tr('day'));if(state)render();}
function setBusy(value:boolean){busy=value;el('[data-stats-workspace]').setAttribute('aria-busy',String(value));el<HTMLButtonElement>('[data-stats-refresh]').disabled=value;el<HTMLButtonElement>('[data-stats-login] button').disabled=value;root.querySelectorAll<HTMLButtonElement>('[data-stats-days]').forEach(button=>button.disabled=value);}
function clearPrivate(){generation++;token='';state=null;el('[data-stats-workspace]').hidden=true;el('[data-stats-login]').hidden=false;['chart','sections','popular','reports'].forEach(key=>el(`[data-stats-${key}]`).replaceChildren());['total','pages','report-count'].forEach(key=>el(`[data-stats-${key}]`).textContent='—');el('[data-stats-day-label]').textContent='';el('[data-stats-freshness]').textContent='';el('[data-stats-visits-status]').textContent='';el('[data-stats-report-note]').textContent='';el<HTMLInputElement>('[data-stats-report-search]').value='';}
async function load(){
 if(!token||busy)return;
 const current=token,version=generation;setBusy(true);message('loading');
 try{const data=await send('stats-read',{token:current,days:String(days)});if(version!==generation||token!==current)return;state=data;message('');render();}
 catch(error){if(version!==generation)return;const code=(error as Error).message;if(code==='unauthorized'){clearPrivate();message('expired');}else message('unavailable');}
 finally{setBusy(false);}
}
el<HTMLFormElement>('[data-stats-login]').addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;
 const input=el<HTMLInputElement>('[name=password]'),password=input.value;setBusy(true);message('signingIn');
 try{const data=await send('stats-login',{password});input.value='';token=data.token||'';generation++;el('[data-stats-login]').hidden=true;el('[data-stats-workspace]').hidden=false;setBusy(false);await load();}
 catch(error){const code=(error as Error).message;message(code==='unauthorized'?'wrongPassword':code==='setup'?'setup':code==='busy'?'tooMany':'unavailable');input.focus();}
 finally{setBusy(false);}
});
el('[data-stats-logout]').addEventListener('click',()=>{const previous=token;clearPrivate();setBusy(false);message('');void send('stats-logout',{token:previous}).catch(()=>{});el<HTMLInputElement>('[name=password]').focus();});
el('[data-stats-refresh]').addEventListener('click',()=>void load());
root.querySelectorAll<HTMLButtonElement>('[data-stats-days]').forEach(button=>button.addEventListener('click',()=>{days=Number(button.dataset.statsDays);el<HTMLDetailsElement>('[data-stats-period-menu]').open=false;el('[data-stats-period-label]').textContent=tr('days'+days);root.querySelectorAll('[data-stats-days]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));void load();}));
function tab(name:string){activeTab=name;root.querySelectorAll<HTMLButtonElement>('[data-stats-tab]').forEach(button=>{const selected=button.dataset.statsTab===name;button.setAttribute('aria-selected',String(selected));button.setAttribute('aria-pressed',String(selected));button.tabIndex=selected?0:-1;});el('#visits-panel').hidden=name!=='visits';el('#reports-panel').hidden=name!=='reports';el('[data-stats-period-menu]').hidden=name!=='visits';}
root.querySelectorAll<HTMLButtonElement>('[data-stats-tab]').forEach(button=>button.addEventListener('click',()=>tab(button.dataset.statsTab!)));
el('[data-stats-tabs]').addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();tab(event.key==='Home'?'visits':event.key==='End'?'reports':activeTab==='visits'?'reports':'visits');el<HTMLButtonElement>(`[data-stats-tab="${activeTab}"]`).focus();}});

function rows(items:{label:string;count:number;path?:string}[]){return items.length?`<table><thead><tr><th scope="col">${tr('page')}</th><th scope="col">${tr('visits')}</th></tr></thead><tbody>${items.map(item=>`<tr><td>${item.path?`<a href="https://dhc.lu.lv${esc(item.path)}" target="_blank" rel="noopener noreferrer">${esc(item.label)}</a>`:esc(item.label)}</td><td>${format(item.count)}</td></tr>`).join('')}</tbody></table>`:`<p class="search-help">${tr('noVisits')}</p>`;}
function render(){
 if(!state)return;
 const visits=state.visits;
 el('[data-stats-total]').textContent=visits?format(visits.total):'—';el('[data-stats-pages]').textContent=visits?format(visits.pageCount):'—';el('[data-stats-report-count]').textContent=format(state.reports?.total||0);
 el('[data-stats-visits-status]').textContent=visits?'':tr('visitsUnavailable');
 const updatedAt=visits?.asOf||state.asOf;el('[data-stats-freshness]').textContent=updatedAt?tr('updated')+' '+new Date(updatedAt).toLocaleString(lang(),{timeZone:'Europe/Riga',dateStyle:'medium',timeStyle:'medium'})+' (Rīga)':'';
 if(visits){
  const points=visits.daily,max=Math.max(1,...points.map(day=>day.count));
  const line=points.map((day,index)=>`${35+index/Math.max(1,points.length-1)*830},${190-day.count/max*160}`).join(' ');
  el('[data-stats-chart]').innerHTML=`<svg viewBox="0 0 900 225" role="img" aria-label="${esc(tr('daily'))}"><line x1="35" y1="190" x2="865" y2="190" stroke="var(--line)"/><text x="25" y="195" text-anchor="end" fill="var(--muted)" font-size="12">0</text><text x="25" y="30" text-anchor="end" fill="var(--muted)" font-size="12">${max}</text><polyline points="${line}" fill="none" stroke="var(--blue)" stroke-width="2.5"/><circle data-day-point r="5" fill="var(--blue)"/></svg>`;
  const slider=el<HTMLInputElement>('[data-stats-day]');slider.max=String(Math.max(0,points.length-1));slider.value=slider.max;slider.disabled=!points.length;selectedDay();
  el('[data-stats-sections]').innerHTML=rows(visits.sections.map(item=>({label:tr(item.key),count:item.count})).sort((a,b)=>b.count-a.count));
  el('[data-stats-popular]').innerHTML=rows(visits.pages.map(page=>({label:page.title,path:page.path,count:page.count})));
 }else{['chart','sections','popular'].forEach(key=>el(`[data-stats-${key}]`).replaceChildren());el('[data-stats-day-label]').textContent='';}
 renderReports();window.dispatchEvent(new Event('lucide-refresh'));
}
function selectedDay(){const day=state?.visits?.daily[Number(el<HTMLInputElement>('[data-stats-day]').value)];if(!day)return;el('[data-stats-day-label]').textContent=new Date(day.day+'T12:00:00Z').toLocaleDateString(lang(),{timeZone:'Europe/Riga'})+' · '+format(day.count)+' '+tr('visits').toLocaleLowerCase();const all=state!.visits!.daily,index=Number(el<HTMLInputElement>('[data-stats-day]').value),max=Math.max(1,...all.map(item=>item.count)),point=el('[data-day-point]');point.setAttribute('cx',String(35+index/Math.max(1,all.length-1)*830));point.setAttribute('cy',String(190-day.count/max*160));}
el('[data-stats-day]').addEventListener('input',selectedDay);
function renderReports(){
 const data=state?.reports;if(!data)return;
 const term=el<HTMLInputElement>('[data-stats-report-search]').value.trim().toLocaleLowerCase(lang());
 const items=data.items.filter(item=>[item.description,item.kind,item.status,item.page].join(' ').toLocaleLowerCase(lang()).includes(term));
 el('[data-stats-report-note]').textContent=data.truncated?tr('recentReports').replace('{count}',format(data.items.length)).replace('{total}',format(data.total)):'';
 el('[data-stats-reports]').innerHTML=items.length?items.map(item=>{
  let href='';try{const url=new URL(item.page);if(url.protocol==='https:'&&['dhc.lu.lv','ul-dhc.github.io'].includes(url.hostname)&&url.pathname.startsWith('/teikas/'))href=url.href;}catch{}
  return `<article><div class="stats-report-meta"><time>${esc(new Date(item.date).toLocaleString(lang(),{timeZone:'Europe/Riga'}))}</time><span>${esc(item.kind)}</span><span>${esc(item.status)}</span></div><p class="stats-report-text">${esc(item.description)}</p><p class="stats-report-link">${href?`<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(item.page)}</a>`:esc(item.page)}</p></article>`;
 }).join(''):`<p class="search-help">${tr('noReports')}</p>`;
}
el('[data-stats-report-search]').addEventListener('input',renderReports);
window.addEventListener('ui-language-change',translate);translate();
