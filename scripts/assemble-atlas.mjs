// Pack one source JSON per atlas object into the single city bundle consumed by
// the web app. Source files live in data/atlas/<city>/<id>.json and keep
// translations inline; style, architect, district and construction-label fields
// stay references into data/building-attribute-translations.json.
//
// The bundle is what the app loads (public/atlas/buildings.json for Tbilisi).
// It is generated, never edited by hand, and rebuilt by npm run build and by the
// Vite dev plugin before the page reloads.
import {readFile,readdir,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {Progress} from './lib/progress.mjs';

export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const DEFAULT_CITY='tbilisi';
export const DEFAULT_OUT=path.join(ROOT,'public','atlas','buildings.json');
export const ATTRIBUTES_FILE=path.join(ROOT,'data','building-attribute-translations.json');
const LANGS=['ru','en','ka','uk'];
const GEOMETRY_ROLES=new Set(['above_ground','heritage_boundary','complex_underground','neighbor_wrong_candidate','historic_plan','visible_domes','unknown']);

const silent={write(){}};

async function writeFileAtomic(file,contents){
 const temporary=`${file}.${process.pid}.tmp`;
 await writeFile(temporary,contents);
 await rename(temporary,file);
}

function fail(file,message){
  throw new Error(`${file}: ${message}`);
}

function isPlainObject(value){
  return value!==null&&typeof value==='object'&&!Array.isArray(value);
}

function requireString(file,value,field,{allowEmpty=false}={}){
  if(typeof value!=='string'||(!allowEmpty&&!value.trim()))fail(file,`${field} must be a ${allowEmpty?'':'non-empty '}string`);
  return value;
}

function requireLabels(file,value,field,{allowEmpty=false}={}){
  if(!isPlainObject(value))fail(file,`${field} must be an object with ru/en/ka/uk`);
  if(Object.keys(value).length!==LANGS.length||!LANGS.every(lang=>Object.hasOwn(value,lang)))fail(file,`${field} must contain exactly ru/en/ka/uk`);
  for(const lang of LANGS)requireString(file,value[lang],`${field}.${lang}`,{allowEmpty});
  return {ru:value.ru,en:value.en,ka:value.ka,uk:value.uk};
}

function requireReference(file,id,table,kind){
  if(typeof id!=='string'||!id.trim())fail(file,`${kind} reference must be a non-empty string`);
  if(!Object.hasOwn(table,id))fail(file,`unknown ${kind} reference "${id}"`);
  return id;
}

function referenceLabels(file,table,id,kind){
  const entry=table[id];
  if(!entry||!isPlainObject(entry.labels))fail(file,`${kind} "${id}" has no labels in the shared dictionary`);
  return requireLabels(file,entry.labels,`${kind} "${id}" labels`);
}

function validateGeometry(file,geometry,field){
  if(!isPlainObject(geometry)||!['Polygon','MultiPolygon'].includes(geometry.type))fail(file,`${field} must be a Polygon or MultiPolygon`);
  if(!Array.isArray(geometry.coordinates)||!geometry.coordinates.length)fail(file,`${field} has no coordinates`);
  return geometry;
}

function validatePhoto(file,photo,index,seen,city,id){
  if(!isPlainObject(photo))fail(file,`photos[${index}] must be an object`);
  for(const key of ['file','author','license','licenseUrl','source','modifications'])requireString(file,photo[key],`photos[${index}].${key}`);
  if(photo.file.includes('..')||photo.file.startsWith('/'))fail(file,`photos[${index}].file is not a safe relative path`);
  if(city){
    const prefix=`photos/${city}/${id}/`;
    if(!photo.file.startsWith(prefix))fail(file,`photos[${index}].file must live under ${prefix}`);
    const name=photo.file.slice(prefix.length);
    if(!/^\d+\.webp$/.test(name))fail(file,`photos[${index}].file must be named <number>.webp under ${prefix}`);
    requireString(file,photo.thumb,`photos[${index}].thumb`);
    if(photo.thumb!==`${prefix}${name.replace(/\.webp$/,'-thumb.webp')}`)fail(file,`photos[${index}].thumb must match ${prefix}<number>-thumb.webp`);
  }
  if(seen.has(photo.file))fail(file,`duplicate photo file ${photo.file}`);
  seen.add(photo.file);
  if(city){
    if(seen.has(photo.thumb))fail(file,`duplicate photo preview ${photo.thumb}`);
    seen.add(photo.thumb);
  }
  if(photo.description!==undefined)requireString(file,photo.description,`photos[${index}].description`,{allowEmpty:true});
  return photo;
}

/**
 * Convert one source record into the shape the UI already consumes. Labels for
 * reference fields are resolved here so the browser does not need the shared
 * dictionary.
 */
export function hydrateCard(card,attributes,file=`<${card?.id??'unknown'}>`,city){
  if(!isPlainObject(card))fail(file,'record must be an object');
  const id=requireString(file,card.id,'id');
  const names=requireLabels(file,card.names,'names');
  const addresses=requireLabels(file,card.addresses,'addresses',{allowEmpty:true});
  const descriptions=requireLabels(file,card.descriptions,'descriptions');
  const histories=card.histories===undefined?null:requireLabels(file,card.histories,'histories');

  const styleId=requireReference(file,card.styleId,attributes.styles,'style');
  const yearLabelId=requireReference(file,card.yearLabelId,attributes.yearLabels,'construction label');
  const districtId=requireReference(file,card.districtId,attributes.districts,'district');
  if(!Array.isArray(card.architectIds))fail(file,'architectIds must be an array');
  const architectIds=card.architectIds.map((value,index)=>requireReference(file,value,attributes.architects,`architectIds[${index}]`));
  if(new Set(architectIds).size!==architectIds.length)fail(file,'architectIds must not contain duplicates');

  if(!(card.minYear===null&&card.maxYear===null)&&!(Number.isInteger(card.minYear)&&Number.isInteger(card.maxYear)&&card.minYear<=card.maxYear))fail(file,'minYear/maxYear must both be null or an ordered integer pair');
  if(!Array.isArray(card.coordinates)||card.coordinates.length!==2||!card.coordinates.every(value=>Number.isFinite(value)))fail(file,'coordinates must be [longitude, latitude]');
  const geometry=validateGeometry(file,card.geometry,'geometry');
  requireString(file,card.geometryQuality,'geometryQuality');
  requireString(file,card.source,'source');
  if(!/^https?:\/\//.test(card.source))fail(file,'source must be an http(s) URL');
  if(card.otherSource!==undefined&&!/^https?:\/\//.test(requireString(file,card.otherSource,'otherSource')))fail(file,'otherSource must be an http(s) URL');
  if(card.googlePlaceId!==undefined)requireString(file,card.googlePlaceId,'googlePlaceId');
  if(card.googlePlaceIdSource!==undefined&&!/^https?:\/\//.test(requireString(file,card.googlePlaceIdSource,'googlePlaceIdSource')))fail(file,'googlePlaceIdSource must be an http(s) URL');

  if(card.geometryRole!==undefined&&!GEOMETRY_ROLES.has(card.geometryRole))fail(file,`unknown geometryRole "${card.geometryRole}"`);
  if(card.geometryVariants!==undefined){
    if(!Array.isArray(card.geometryVariants))fail(file,'geometryVariants must be an array');
    for(const [index,variant] of card.geometryVariants.entries()){
      if(!isPlainObject(variant))fail(file,`geometryVariants[${index}] must be an object`);
      if(!GEOMETRY_ROLES.has(variant.role))fail(file,`geometryVariants[${index}].role is invalid`);
      validateGeometry(file,variant.geometry,`geometryVariants[${index}].geometry`);
    }
  }

  if(!Array.isArray(card.photos))fail(file,'photos must be an array');
  const seenPhotos=new Set();
  const photos=card.photos.map((photo,index)=>validatePhoto(file,photo,index,seenPhotos,city,id));

  const styles=referenceLabels(file,attributes.styles,styleId,'style');
  const yearLabels=referenceLabels(file,attributes.yearLabels,yearLabelId,'construction label');
  const districts=referenceLabels(file,attributes.districts,districtId,'district');
  const architectsByLanguage={ru:[],en:[],ka:[],uk:[]};
  for(const architectId of architectIds){
    const labels=referenceLabels(file,attributes.architects,architectId,'architect');
    for(const lang of LANGS)architectsByLanguage[lang].push(labels[lang]);
  }

  const out={
    id,
    name:names.ru,
    nameKa:names.ka,
    nameEn:names.en,
    nameUk:names.uk,
    names,
    address:addresses.ru,
    addresses,
    district:districts.ru,
    districts,
    districtId,
    minYear:card.minYear,
    maxYear:card.maxYear,
    yearLabel:yearLabels.ru,
    yearLabelId,
    yearLabels,
    architects:architectsByLanguage.ru,
    architectIds,
    architectsByLanguage,
    style:styles.ru,
    styleId,
    styles,
    description:descriptions.ru,
    descriptions,
    history:histories?.ru??'',
    coordinates:card.coordinates,
    geometry,
    geometryQuality:card.geometryQuality,
    photos,
    source:card.source,
  };
  if(histories)out.histories=histories;
  if(card.osmId!==undefined)out.osmId=requireString(file,card.osmId,'osmId');
  if(card.originalLanguage!==undefined)out.originalLanguage=requireString(file,card.originalLanguage,'originalLanguage');
  if(card.otherSource!==undefined)out.otherSource=card.otherSource;
  if(card.googlePlaceId!==undefined)out.googlePlaceId=card.googlePlaceId;
  if(card.googlePlaceIdSource!==undefined)out.googlePlaceIdSource=card.googlePlaceIdSource;
  if(card.geometryRole!==undefined)out.geometryRole=card.geometryRole;
  if(card.geometryVariants!==undefined)out.geometryVariants=card.geometryVariants;
  return out;
}

/**
 * Read data/atlas/<city>/*.json and write the packed city bundle.
 * @param {{city?:string,root?:string,outFile?:string,quiet?:boolean}} options
 */
export async function assembleAtlas({city=DEFAULT_CITY,root=ROOT,outFile,quiet=false}={}){
  const destination=outFile??(city===DEFAULT_CITY?DEFAULT_OUT:path.join(root,'public','atlas',`${city}.json`));
  const sourceDir=path.join(root,'data','atlas',city);
  const attributesPath=path.join(root,'data','building-attribute-translations.json');
  let attributes;
  try{attributes=JSON.parse(await readFile(attributesPath,'utf8'));}
  catch(error){throw new Error(`${path.relative(root,attributesPath)}: ${error.message}`);}
  for(const table of ['styles','yearLabels','districts','architects']){
    if(!isPlainObject(attributes[table]))throw new Error(`${path.relative(root,attributesPath)}: missing "${table}" table`);
  }

  let files;
  try{files=(await readdir(sourceDir)).filter(name=>name.endsWith('.json')).sort();}
  catch(error){throw new Error(`${path.relative(root,sourceDir)}: ${error.message}`);}
  if(!files.length)throw new Error(`${path.relative(root,sourceDir)}: no atlas objects found`);

  const progress=new Progress(files.length,{label:`pack ${city} atlas`,stream:quiet?silent:process.stderr});
  progress.start();
  const cards=[];
  const ids=new Set();
  for(const file of files){
    const relative=path.join('data','atlas',city,file);
    const id=path.basename(file,'.json');
    let card;
    try{card=JSON.parse(await readFile(path.join(sourceDir,file),'utf8'));}
    catch(error){throw new Error(`${relative}: ${error.message}`);}
    if(card.id!==id)fail(relative,`id "${card.id}" does not match filename "${id}.json"`);
    if(ids.has(id))fail(relative,`duplicate id "${id}"`);
    ids.add(id);
    cards.push(hydrateCard(card,attributes,relative,city));
    progress.advance(file);
  }
  progress.finish();

  await mkdir(path.dirname(destination),{recursive:true});
  await writeFileAtomic(destination,`${JSON.stringify(cards)}\n`);
  return {cards,city,outFile:destination};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const argument=(name)=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
  const city=argument('city')??DEFAULT_CITY;
  const out=argument('out');
  const result=await assembleAtlas({city,outFile:out?path.resolve(ROOT,out):undefined});
  console.log(`Packed ${result.cards.length} objects from data/atlas/${result.city}/ into ${path.relative(ROOT,result.outFile)}`);
}
