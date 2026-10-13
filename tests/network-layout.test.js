import {test} from 'node:test';
import assert from 'node:assert/strict';
import {layoutNetwork,nodeRadius,cameraPoint,pinchCamera,echoDistances,scatterNetwork} from '../src/network/network-layout.js';
import {relationshipSelection} from '../src/network/network-data.js';
const graph={nodes:[{id:'a',field:'county',value:'A',count:2},{id:'b',field:'typeId',value:'B',count:2},{id:'c',field:'topic',value:'C',count:2}],edges:[{source:'a',target:'b',recordIds:['1','2']},{source:'b',target:'c',recordIds:['1','2']}]};
test('NSRD hierarchical rows preserve every selected category and weighted degree',()=>{
 const nodes=layoutNetwork(graph,'hierarchical',['county','typeId','topic']);
 assert.deepEqual(nodes.map(n=>[n.x,n.y,n.degree]),[[450,110,2],[450,310,4],[450,510,2]]);
 assert.equal(graph.nodes[0].x,undefined);
});
test('NSRD bipartite camera fits fixed columns into the same viewport',()=>{
 const nodes=layoutNetwork({...graph,nodes:graph.nodes.slice(0,2),edges:graph.edges.slice(0,1)},'bipartite',['county','typeId']);
 assert.deepEqual(nodes.map(n=>[n.x,n.y]),[[230,285],[670,285]]);
 assert.deepEqual(cameraPoint({x:450,y:285},2,{x:0,y:0}),{x:450,y:285});
});
test('two-finger zoom preserves the point under the gesture and supports simultaneous pan',()=>{
 const start={zoom:1,pan:{x:20,y:10},midpoint:{x:600,y:350},distance:100};
 const point={x:580,y:340},next=pinchCamera(start,{x:620,y:360},200);
 assert.deepEqual(cameraPoint(point,next.zoom,next.pan),{x:620,y:360});
 assert.equal(pinchCamera(start,{x:600,y:350},10000).zoom,8);
 assert.equal(pinchCamera(start,{x:600,y:350},1).zoom,.35);
});
test('echo propagates through connections rather than category membership',()=>{
 assert.deepEqual([...echoDistances(graph,['a'])],[['a',0],['b',1],['c',2]]);
});
test('multiple metadata selection distinguishes union, intersection and a valid empty intersection',()=>{
 const rows=[{id:'1',county:'A',typeId:'X'},{id:'2',county:'A',typeId:'Y'},{id:'3',county:'B',typeId:'X'}];
 const selection={kind:'nodes',nodes:[{field:'county',value:'A'},{field:'typeId',value:'X'}],logic:'any'};
 assert.deepEqual(relationshipSelection(rows,selection).map(r=>r.id),['1','2','3']);
 selection.logic='all';assert.deepEqual(relationshipSelection(rows,selection).map(r=>r.id),['1']);
 selection.nodes=[{field:'county',value:'A'},{field:'county',value:'B'}];assert.deepEqual(relationshipSelection(rows,selection),[]);
});

test('spreading structured layouts keeps category rows and columns intact',()=>{
 for(const layout of ['bipartite','hierarchical']){
  const nodes=[{id:'a',field:'county',x:230,y:100,degree:4},{id:'b',field:'county',x:230,y:110,degree:4},{id:'c',field:'topic',x:670,y:100,degree:4}];
  const current=new Map(nodes.map(n=>[n.id,{x:n.x,y:n.y}]));
  const spread=scatterNetwork({nodes,edges:[{source:'a',target:'c'}]},current,layout,1);
  for(const node of nodes)assert.equal(spread.get(node.id)[layout==='bipartite'?'x':'y'],node[layout==='bipartite'?'x':'y']);
  assert.ok(nodes.some(n=>spread.get(n.id).x!==n.x||spread.get(n.id).y!==n.y));
 }
});

test('uniform radii are equal while connection sizes preserve differences in an isolated category',()=>{
 const small={degree:0,connectionShare:.01},large={degree:0,connectionShare:1};
 for(const layout of ['free','hierarchical','bipartite']){
  assert.equal(nodeRadius(small,layout,'uniform'),nodeRadius(large,layout,'uniform'));
  assert.ok(nodeRadius(small,layout,'connections')<nodeRadius(large,layout,'connections'));
 }
});
