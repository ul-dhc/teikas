// Ported from NSRD app/explorer-client.tsx positionedNodes.
// Keep the original speed, perspective and depth equations.
export const motionHash = value => Array.from(value).reduce((result,char)=>((result<<5)-result+char.charCodeAt(0))|0,0);
const motionSeeds = new Map();
function seedsFor(id) {
 if(!motionSeeds.has(id))motionSeeds.set(id,{seed:Math.abs(motionHash(id)),driftSeed:Math.abs(motionHash(`${id}:drift`))});
 return motionSeeds.get(id);
}
// Compensate for a shrunken view without magnifying movement when zoomed in.
export function motionAmplitudeScale(screenScale) {
 return Number.isFinite(screenScale)&&screenScale>0?Math.min(2.5,Math.max(1,1/screenScale)):1;
}
export function positionWithMotion(id,base,clock,style='drift',intensity=1,centre={x:450,y:285},amplitudeScale=1) {
 if(intensity===0)return {...base,scale:1,opacity:1};
 const {seed,driftSeed}=seedsFor(id),phase=seed%628/100;
 let x=base.x,y=base.y,scale=1,opacity=1;
 if(style==='orbit'){
  const angle=clock*.000018*intensity,dx=base.x-centre.x,dy=base.y-centre.y;
  const sharedX=centre.x+dx*Math.cos(angle)-dy*Math.sin(angle),sharedY=centre.y+(dx*Math.sin(angle)+dy*Math.cos(angle))*.92;
  const direction=seed%2===0?1:-1,localSpeed=(.00016+(seed%13)*.000009)*intensity*direction;
  const localAngle=phase+clock*localSpeed,localRadius=(6+seed%13)*Math.min(1.6,intensity)*amplitudeScale;
  const orbitX=sharedX+(Math.cos(localAngle)-Math.cos(phase))*localRadius,orbitY=sharedY+(Math.sin(localAngle)-Math.sin(phase))*localRadius*.62;
  const depth=Math.sin(localAngle+phase*.37),perspective=1+depth*.3*Math.min(1.4,Math.min(1.65,intensity));
  x=centre.x+(orbitX-centre.x)*perspective;y=centre.y+(orbitY-centre.y)*perspective;
  scale=Math.max(.18,Math.min(2.25,1+depth*.82*Math.min(1.5,intensity)));
  const farOpacity=.26+((depth+1)/2)*.74;opacity=1-(1-farOpacity)*Math.min(1,intensity);
 }else if(style==='chaos'){
  const amplitude=(15+seed%16)*intensity*amplitudeScale,speed=.00045+(seed%11)*.000018;
  x+=Math.sin(clock*speed+phase)*amplitude+Math.sin(clock*speed*2.17+phase*.43)*amplitude*.28;
  y+=Math.cos(clock*speed*1.31+phase*1.27)*amplitude*.78+Math.sin(clock*speed*1.83+phase)*amplitude*.24;
 }else{
  const amplitude=(8+driftSeed%45/10)*intensity*amplitudeScale;
  const angle=clock*.00022*Math.max(.25,intensity)+phase;
  x+=Math.sin(clock*.00011*Math.max(.25,intensity))*5.5*intensity*amplitudeScale+Math.sin(angle)*amplitude;
  y+=Math.cos(clock*.00009*Math.max(.25,intensity))*4*intensity*amplitudeScale+Math.cos(angle)*amplitude*.76;
 }
 return {x:Math.round(x*1000)/1000,y:Math.round(y*1000)/1000,scale,opacity};
}
