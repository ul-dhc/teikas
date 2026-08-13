import { readFile, writeFile } from 'node:fs/promises';

const boundaryUrl = 'https://data.gov.lv/dati/dataset/7bb04db9-97ce-4a30-b93a-10ba8dafd104/resource/3ded58bd-c0dc-419a-97ff-59ba45a7b1b0/download/administrativas_teritorijas_2021.geojson';
const boundary = await (await fetch(boundaryUrl)).json();
const places = JSON.parse(await readFile(new URL('../teikas_json/places.json', import.meta.url), 'utf8'));
const bounds = { minLon: 20.85, maxLon: 28.35, minLat: 55.65, maxLat: 58.15 };
const width = 1000, height = 520, pad = 22;
const project = ([lon, lat]) => [pad + (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon) * (width - pad * 2), pad + (bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat) * (height - pad * 2)];
const distance = (point, start, end) => { const [x,y]=point,[x1,y1]=start,[x2,y2]=end,dx=x2-x1,dy=y2-y1; if(!dx&&!dy)return Math.hypot(x-x1,y-y1); const t=Math.max(0,Math.min(1,((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy))); return Math.hypot(x-(x1+t*dx),y-(y1+t*dy)); };
const simplify = (points, tolerance=2.4) => { if(points.length<3)return points; let max=0,index=0; for(let i=1;i<points.length-1;i++){const d=distance(points[i],points[0],points.at(-1));if(d>max){max=d;index=i}} if(max<=tolerance)return[points[0],points.at(-1)]; const left=simplify(points.slice(0,index+1),tolerance),right=simplify(points.slice(index),tolerance);return[...left.slice(0,-1),...right] };
const fmt = n => Number(n.toFixed(1));
const paths = [];
for (const feature of boundary.features) {
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  let d = '';
  for (const polygon of polygons) for (const ring of polygon) {
    const projected = ring.map(project), stride = Math.max(1, Math.ceil(projected.length / 180));
    const sampled = projected.filter((_, index) => index % stride === 0 || index === projected.length - 1);
    const points = sampled;
    if(points.length<3)continue;
    d += `M${fmt(points[0][0])},${fmt(points[0][1])}${points.slice(1).map(([x,y])=>`L${fmt(x)},${fmt(y)}`).join('')}Z`;
  }
  paths.push(d);
}
const points = places.filter(place => place.coordinates && place.coordinates.longitude >= bounds.minLon && place.coordinates.longitude <= bounds.maxLon && place.coordinates.latitude >= bounds.minLat && place.coordinates.latitude <= bounds.maxLat).map(place => { const [x,y]=project([place.coordinates.longitude,place.coordinates.latitude]); return { x:fmt(x), y:fmt(y), count:place.legendCount, id:place.id }; });
await writeFile(new URL('../src/data/home-map.json', import.meta.url), JSON.stringify({width,height,paths,points,source:boundaryUrl}));
console.log(`Generated ${paths.length} boundary paths and ${points.length} collection points.`);
