import {readFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {Progress} from './lib/progress.mjs';
const data=JSON.parse(await readFile('public/atlas/buildings.json','utf8'));
const geo=JSON.parse(await readFile('public/atlas/basemap.geojson','utf8'));
const buildingOutlines=JSON.parse(await readFile('public/atlas/building-outlines.geojson','utf8'));
const taxonomy=JSON.parse(await readFile('data/photo-visual-tags.json','utf8'));
const visualTagIds=new Set(taxonomy.tags.map(tag=>tag.id));
assert(taxonomy.tags.length<50,`visual tag taxonomy must stay below 50 tags, found ${taxonomy.tags.length}`);
const ids=new Set();assert(data.length>0,'Empty collection');assert.equal(geo.type,'FeatureCollection');assert(geo.features.length>0,'Empty basemap');let photos=0,previews=0,withPhotos=0,galleries=0;
assert.equal(buildingOutlines.type,'FeatureCollection');assert(buildingOutlines.features.length>0,'Empty building outlines');
assert(geo.features.every(feature=>feature.properties?.kind!=='building'),'Ordinary buildings must be separate from basemap');
assert(buildingOutlines.features.every(feature=>feature.properties?.kind==='building'),'Building outlines file contains another feature kind');
const progress=new Progress(data.length,{label:'check atlas cards'});
const verifiedPhotos=new Set();
function webpSize(bytes,label){
 const chunk=bytes.subarray(12,16).toString('ascii');
 if(chunk==='VP8X')return{width:1+bytes.readUIntLE(24,3),height:1+bytes.readUIntLE(27,3)};
 if(chunk==='VP8 '){
  assert(bytes[23]===0x9d&&bytes[24]===0x01&&bytes[25]===0x2a,`${label}: invalid VP8 frame header`);
  return{width:bytes.readUInt16LE(26)&0x3fff,height:bytes.readUInt16LE(28)&0x3fff};
 }
 if(chunk==='VP8L'){
  assert(bytes[20]===0x2f,`${label}: invalid VP8L header`);
  const bits=bytes.readUInt32LE(21);
  return{width:(bits&0x3fff)+1,height:((bits>>14)&0x3fff)+1};
 }
 throw new Error(`${label}: unknown WebP chunk ${chunk}`);
}
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
  for(const k of ['id','file','thumb','author','license','licenseUrl','source','modifications'])assert(p[k],`${b.id}: photo.${k}`);
  for(const k of ['width','height'])assert(Number.isInteger(p[k])&&p[k]>0,`${b.id}: photo.${k} must be a positive integer`);
  assert(Number.isInteger(p.rating)&&p.rating>=0&&p.rating<=100,`${b.id}: photo.rating must be an integer from 0 to 100`);
  for(const k of ['sourceTags','visualTags'])if(p[k]!==undefined)assert(Array.isArray(p[k])&&p[k].length>0&&p[k].every(tag=>typeof tag==='string'&&tag.trim())&&new Set(p[k]).size===p[k].length,`${b.id}: photo.${k} must be a non-empty array of unique strings`);
  if(p.visualTags)for(const tag of p.visualTags)assert(visualTagIds.has(tag),`${b.id}: unknown visual tag ${tag}`);
  assert(/^[a-f0-9]{64}$/.test(p.id),`${b.id}: photo id must be a lowercase sha256`);
  const expectedFile=`photos/tbilisi/${p.id}.webp`;
  const expectedThumb=`thumbnails/tbilisi/${p.id}.webp`;
  assert(p.file===expectedFile,`${b.id}: photo file must match ${expectedFile}`);
  assert(p.thumb===expectedThumb,`${b.id}: photo preview must match ${expectedThumb}`);
  for(const file of [p.file,p.thumb]){
   assert(!file.includes('..')&&!file.startsWith('/')&&!paths.has(file),`${b.id}: invalid or duplicate photo path`);paths.add(file);
  }
  if(!verifiedPhotos.has(p.id)){
   const source='data/'+p.file,published='public/atlas/'+p.file;
   const sidecar=`data/photos/tbilisi/${p.id}.metadata.json`;
   await access(source);await access(published);await access(sidecar);
   const metadata=JSON.parse(await readFile(sidecar,'utf8'));
   for(const k of ['author','license','licenseUrl','source','modifications'])assert(metadata[k]===p[k],`${b.id}: photo metadata ${k} differs from sidecar`);
   for(const k of ['width','height'])assert(metadata[k]===p[k],`${b.id}: photo metadata ${k} differs from sidecar`);
   assert(metadata.rating===p.rating,`${b.id}: photo metadata rating differs from sidecar`);
   for(const k of ['sourceTags','visualTags'])assert(JSON.stringify(metadata[k])===JSON.stringify(p[k]),`${b.id}: photo metadata ${k} differs from sidecar`);
   assert(metadata.description===p.description,`${b.id}: photo metadata description differs from sidecar`);
   for(const path of [source,published]){
    const bytes=await readFile(path);
    assert(bytes.length>32&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP',`${b.id}: invalid photo file ${path}`);
    assert(createHash('sha256').update(bytes).digest('hex')===p.id,`${b.id}: photo content does not match its sha256 name ${path}`);
    const size=webpSize(bytes,path);
    assert(size.width===p.width&&size.height===p.height,`${b.id}: photo ${path} is ${size.width}x${size.height}, metadata says ${p.width}x${p.height}`);
   }
   const thumb='data/'+p.thumb,thumbPublished='public/atlas/'+p.thumb;
   await access(thumb);await access(thumbPublished);
   for(const path of [thumb,thumbPublished]){const bytes=await readFile(path);assert(bytes.length>32&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP',`${b.id}: invalid photo preview ${path}`)}
   verifiedPhotos.add(p.id);
  }
  photos++;previews++;
 }
 progress.advance(b.id);
}
progress.finish();
console.log(`Validated ${ids.size} buildings with outlines; ${photos} photos (${previews} previews), ${withPhotos} buildings with photos, ${galleries} with multiple photos; ${geo.features.length} basemap features and ${buildingOutlines.features.length} optional building outlines.`);
