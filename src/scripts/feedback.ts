export {};
const dialog=document.querySelector<HTMLDialogElement>('#feedback-dialog')!;
const form=dialog.querySelector<HTMLFormElement>('form')!;
const trigger=document.querySelector<HTMLButtonElement>('[data-feedback-open]')!;
const status=dialog.querySelector<HTMLElement>('[data-feedback-status]')!;
const submit=dialog.querySelector<HTMLButtonElement>('[data-feedback-submit]')!;
const page=form.elements.namedItem('pageUrl') as HTMLInputElement;
const kind=form.elements.namedItem('kind') as HTMLSelectElement;
const kindMenu=dialog.querySelector<HTMLDetailsElement>('[data-feedback-kind-menu]')!;
const request=form.elements.namedItem('requestId') as HTMLInputElement;
const description=form.elements.namedItem('description') as HTMLTextAreaElement;
const endpoint=dialog.dataset.endpoint||'';
const ui=JSON.parse(document.querySelector('#ui-translations')!.textContent||'{}') as Record<string,Record<string,string>>;
const tr=(key:string)=>ui[`feedback.${key}`]?.[document.documentElement.dataset.uiLang||'lv']||ui[`feedback.${key}`]?.lv||key;
let pending=false,timer=0,message='',signature='';
let openedFrom=trigger;
function translate(){
 trigger.setAttribute('aria-label',tr('open'));trigger.dataset.tooltip=tr('open');
 dialog.querySelectorAll<HTMLElement>('[data-feedback-copy]').forEach(node=>node.textContent=tr(node.dataset.feedbackCopy!));
 dialog.querySelectorAll('[data-feedback-close]').forEach(node=>node.setAttribute('aria-label',tr('cancel')));
 dialog.querySelector('#feedback-kind-value')!.textContent=tr(kind.value);
 dialog.querySelectorAll<HTMLElement>('[data-feedback-kind]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.feedbackKind===kind.value)));
 submit.textContent=tr(pending?'sending':'send');status.textContent=message?tr(message):'';
}
document.querySelectorAll<HTMLButtonElement>('[data-feedback-open],[data-feedback-launch]').forEach(button=>button.addEventListener('click',()=>{
 openedFrom=button;
 if(!pending){page.value=location.href;message='';}
 translate();dialog.showModal();
}));
dialog.querySelectorAll('[data-feedback-close]').forEach(button=>button.addEventListener('click',()=>dialog.close()));
dialog.addEventListener('close',()=>{kindMenu.open=false;openedFrom.focus({preventScroll:true});});
dialog.querySelectorAll<HTMLButtonElement>('[data-feedback-kind]').forEach(button=>button.addEventListener('click',()=>{
 kind.value=button.dataset.feedbackKind!;kindMenu.open=false;translate();kindMenu.querySelector('summary')!.focus({preventScroll:true});
}));
kindMenu.addEventListener('keydown',event=>{if(event.key==='Escape'&&kindMenu.open){event.preventDefault();event.stopPropagation();kindMenu.open=false;kindMenu.querySelector('summary')!.focus();}});
dialog.addEventListener('click',event=>{if(!kindMenu.contains(event.target as Node))kindMenu.open=false;});
form.addEventListener('submit',event=>{
 if(pending){event.preventDefault();return;}
 if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint)){
  event.preventDefault();message='unavailable';translate();return;
 }
 description.value=description.value.trim();
 if(description.value.length<5){event.preventDefault();description.focus();return;}
 const nextSignature=JSON.stringify([new FormData(form).get('kind'),description.value,page.value]);
 if(!request.value||signature!==nextSignature){request.value=crypto.randomUUID();signature=nextSignature;}
 form.action=endpoint;pending=true;submit.disabled=true;message='';translate();
 timer=window.setTimeout(()=>{pending=false;submit.disabled=false;message='failed';translate();},25000);
});
window.addEventListener('message',event=>{
 if(!pending||event.data?.type!=='teikas-feedback'||event.data?.requestId!==request.value)return;
 let origin:URL;try{origin=new URL(event.origin);}catch{return;}
 if(origin.protocol!=='https:'||!(origin.hostname==='script.google.com'||origin.hostname==='script.googleusercontent.com'||origin.hostname.endsWith('.googleusercontent.com')))return;
 window.clearTimeout(timer);pending=false;submit.disabled=false;
 message=event.data.ok===true?'success':'failed';
 if(event.data.ok===true){description.value='';request.value='';signature='';}
 translate();
});
window.addEventListener('ui-language-change',translate);translate();
