import test from 'node:test';
import assert from 'node:assert/strict';
import {legendFocusOpacity} from '../src/map/legend-focus.js';
function value(expression,properties={},state={}){
 if(!Array.isArray(expression))return expression;
 const [op,...args]=expression;
 if(op==='get')return properties[args[0]];
 if(op==='feature-state')return state[args[0]];
 if(op==='boolean'){const result=value(args[0],properties,state);return typeof result==='boolean'?result:args[1];}
 if(op==='==')return value(args[0],properties,state)===value(args[1],properties,state);
 if(op==='*')return args.reduce((result,arg)=>result*value(arg,properties,state),1);
 if(op==='any')return args.some(arg=>value(arg,properties,state));
 if(op==='case'){for(let i=0;i<args.length-1;i+=2)if(value(args[i],properties,state))return value(args[i+1],properties,state);return value(args.at(-1),properties,state);}
 throw new Error(op);
}
test('legend focus preserves neighbouring rays, with a stronger context at its own place',()=>{
 const opacity=legendFocusOpacity(.8,{legendId:'chosen',legendCenterKey:'place-a'},.4);
 assert.equal(value(opacity,{id:'chosen',centerKey:'place-a'}),.8);
 assert.equal(value(opacity,{id:'neighbour',centerKey:'place-a'}),.8);
 assert.ok(Math.abs(value(opacity,{id:'other',centerKey:'place-b'})-.32)<1e-10);
 assert.equal(value(opacity,{id:'other',centerKey:'place-b'},{hovered:true}),.8);
});
test('clearing a legend restores the existing place focus and ordinary map styles',()=>{
 assert.equal(legendFocusOpacity(.8),.8);
 const opacity=legendFocusOpacity(.8,{centerKey:'place-a'});
 assert.equal(value(opacity,{centerKey:'place-a'}),.8);
 assert.ok(value(opacity,{centerKey:'place-b'})>0);
 assert.equal(value(opacity,{centerKey:'place-b'},{selected:true}),.8);
});
test('missing geography does not invent a common place or erase the background',()=>{
 const opacity=legendFocusOpacity(.8,{legendId:'chosen'},.4);
 assert.equal(value(opacity,{id:'chosen'}),.8);
 assert.ok(Math.abs(value(opacity,{id:'other'})-.32)<1e-10);
});
