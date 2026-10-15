import {sectionScope} from '../lib/section-scope';
import {createDashboard} from './dashboard';
import type {types as collection, topics as topicData} from './data';
type Type=typeof collection[number];
type Topic=typeof topicData[number];
const payload=JSON.parse((document.getElementById('overview-data') || document.getElementById('ml-data'))!.textContent!) as {types:Type[];topics:Topic[];base:string};
const subsection = sectionScope(new URLSearchParams(location.search).get('section'));
const {topics,base} = payload;
const types = payload.types;
const lang=()=> (document.documentElement.dataset.uiLang||'lv') as 'lv'|'de'|'en';
let selectedTopic:Topic|undefined;
let selectedType:Type|undefined;
const codeKey=(type:Type)=>type.id;
const dashboard=createDashboard({section:subsection,types,topics,base,lang,scopeChange:(topic,type)=>{selectedTopic=topic;selectedType=type;sync(true);render();},stateChange:()=>sync(true)});
function read(){
 const params=new URLSearchParams(location.search);
 selectedType=types.find(type=>codeKey(type)===(params.get('type')||''));
 selectedTopic=topics.find(topic=>topic.id===(selectedType?.topic||params.get('topic')));
 dashboard.read(params);
}
function sync(push=false){
 const params=new URLSearchParams();
 if(subsection)params.set('section',subsection);
 dashboard.write(params);
 if(selectedTopic)params.set('topic',selectedTopic.id);
 if(selectedType)params.set('type',codeKey(selectedType));
 history[push?'pushState':'replaceState']({},'',location.pathname+(params.size?'?'+params:'')+'#overview');
}
function render(){dashboard.render({topic:selectedTopic,type:selectedType});}
window.addEventListener('ui-language-change',render);
window.addEventListener('popstate',()=>{read();render();});
read();render();
