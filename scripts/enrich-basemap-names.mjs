import fs from 'node:fs';
import path from 'node:path';
import {Progress} from './lib/progress.mjs';

const root=process.cwd(),raw=path.join(root,'raw'),nodes=new Map(),ways=new Map();
const files=fs.readdirSync(raw).filter(x=>x.startsWith('osm-grid-')&&x.endsWith('.xml'));
const progress=new Progress(files.length,'enrich basemap names');
progress.start();
for(const file of files){
 const xml=fs.readFileSync(path.join(raw,file),'utf8');
 for(const match of xml.matchAll(/<node\b([^>]*)\/?>(?:\s*<\/node>)?/g)){
  const attrs=Object.fromEntries([...match[1].matchAll(/([\w:]+)="([^"]*)"/g)].map(x=>[x[1],x[2]]));
  if(attrs.id&&attrs.lon&&attrs.lat)nodes.set(attrs.id,[Number(Number(attrs.lon).toFixed(6)),Number(Number(attrs.lat).toFixed(6))]);
 }
 for(const match of xml.matchAll(/<way\b[^>]*>([\s\S]*?)<\/way>/g)){
  const refs=[...match[1].matchAll(/<nd\b[^>]*ref="([^"]+)"/g)].map(x=>x[1]);
  const tags=Object.fromEntries([...match[1].matchAll(/<tag\b[^>]*k="([^"]+)"[^>]*v="([^"]*)"[^>]*\/>/g)].map(x=>[x[1],x[2]]));
  const name=tags['name:ru']||tags.name||tags['name:ka'];
  if(name&&tags.highway)ways.set(refs.map(id=>JSON.stringify(nodes.get(id))).join('|'),name);
 }
 progress.advance(file);
}
progress.finish();
const file=path.join(root,'public/atlas/basemap.geojson'),data=JSON.parse(fs.readFileSync(file,'utf8'));
let count=0;
for(const feature of data.features){
 if(feature.properties.kind!=='road')continue;
 const key=feature.geometry.coordinates.map(p=>JSON.stringify(p)).join('|'),name=ways.get(key);
 if(name){feature.properties.name=name;count++}
}
fs.writeFileSync(file,JSON.stringify(data));
console.log(`Добавлены названия для ${count} дорожных отрезков`);
