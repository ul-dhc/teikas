import {sectionScope} from '../lib/section-scope';
import {createDashboard} from './dashboard';
import type {types as collection, topics as topicData} from './data';
type Type=typeof collection[number];type Topic=typeof topicData[number];
const payload=JSON.parse(document.getElementById('ml-data')!.textContent!) as {types:Type[];topics:Topic[];base:string;metadataLabels:Record<string,Record<string,string>>};
const subsection = sectionScope(new URLSearchParams(location.search).get('section'));
const {topics,base,metadataLabels} = payload;
const types = payload.types;
const lang=()=>{const value=document.documentElement.dataset.uiLang;return value==='de'?'de':value==='en'?'en':'lv'};
let selectedTopic:Topic|undefined,selectedType:Type|undefined,currentRoute=location.href;
const key=(type:Type)=>type.code.replace(/\s/g,'');
const dashboard=createDashboard({section:subsection,types,topics,base,metadataLabels,lang,scopeChange:(topic,type)=>{selectedTopic=topic;selectedType=type;sync(true);render();},stateChange:()=>sync(true)});
function read(){const params=new URLSearchParams(location.search);params.set('view',location.hash==='#overview'?'overview':'network');selectedType=types.find(type=>key(type).toLowerCase()===(params.get('type')||'').replace(/\s/g,'').toLowerCase());selectedTopic=topics.find(topic=>topic.id===(selectedType?.topic||params.get('topic')));dashboard.read(params);}
function sync(push=false){const params=new URLSearchParams();if(subsection)params.set('section',subsection);dashboard.write(params);if(selectedTopic)params.set('topic',selectedTopic.id);if(selectedType)params.set('type',key(selectedType));const view=params.get('view')==='network'?'network':'overview';params.delete('view');history[push?'pushState':'replaceState']({},'',location.pathname+(params.size?'?'+params:'')+'#'+view);currentRoute=location.href;}
function render(){dashboard.render({topic:selectedTopic,type:selectedType});}
function routeChanged(){if(location.href===currentRoute)return;currentRoute=location.href;read();render();}
window.addEventListener('ui-language-change',render);window.addEventListener('popstate',routeChanged);window.addEventListener('hashchange',routeChanged);
read();render();if(!location.hash){history.replaceState({},'',location.pathname+location.search+'#network');currentRoute=location.href;}
