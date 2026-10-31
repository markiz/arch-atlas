import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {Progress} from './lib/progress.mjs';
const root='dist/atlas/';const manifest=JSON.parse(await readFile(root+'manifest.json','utf8'));const paths=new Set();
const progress=new Progress(manifest.files.length,{label:'verify dist files'});
progress.start();
for(const f of manifest.files){assert(!paths.has(f.path),'duplicate manifest path: '+f.path);paths.add(f.path);const bytes=await readFile(root+f.path);assert.equal(bytes.length,f.size,f.path+' size');assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256,f.path+' hash');if(f.path.endsWith('.webp'))assert(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP',f.path+' image format');progress.advance(f.path)}
progress.finish();
const buildings=JSON.parse(await readFile(root+'buildings.json','utf8'));assert(buildings.length>0,'the atlas has no buildings');
assert(paths.has('building-outlines.geojson'),'optional building outlines missing from manifest');
const basemap=JSON.parse(await readFile(root+'basemap.geojson','utf8'));assert(basemap.features.every(feature=>feature.properties?.kind!=='building'),'ordinary buildings leaked into the initial basemap');
const outlines=JSON.parse(await readFile(root+'building-outlines.geojson','utf8'));assert(outlines.features.length>0&&outlines.features.every(feature=>feature.properties?.kind==='building'),'invalid optional building outlines');
for(const b of buildings){assert(b.geometry,`${b.id} missing outline`);for(const photo of b.photos??[])assert(paths.has(photo.file),`${b.id} photo not in manifest`)}
const html=await readFile('dist/index.html','utf8');assert(!/\b(?:src|href)="https?:\/\//i.test(html),'external asset in HTML');
console.log(`Verified dist: ${buildings.length} buildings, ${manifest.files.length} local resources and their SHA-256 hashes.`);
