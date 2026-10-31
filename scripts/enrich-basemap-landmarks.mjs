import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd(),raw=path.join(root,'raw'),nodes=new Map(),ways=new Map(),features=[];
const translations=JSON.parse(fs.readFileSync(path.join(root,'data/landmark-name-translations.json'),'utf8'));
function attrs(source){return Object.fromEntries([...source.matchAll(/([\w:]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]))}
function category(tags){
 if(tags.tourism==='museum'||tags.amenity==='museum')return 'museum';
 if(['castle','fort','fortress'].includes(tags.historic))return 'castle';
 if(tags.amenity==='place_of_worship'||['church','chapel','cathedral'].includes(tags.building))return 'church';
 return null;
}
function feature(kind,coordinates,tags,geometry){
 const categoryName=category(tags);if(!categoryName)return;
 const sourceName=tags['name:ru']||tags.name||tags['name:ka']||tags['name:en'],properties={kind:'landmark',category:categoryName},name=translations[sourceName]||sourceName;
 if(name)properties.name=name;
 features.push({type:'Feature',properties,geometry:{type:geometry,coordinates}});
}
for(const file of fs.readdirSync(raw).filter(x=>x.startsWith('osm-grid-')&&x.endsWith('.xml'))){
 const xml=fs.readFileSync(path.join(raw,file),'utf8');
 for(const match of xml.matchAll(/<node\b([^>]*)>([\s\S]*?)<\/node>|<node\b([^>]*)\/>/g)){
  const a=attrs(match[1]||match[3]||''),tags=Object.fromEntries([...(match[2]||'').matchAll(/<tag\b([^>]*)\/>/g)].map(t=>{const x=attrs(t[1]);return [x.k,x.v]}));
  if(!a.id||!a.lon||!a.lat)continue;
  const point=[Number(Number(a.lon).toFixed(6)),Number(Number(a.lat).toFixed(6))];nodes.set(a.id,point);feature('node',point,tags,'Point');
 }
 for(const match of xml.matchAll(/<way\b([^>]*)>([\s\S]*?)<\/way>/g)){
  const a=attrs(match[1]),refs=[...(match[2]||'').matchAll(/<nd\b([^>]*)\/>/g)].map(x=>attrs(x[1]).ref),tags=Object.fromEntries([...(match[2]||'').matchAll(/<tag\b([^>]*)\/>/g)].map(t=>{const x=attrs(t[1]);return [x.k,x.v]}));
  if(refs.length<2)continue;
  ways.set(a.id,{refs,tags});
  if(refs.length>=4&&refs[0]===refs.at(-1)&&refs.every(id=>nodes.has(id)))feature('way',refs.map(id=>nodes.get(id)),tags,'Polygon');
 }
 for(const match of xml.matchAll(/<relation\b([^>]*)>([\s\S]*?)<\/relation>/g)){
  const body=match[2]||'',tags=Object.fromEntries([...body.matchAll(/<tag\b([^>]*)\/>/g)].map(t=>{const x=attrs(t[1]);return [x.k,x.v]}));
  if(!category(tags))continue;
  const refs=[...body.matchAll(/<member\b([^>]*)\/>/g)].map(x=>attrs(x[1])).filter(x=>x.type==='way'&&(!x.role||x.role==='outer')).map(x=>x.ref);
  const coords=refs.flatMap(id=>ways.get(id)?.refs.map(ref=>nodes.get(ref))||[]).filter(Boolean);
  if(coords.length){const center=coords.reduce((p,c)=>[p[0]+c[0]/coords.length,p[1]+c[1]/coords.length],[0,0]);feature('relation',center,tags,'Point')}
 }
}
const file=path.join(root,'public/atlas/basemap.geojson'),data=JSON.parse(fs.readFileSync(file,'utf8'));
for(const f of data.features){if(f.properties?.kind==='landmark'&&translations[f.properties.name])f.properties.name=translations[f.properties.name]}
const existing=new Set(data.features.filter(f=>f.properties?.kind==='landmark').map(f=>JSON.stringify(f.geometry.coordinates)));
const fresh=features.filter(f=>!existing.has(JSON.stringify(f.geometry.coordinates)));
data.features.push(...fresh);fs.writeFileSync(file,JSON.stringify(data));
console.log(`Добавлены достопримечательности: ${fresh.length}`);
