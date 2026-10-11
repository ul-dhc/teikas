import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {flattenTypes, selectRecords, selectionLink, UNKNOWN} from '../src/ml-index/statistics.js';
import {buildRelationships, relationshipSelection, buildHierarchy} from '../src/ml-index/network-data.js';
import {encodeSelection,decodeSelection} from '../src/lib/selection.js';
import {buildMetadataNetwork, strongestConnectionIds, indexNetworkEdges, visibleNetworkEdges, networkRenderCollection} from '../src/map/networks.js';
import {treemap} from '../src/ml-index/treemap.js';
const embedded=(file,id)=>JSON.parse(readFileSync(file,'utf8').match(new RegExp(`<script[^>]*id="${id}"[^>]*>(.*?)</script>`,'s'))[1]);
const dashboard=embedded('build/dati/index.html','ml-data');
const map=embedded('build/karte/index.html','corpus-map-data');
const rows=flattenTypes(dashboard.types);
const originalMap=JSON.parse(readFileSync('src/data/map-data.json','utf8'));
const source=JSON.parse(readFileSync('teikas_json/legends.json','utf8'));
test('chapter mosaic preserves counts as non-overlapping proportional areas',()=>{
 const items=dashboard.types.map(type=>({id:type.id,count:type.records.length}));
 const total=items.reduce((sum,item)=>sum+item.count,0);
 const tiles=treemap(items,100,65);
 assert.equal(tiles.length,items.length);
 for(const tile of tiles){
  assert.ok(Math.abs(tile.width*tile.height/6500-tile.count/total)<1e-10);
  assert.ok(tile.x>=0&&tile.y>=0&&tile.x+tile.width<=100+1e-10&&tile.y+tile.height<=65+1e-10);
 }
 for(let i=0;i<tiles.length;i++)for(let j=i+1;j<tiles.length;j++){
  const a=tiles[i],b=tiles[j];
  assert.ok(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)<1e-10||Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)<1e-10);
 }
 assert.deepEqual(treemap([]),[]);
 assert.deepEqual(treemap([{count:0}]),[]);
 assert.equal(treemap([{count:1}])[0].width,100);
});
test('both explorers preserve every source ID once, including unlocated records',()=>{
 assert.deepEqual(new Set(rows.map(r=>r.id)),new Set(source.map(r=>r.id)));
 const mapped=[...map.legends.features.map(f=>f.properties),...map.unmappedLegends];
 assert.equal(mapped.length,source.length);assert.equal(new Set(mapped.map(r=>r.id)).size,source.length);
 const originalCoordinates=new Map(originalMap.legends.features.map(f=>[f.id,f.geometry]));
 for(const feature of map.legends.features)assert.deepEqual(feature.geometry,originalCoordinates.get(feature.id));
 const byId=new Map(rows.map(r=>[r.id,r]));
 for(const record of mapped){assert.equal(record.year||'',byId.get(record.id).year);assert.equal(record.titleLv,byId.get(record.id).titleLv);}
});
test('chapters retain volume distinctions and every record has the correct source chapter',()=>{
 const byId=new Map(source.map(r=>[r.id,r]));
 for(const type of dashboard.types)for(const record of type.records){const original=byId.get(record.id);assert.equal(type.topic,original.volume);assert.equal(type.lv,original.chapter.lv);}
 assert.equal(dashboard.types.filter(t=>t.lv==='Nauda').length,2);
});
test('unknown, undated and chapter filters intersect and preserve exact explorer links',()=>{
 const expected=rows.filter(r=>r.topic==='13'&&!r.county&&!r.year);
 const selected=selectRecords(rows,{topic:'13'},{county:UNKNOWN,decade:'undated'});
 assert.deepEqual(selected,expected);assert.ok(selected.length);
 const url=new URL(selectionLink('/teikas/',selected),'https://example.org');
 assert.equal(url.pathname,'/teikas/teksti/');assert.deepEqual(decodeSelection(url.searchParams.get('selection'),rows),expected.map(r=>r.id).sort());
});
test('network connection selections contain precisely their supporting records',()=>{
 const graph=buildRelationships(rows,'county','typeId',24);
 assert.ok(graph.edges.length);
 const nodes=new Map(graph.nodes.map(n=>[n.id,n]));
 for(const edge of graph.edges){const left=nodes.get(edge.source),right=nodes.get(edge.target);const selected=relationshipSelection(rows,{kind:'edge',left:left.field,leftValue:left.value,right:right.field,rightValue:right.value});assert.deepEqual(selected.map(r=>r.id),edge.recordIds);}
 const hierarchy=buildHierarchy(rows.filter(r=>r.typeId===rows[0].typeId),24);assert.equal(hierarchy.represented,rows.filter(r=>r.typeId===rows[0].typeId).length);
});
test('map metadata networks exclude unlocated records and never invent geographic people nodes',()=>{
 const graph=buildMetadataNetwork('collectors',map.legends.features);
 const mappedIds=new Set(map.legends.features.map(f=>f.properties.id));
 assert.ok(graph.edges.length);assert.ok(graph.nodes.every(n=>n.kind==='place'));
 for(const node of graph.nodes)for(const id of node.legendIds)assert.ok(mappedIds.has(id));
 for(const edge of graph.edges){assert.ok(edge.sharedCount>0);for(const id of edge.legendIds)assert.ok(mappedIds.has(id));}
});

test('compact selections round-trip the full corpus and only expand known source IDs',()=>{
 const encoded=encodeSelection(rows.map(r=>r.id));
 assert.ok(encodeURIComponent(encoded).length<8000);
 assert.deepEqual(decodeSelection(encoded,rows).sort(),rows.map(r=>r.id).sort());
 assert.deepEqual(decodeSelection('000000000~999999999',rows).sort(),rows.map(r=>r.id).sort());
 assert.deepEqual(decodeSelection('not-a-record',rows),[]);
});

test('lightweight network rendering preserves all focused relationships and full exports', () => {
 const graph = buildMetadataNetwork('plots', map.legends.features);
 const original = JSON.stringify(graph);
 const ids = strongestConnectionIds(graph.edges);
 const overview = graph.edges.filter(edge => ids.has(edge.id));
 const adjacent = indexNetworkEdges(graph.edges);
 const focus = graph.nodes.reduce((a,b) => a.connectionCount > b.connectionCount ? a : b).id;
 const incident = graph.edges.filter(edge => edge.fromId === focus || edge.toId === focus);
 assert.deepEqual(adjacent.get(focus), incident);
 const shown = visibleNetworkEdges(graph.edges, overview, adjacent, focus, true, false);
 assert.deepEqual(new Set(shown.map(edge => edge.id)), new Set([...overview,...incident].map(edge => edge.id)));
 assert.deepEqual(visibleNetworkEdges(graph.edges, overview, adjacent, focus, true, true), incident);
 assert.equal(visibleNetworkEdges(graph.edges, overview, adjacent, null, false, false), graph.edges);
 const rendered = networkRenderCollection(shown, () => '#155f8a');
 for(let i=0;i<shown.length;i++) {
  assert.equal(rendered.features[i].properties.id, shown[i].id);
  assert.deepEqual(rendered.features[i].geometry.coordinates, shown[i].coordinates);
  assert.ok(!('legendIds' in rendered.features[i].properties));
 }
 assert.equal(JSON.stringify(graph), original);
 assert.ok(JSON.stringify(rendered).length < original.length / 4);
});
