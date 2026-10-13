// Port of NSRD layoutNodes, layoutHierarchically, positionColumn and nodeRadius.
// Metadata adaptation: field replaces type; recordIds supplies weighted degree.
import {motionHash} from './network-motion.js';
export const viewport={width:900,height:570,x:450,y:285};
export const nodeRadius=(node,layout)=>layout==='free'?Math.min(27,6+Math.sqrt(node.degree)*2.2):Math.min(15,3.5+Math.sqrt(node.degree)*1.45);
export function layoutNetwork(graph,layout,fields){
 const degrees=new Map();
 for(const edge of graph.edges)for(const id of [edge.source,edge.target])degrees.set(id,(degrees.get(id)||0)+edge.recordIds.length);
 const nodes=graph.nodes.map(node=>({...node,degree:degrees.get(node.id)||0}));
 const types=fields.filter(field=>nodes.some(node=>node.field===field));
 const columns=new Map(types.map(field=>[field,nodes.filter(node=>node.field===field)]));
 if(layout!=='free'){
  types.forEach((field,typeIndex)=>{
   const column=columns.get(field).sort((a,b)=>b.degree-a.degree||a.value.localeCompare(b.value,'no',{numeric:true}));
   column.forEach((node,index)=>{
    if(layout==='bipartite'){node.x=typeIndex===0?230:670;node.y=column.length===1?285:35+index*500/(column.length-1);}
    else {node.x=column.length===1?450:58+index*784/(column.length-1);node.y=types.length===1?285:110+typeIndex*400/(types.length-1);}
   });
  });
  return nodes;
 }
 const anchorFor=field=>{const angle=-Math.PI/2+types.indexOf(field)*Math.PI*2/Math.max(1,types.length);return types.length===1?{x:450,y:285}:{x:450+Math.cos(angle)*335,y:285+Math.sin(angle)*225};};
 nodes.forEach((node,index)=>{const itemIndex=columns.get(node.field).indexOf(node),anchor=anchorFor(node.field),seed=Math.abs(motionHash(node.id)),angle=itemIndex*2.39996+(seed%29)/29,radius=24+Math.sqrt(itemIndex)*24;node.x=anchor.x+Math.cos(angle)*radius;node.y=anchor.y+Math.sin(angle)*radius+(index%3)*2;});
 const indexById=new Map(nodes.map((node,index)=>[node.id,index])),vx=new Array(nodes.length).fill(0),vy=new Array(nodes.length).fill(0);
 for(let iteration=0;iteration<95;iteration++){
  // Same NSRD repulsion, with a spatial index for the larger legend metadata set.
  const cells=new Map();
  nodes.forEach((node,i)=>{
   const cx=Math.floor(node.x/51),cy=Math.floor(node.y/51);
   for(let x=cx-1;x<=cx+1;x++)for(let y=cy-1;y<=cy+1;y++)for(const j of cells.get(`${x},${y}`)||[]){
    const other=nodes[j],dx=node.x-other.x,dy=node.y-other.y,distance=Math.max(1,Math.hypot(dx,dy)),minimum=36+Math.min(15,Math.sqrt(node.degree+other.degree));
    if(distance<minimum){const force=(minimum-distance)*.035;vx[j]-=dx/distance*force;vy[j]-=dy/distance*force;vx[i]+=dx/distance*force;vy[i]+=dy/distance*force;}
   }
   const key=`${cx},${cy}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);
  });
  for(const edge of graph.edges){const i=indexById.get(edge.source),j=indexById.get(edge.target),dx=nodes[j].x-nodes[i].x,dy=nodes[j].y-nodes[i].y,distance=Math.max(1,Math.hypot(dx,dy)),force=(distance-148)*.00165;vx[i]+=dx/distance*force;vy[i]+=dy/distance*force;vx[j]-=dx/distance*force;vy[j]-=dy/distance*force;}
  nodes.forEach((node,index)=>{const anchor=anchorFor(node.field);vx[index]+=(anchor.x-node.x)*.0025;vy[index]+=(anchor.y-node.y)*.0025;node.x=Math.max(34,Math.min(866,node.x+vx[index]));node.y=Math.max(32,Math.min(538,node.y+vy[index]));vx[index]*=.72;vy[index]*=.72;});
 }
 return nodes;
}
// NSRD camera: zoom around the centre rather than the top-left corner.
export const cameraTransform=(zoom,pan)=>`translate(${450+pan.x} ${285+pan.y}) scale(${zoom}) translate(-450 -285)`;
export const cameraPoint=(point,zoom,pan)=>({x:450+(point.x-450)*zoom+pan.x,y:285+(point.y-285)*zoom+pan.y});
export function echoDistances(graph,selected){
 const neighbours=new Map(graph.nodes.map(node=>[node.id,[]]));
 for(const edge of graph.edges){neighbours.get(edge.source).push(edge.target);neighbours.get(edge.target).push(edge.source);}
 const distances=new Map(selected.map(id=>[id,0])),queue=[...selected];
 for(let i=0;i<queue.length;i++)for(const id of neighbours.get(queue[i])||[])if(!distances.has(id)){distances.set(id,distances.get(queue[i])+1);queue.push(id);}
 return distances;
}
// NSRD's scatterNodes: expand, then separate nearby nodes while keeping links.
export function scatterNetwork(graph,current,layout,scale){
 const positions=graph.nodes.map(node=>({...current.get(node.id)}));
 if(!positions.length)return new Map();
 const center={x:positions.reduce((sum,p)=>sum+p.x,0)/positions.length,y:positions.reduce((sum,p)=>sum+p.y,0)/positions.length};
 const indices=new Map(graph.nodes.map((node,index)=>[node.id,index]));
 positions.forEach((p,i)=>{p.x=layout==='bipartite'?current.get(graph.nodes[i].id).x:450+(p.x-center.x)*1.28;p.y=layout==='hierarchical'?current.get(graph.nodes[i].id).y:285+(p.y-center.y)*1.24;});
 for(let iteration=0;iteration<64;iteration++){
  const shifts=positions.map(()=>({x:0,y:0}));
  for(let i=0;i<positions.length;i++)for(let j=i+1;j<positions.length;j++){
   let dx=positions[j].x-positions[i].x,dy=positions[j].y-positions[i].y,distance=Math.hypot(dx,dy);
   const minimum=(nodeRadius(graph.nodes[i],layout)+nodeRadius(graph.nodes[j],layout))*scale+(layout==='free'?9:5),influence=minimum+(layout==='free'?34:14);
   if(distance>=influence)continue;
   if(distance<.01){const angle=Math.abs(motionHash(`${graph.nodes[i].id}:${graph.nodes[j].id}`))%628/100;dx=Math.cos(angle);dy=Math.sin(angle);distance=1;}
   const overlap=Math.max(0,minimum-distance),proximity=Math.max(0,(influence-distance)/influence),push=Math.min(9,overlap*.38+proximity*proximity*2.4);
   shifts[i].x-=dx/distance*push;shifts[i].y-=dy/distance*push;shifts[j].x+=dx/distance*push;shifts[j].y+=dy/distance*push;
  }
  for(const edge of layout==='free'?graph.edges:[]){const i=indices.get(edge.source),j=indices.get(edge.target),dx=positions[j].x-positions[i].x,dy=positions[j].y-positions[i].y,distance=Math.max(1,Math.hypot(dx,dy));if(distance<=230)continue;const pull=Math.min(1.1,(distance-230)*.0035);shifts[i].x+=dx/distance*pull;shifts[i].y+=dy/distance*pull;shifts[j].x-=dx/distance*pull;shifts[j].y-=dy/distance*pull;}
  positions.forEach((p,i)=>{if(p.x<28)shifts[i].x+=(28-p.x)*.18;if(p.x>872)shifts[i].x-=(p.x-872)*.18;if(p.y<28)shifts[i].y+=(28-p.y)*.18;if(p.y>542)shifts[i].y-=(p.y-542)*.18;p.x=Math.max(28,Math.min(872,p.x+Math.max(-10,Math.min(10,shifts[i].x))));p.y=Math.max(28,Math.min(542,p.y+Math.max(-10,Math.min(10,shifts[i].y))));if(layout==='bipartite')p.x=current.get(graph.nodes[i].id).x;if(layout==='hierarchical')p.y=current.get(graph.nodes[i].id).y;});
 }
 return new Map(graph.nodes.map((node,i)=>[node.id,positions[i]]));
}
export function pinchCamera(start,midpoint,distance){
 const zoom=Math.max(.35,Math.min(8,start.zoom*distance/Math.max(1,start.distance))),ratio=zoom/start.zoom;
 return {zoom,pan:{x:midpoint.x-450-(start.midpoint.x-450-start.pan.x)*ratio,y:midpoint.y-285-(start.midpoint.y-285-start.pan.y)*ratio}};
}
