import {readFile,access} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Progress} from './lib/progress.mjs';
const data=JSON.parse(await readFile('public/atlas/buildings.json','utf8'));
const geo=JSON.parse(await readFile('public/atlas/basemap.geojson','utf8'));
const buildingOutlines=JSON.parse(await readFile('public/atlas/building-outlines.geojson','utf8'));
const ids=new Set();assert(data.length>0,'Empty collection');assert.equal(geo.type,'FeatureCollection');assert(geo.features.length>0,'Empty basemap');let photos=0,withPhotos=0,galleries=0;
assert.equal(buildingOutlines.type,'FeatureCollection');assert(buildingOutlines.features.length>0,'Empty building outlines');
assert(geo.features.every(feature=>feature.properties?.kind!=='building'),'Ordinary buildings must be separate from basemap');
assert(buildingOutlines.features.every(feature=>feature.properties?.kind==='building'),'Building outlines file contains another feature kind');
const progress=new Progress(data.length,{label:'check atlas cards'});
progress.start();
for(const b of data){
 assert(!ids.has(b.id),`duplicate id: ${b.id}`);ids.add(b.id);
 for(const k of ['name','district','yearLabel','style','description','source','geometryQuality'])assert(typeof b[k]==='string'&&b[k].trim(),`${b.id}: ${k}`);
 assert(typeof b.address==='string'&&b.address===b.addresses?.ru&&b.addresses&&['ru','en','ka','uk'].every(lang=>typeof b.addresses[lang]==='string'),`${b.id}: translated addresses`);
 assert(['ru','en','ka','uk'].every(lang=>b.addresses[lang]===''||b.addresses[lang].trim()),`${b.id}: invalid empty address`);
 assert(typeof b.history==='string',`${b.id}: history`);
 assert(typeof b.styleId==='string'&&b.styles&&['ru','en','ka','uk'].every(lang=>typeof b.styles[lang]==='string'&&b.styles[lang].trim()),`${b.id}: translated style`);
 assert(typeof b.districtId==='string'&&b.districts&&['ru','en','ka','uk'].every(lang=>typeof b.districts[lang]==='string'&&b.districts[lang].trim()),`${b.id}: translated district`);
 assert(Array.isArray(b.architectIds)&&b.architectIds.length===b.architects.length&&b.architectsByLanguage&&['ru','en','ka','uk'].every(lang=>Array.isArray(b.architectsByLanguage[lang])&&b.architectsByLanguage[lang].length===b.architects.length&&b.architectsByLanguage[lang].every(Boolean)),`${b.id}: translated architects`);
 assert(typeof b.yearLabelId==='string'&&b.yearLabels&&['ru','en','ka','uk'].every(lang=>typeof b.yearLabels[lang]==='string'&&b.yearLabels[lang].trim()),`${b.id}: translated construction label`);
 assert(b.descriptions&&['ru','en','ka','uk'].every(lang=>typeof b.descriptions[lang]==='string'&&b.descriptions[lang].trim()),`${b.id}: translated descriptions`);
 if(b.histories){assert(['ru','en','ka','uk'].every(lang=>typeof b.histories[lang]==='string'&&b.histories[lang].trim()),`${b.id}: translated history`);assert.equal(b.history,b.histories.ru,`${b.id}: Russian history fallback`)}else assert.equal(b.history,'',`${b.id}: history should be empty when translations are absent`);
 assert(typeof b.nameKa==='string'&&typeof b.nameEn==='string',`${b.id}: localized names`);
 assert(Array.isArray(b.architects),`${b.id}: architects`);assert(Array.isArray(b.coordinates)&&b.coordinates.length===2&&b.coordinates[0]>44.6&&b.coordinates[0]<45&&b.coordinates[1]>41.5&&b.coordinates[1]<41.9,`${b.id}: coordinates`);
 assert((b.minYear===null&&b.maxYear===null)||(Number.isInteger(b.minYear)&&Number.isInteger(b.maxYear)&&b.minYear<=b.maxYear),`${b.id}: years`);
 assert(b.geometry&&['Polygon','MultiPolygon'].includes(b.geometry.type),`${b.id}: missing outline`);
 if(b.geometryRole!==undefined){assert(['above_ground','heritage_boundary','complex_underground','neighbor_wrong_candidate','historic_plan','visible_domes','unknown'].includes(b.geometryRole),`${b.id}: invalid geometryRole`);}
 if(b.geometryRole==='heritage_boundary')assert(Array.isArray(b.geometryVariants)&&b.geometryVariants.length>0,`${b.id}: heritage boundary requires geometryVariants`);
 if(b.geometryVariants!==undefined){assert(Array.isArray(b.geometryVariants),`${b.id}: geometryVariants must be an array`);for(const variant of b.geometryVariants){assert(['above_ground','heritage_boundary','complex_underground','neighbor_wrong_candidate','historic_plan','visible_domes','unknown'].includes(variant.role),`${b.id}: invalid variant role`);assert(variant.geometry&&['Polygon','MultiPolygon'].includes(variant.geometry.type),`${b.id}: variant missing outline`);}}
 const images=b.photos??(b.photo?[b.photo]:[]);assert(Array.isArray(images),`${b.id}: photos`);if(images.length)withPhotos++;if(images.length>1)galleries++;
 const paths=new Set();
 for(const p of images){
  for(const k of ['file','author','license','licenseUrl','source','modifications'])assert(p[k],`${b.id}: photo.${k}`);
  assert(!p.file.includes('..')&&!p.file.startsWith('/')&&!paths.has(p.file),`${b.id}: invalid or duplicate photo path`);paths.add(p.file);await access('public/atlas/'+p.file);const bytes=await readFile('public/atlas/'+p.file);assert(bytes.length>32&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP',`${b.id}: invalid photo file`);photos++;
 }
 progress.advance(b.id);
}
progress.finish();
console.log(`Validated ${ids.size} buildings with outlines; ${photos} photos, ${withPhotos} buildings with photos, ${galleries} with multiple photos; ${geo.features.length} basemap features and ${buildingOutlines.features.length} optional building outlines.`);
