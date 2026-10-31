import {readFile,access} from 'node:fs/promises';
import assert from 'node:assert/strict';
const data=JSON.parse(await readFile('public/atlas/buildings.json','utf8'));
const geo=JSON.parse(await readFile('public/atlas/basemap.geojson','utf8'));
const ids=new Set();assert(data.length>0,'Empty collection');assert.equal(geo.type,'FeatureCollection');assert(geo.features.length>0,'Empty basemap');let photos=0,withPhotos=0,galleries=0;
for(const b of data){
 assert(!ids.has(b.id),`duplicate id: ${b.id}`);ids.add(b.id);
 for(const k of ['name','address','district','yearLabel','style','description','history','source','geometryQuality'])assert(typeof b[k]==='string'&&b[k].trim(),`${b.id}: ${k}`);
 assert(typeof b.nameKa==='string'&&typeof b.nameEn==='string',`${b.id}: localized names`);
 assert(Array.isArray(b.architects),`${b.id}: architects`);assert(Array.isArray(b.coordinates)&&b.coordinates.length===2&&b.coordinates[0]>44.6&&b.coordinates[0]<45&&b.coordinates[1]>41.5&&b.coordinates[1]<41.9,`${b.id}: coordinates`);
 assert((b.minYear===null&&b.maxYear===null)||(Number.isInteger(b.minYear)&&Number.isInteger(b.maxYear)&&b.minYear<=b.maxYear),`${b.id}: years`);
 assert(b.geometry&&['Polygon','MultiPolygon'].includes(b.geometry.type),`${b.id}: missing outline`);
 const images=b.photos??(b.photo?[b.photo]:[]);assert(Array.isArray(images),`${b.id}: photos`);if(images.length)withPhotos++;if(images.length>1)galleries++;
 const paths=new Set();
 for(const p of images){
  for(const k of ['file','author','license','licenseUrl','source','modifications'])assert(p[k],`${b.id}: photo.${k}`);
  assert(!p.file.includes('..')&&!p.file.startsWith('/')&&!paths.has(p.file),`${b.id}: invalid or duplicate photo path`);paths.add(p.file);await access('public/atlas/'+p.file);const bytes=await readFile('public/atlas/'+p.file);assert(bytes.length>32&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP',`${b.id}: invalid photo file`);photos++;
 }
}
console.log(`Validated ${ids.size} buildings with outlines; ${photos} photos, ${withPhotos} buildings with photos, ${galleries} with multiple photos; ${geo.features.length} basemap features.`);
