type Anchor = {left:number;top:number;right:number;bottom:number;width:number;height:number};
let tooltip:HTMLDivElement|null=null;
let target:Element|null=null;
let installed=false;
function surface(){
 if(!tooltip){tooltip=document.createElement('div');tooltip.className='platform-tooltip';tooltip.id='platform-tooltip';tooltip.setAttribute('role','tooltip');tooltip.hidden=true;document.body.append(tooltip);}
 return tooltip;
}
export function hidePlatformTooltip(){
 if(tooltip)tooltip.hidden=true;
 if(target){const ids=(target.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!=='platform-tooltip');if(ids.length)target.setAttribute('aria-describedby',ids.join(' '));else target.removeAttribute('aria-describedby');}
 target=null;
}
export function movePlatformTooltip(anchor:Anchor){
 const tip=surface();if(tip.hidden)return;
 const box=tip.getBoundingClientRect(),gap=8;
 tip.style.left=`${Math.max(gap,Math.min(innerWidth-box.width-gap,anchor.left+anchor.width/2-box.width/2))}px`;
 tip.style.top=`${Math.max(gap,Math.min(innerHeight-box.height-gap,anchor.bottom+box.height+gap*2<innerHeight?anchor.bottom+gap:anchor.top-box.height-gap))}px`;
}
export function showPlatformTooltip(content:string|string[],anchor:Anchor,element?:Element){
 hidePlatformTooltip();const tip=surface();tip.replaceChildren();
 for(const [index,text] of (Array.isArray(content)?content:[content]).entries()){
  const line=document.createElement(Array.isArray(content)&&index===0?'strong':'span');line.textContent=text;tip.append(line);
 }
 target=element||null;
 if(target)target.setAttribute('aria-describedby',[target.getAttribute('aria-describedby'),tip.id].filter(Boolean).join(' '));
 tip.hidden=false;movePlatformTooltip(anchor);
}
export function attachPlatformTooltips(){
 if(installed)return;installed=true;surface();
 // Migrate legacy titles, including controls inserted or translated after loading.
 const normalize=(element:Element)=>{
  if(element.hasAttribute('title')){element.setAttribute('data-tooltip',element.getAttribute('title')!);element.removeAttribute('title');}
  if(element.matches('[role="button"]')){const title=element.querySelector(':scope > title');if(title){if(!element.hasAttribute('data-tooltip'))element.setAttribute('data-tooltip',title.textContent||'');title.remove();}}
 };
 const scan=(element:Element)=>{normalize(element);element.querySelectorAll('[title],[role="button"] > title').forEach(item=>normalize(item.tagName.toLowerCase()==='title'?item.parentElement!:item));};
 scan(document.body);
 new MutationObserver(records=>{
  for(const record of records){
   if(record.type==='attributes')normalize(record.target as Element);
   else record.addedNodes.forEach(node=>{if(node instanceof Element)scan(node);});
  }
  if(target&&!target.isConnected)hidePlatformTooltip();
 }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['title']});
 const selector='[data-tooltip],[title],button[aria-label]';
 const show=(element:Element)=>{
  normalize(element);
  const iconOnly=element.matches('button[aria-label]')&&(!element.textContent?.trim()||!!element.querySelector('.sr-only')||!!element.closest('.header-tools'));
  const text=element.getAttribute('data-tooltip')||(iconOnly?element.getAttribute('aria-label'):null);
  if(!text||element.matches(':disabled,[aria-disabled="true"]'))return;
  const anchor=element.closest('.ml-volume-pie')||element;
  showPlatformTooltip(text,anchor.getBoundingClientRect(),element);
 };
 document.addEventListener('pointerover',event=>{if((event as PointerEvent).pointerType==='touch')return;const element=(event.target as Element).closest(selector);if(element&&element!==target)show(element);});
 document.addEventListener('pointerout',event=>{if(target&&!target.contains((event as PointerEvent).relatedTarget as Node|null))hidePlatformTooltip();});
 document.addEventListener('focusin',event=>{const element=(event.target as Element).closest(selector);if(element)show(element);});
 document.addEventListener('focusout',hidePlatformTooltip);
 document.addEventListener('click',hidePlatformTooltip,true);
 document.addEventListener('keydown',event=>{if(event.key==='Escape')hidePlatformTooltip();});
 const reposition=()=>{if(target===document.activeElement&&target){const rect=target.getBoundingClientRect();if(rect.bottom>0&&rect.top<innerHeight)movePlatformTooltip((target.closest('.ml-volume-pie')||target).getBoundingClientRect());else hidePlatformTooltip();}else hidePlatformTooltip();};
 window.addEventListener('scroll',reposition,true);window.addEventListener('resize',reposition);window.addEventListener('ui-language-change',hidePlatformTooltip);
}
