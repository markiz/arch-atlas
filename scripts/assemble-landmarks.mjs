// Pack one source JSON per landmark into the single city bundle consumed by the
// app and future landmark tooling. Source files live in
// data/landmarks/<city>/<id>.json and keep four-language names, descriptions,
// source links and the significance breakdown inline.
//
// The bundle is generated (public/atlas/landmarks.json), never edited by hand,
// and rebuilt by npm run build/check and by the Vite dev plugin.
import {readFile,readdir,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {Progress} from './lib/progress.mjs';

export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const DEFAULT_CITY='tbilisi';
export const DEFAULT_OUT=path.join(ROOT,'public','atlas','landmarks.json');
const LANGS=['ru','en','ka','uk'];
const CATEGORIES=new Set(['museum','church','castle','theatre','monument']);
const SUBCATEGORIES=new Set([
 'museum','gallery','house_museum','memorial_museum',
 'church','cathedral','monastery','chapel','synagogue','mosque',
 'fortress','tower','palace',
 'theatre','opera','concert_hall',
 'monument','memorial','archaeological_site','historic_building',
]);
const HERITAGE_STATUSES=new Set(['national','local','listed','none','unknown']);
const STATUSES=new Set(['active','closed','ruined','demolished','unknown']);
const ACCESSES=new Set(['public','exterior','restricted','unknown']);
const REVIEW_STATUSES=new Set(['draft','reviewed']);
const DESCRIPTION_STATUSES=new Set(['reviewed','draft','missing']);
const SIGNIFICANCE_STATUSES=new Set(['provisional','reviewed']);
const COMPONENT_LIMITS={heritage:30,recognition:25,architecturalRole:20,age:10,editorial:15};
const TBILISI_BOUNDS={minLon:44.3,maxLon:45.3,minLat:41.5,maxLat:42.0};
const silent={write(){}};

function fail(file,message){throw new Error(`${file}: ${message}`);}
function isPlainObject(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
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
function requireUrl(file,value,field){
 requireString(file,value,field);
 if(!/^https?:\/\//.test(value))fail(file,`${field} must be an http(s) URL`);
 return value;
}
function requireOptionalUrl(file,value,field){
 if(value===null||value===undefined)return null;
 return requireUrl(file,value,field);
}
function requireNullableString(file,value,field){
 if(value===null||value===undefined)return null;
 return requireString(file,value,field);
}
function requireCoordinate(file,value){
 if(!Array.isArray(value)||value.length!==2||!value.every(Number.isFinite))fail(file,'coordinates must be [longitude, latitude]');
 const [lon,lat]=value;
 if(lon<TBILISI_BOUNDS.minLon||lon>TBILISI_BOUNDS.maxLon||lat<TBILISI_BOUNDS.minLat||lat>TBILISI_BOUNDS.maxLat)fail(file,'coordinates are outside the Tbilisi bounds');
 return [lon,lat];
}
function validateHeritage(file,value){
 if(!isPlainObject(value))fail(file,'heritage must be an object');
 if(!HERITAGE_STATUSES.has(value.status))fail(file,`unknown heritage.status "${value.status}"`);
 if(value.registryId!==null&&value.registryId!==undefined&&(!Number.isInteger(value.registryId)||value.registryId<=0))fail(file,'heritage.registryId must be a positive integer or null');
 if(value.osm!==null&&value.osm!==undefined&&!['1','2','3'].includes(value.osm))fail(file,'heritage.osm must be "1", "2", "3" or null');
 requireOptionalUrl(file,value.url,'heritage.url');
 return value;
}
function validateRecognition(file,value){
 if(!isPlainObject(value))fail(file,'recognition must be an object');
 if(value.wikidata!==null&&value.wikidata!==undefined&&(!/^Q[0-9]+$/.test(value.wikidata)))fail(file,'recognition.wikidata must be a QID or null');
 const wikipedia=value.wikipedia;
 if(!isPlainObject(wikipedia))fail(file,'recognition.wikipedia must be an object with ru/en/ka/uk');
 if(Object.keys(wikipedia).length!==LANGS.length||!LANGS.every(lang=>Object.hasOwn(wikipedia,lang)))fail(file,'recognition.wikipedia must contain exactly ru/en/ka/uk');
 for(const lang of LANGS)requireString(file,wikipedia[lang],`recognition.wikipedia.${lang}`,{allowEmpty:true});
 requireNullableString(file,value.commonsCategory,'recognition.commonsCategory');
 if(!Number.isInteger(value.languageCount)||value.languageCount<0||value.languageCount>4)fail(file,'recognition.languageCount must be an integer from 0 to 4');
 return value;
}
function validateSignificance(file,value){
 if(!isPlainObject(value))fail(file,'significance must be an object');
 if(!isPlainObject(value.components))fail(file,'significance.components must be an object');
 const keys=Object.keys(value.components).sort();
 const expected=Object.keys(COMPONENT_LIMITS).sort();
 if(keys.length!==expected.length||keys.some((key,index)=>key!==expected[index]))fail(file,`significance.components must contain exactly ${expected.join(', ')}`);
 let sum=0;
 for(const [key,limit] of Object.entries(COMPONENT_LIMITS)){
  const item=value.components[key];
  if(!Number.isInteger(item)||item<0||item>limit)fail(file,`significance.components.${key} must be an integer from 0 to ${limit}`);
  sum+=item;
 }
 if(!Number.isInteger(value.score)||value.score<0||value.score>100)fail(file,'significance.score must be an integer from 0 to 100');
 if(value.score!==sum)fail(file,`significance.score ${value.score} does not equal the component sum ${sum}`);
 if(!Array.isArray(value.reasons)||!value.reasons.every(reason=>typeof reason==='string'&&reason.trim()))fail(file,'significance.reasons must be an array of non-empty strings');
 if(!SIGNIFICANCE_STATUSES.has(value.status))fail(file,`unknown significance.status "${value.status}"`);
 return value;
}
function validateDate(file,value){
 requireString(file,value,'updatedAt');
 if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))fail(file,'updatedAt must be YYYY-MM-DD');
 return value;
}
function normalized(value){return String(value??'').toLowerCase().replace(/[^a-zа-яёіїєґ0-9]+/giu,' ').trim();}
function distanceMetres(a,b){
 const toRad=value=>value*Math.PI/180;
 const lat1=toRad(a[1]),lat2=toRad(b[1]),dLat=lat2-lat1,dLon=toRad(b[0]-a[0]);
 const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
 return 6371000*2*Math.asin(Math.sqrt(h));
}

async function writeFileAtomic(file,contents){
 const temporary=`${file}.${process.pid}.tmp`;
 await writeFile(temporary,contents);
 await rename(temporary,file);
}

export function hydrateLandmark(record,file,rank){
 if(!isPlainObject(record))fail(file,'record must be an object');
 const id=requireString(file,record.id,'id');
 const category=requireString(file,record.category,'category');
 if(!CATEGORIES.has(category))fail(file,`unknown category "${category}"`);
 const subcategory=requireString(file,record.subcategory,'subcategory');
 if(!SUBCATEGORIES.has(subcategory))fail(file,`unknown subcategory "${subcategory}"`);
 const names=requireLabels(file,record.names,'names');
 const addresses=requireLabels(file,record.addresses,'addresses',{allowEmpty:true});
 const descriptions=requireLabels(file,record.descriptions,'descriptions',{allowEmpty:true});
 if(!DESCRIPTION_STATUSES.has(record.descriptionStatus))fail(file,`unknown descriptionStatus "${record.descriptionStatus}"`);
 if(record.descriptionStatus==='reviewed'&&!LANGS.every(lang=>descriptions[lang].trim()))fail(file,'reviewed descriptions must be non-empty in all four languages');
 const coordinates=requireCoordinate(file,record.coordinates);
 const source=requireUrl(file,record.source,'source');
 if(!Array.isArray(record.otherSources))fail(file,'otherSources must be an array');
 for(const [index,url] of record.otherSources.entries())requireUrl(file,url,`otherSources[${index}]`);
 if(record.otherSources.includes(source))fail(file,'source must not repeat in otherSources');
 const heritage=validateHeritage(file,record.heritage);
 const recognition=validateRecognition(file,record.recognition);
 const significance=validateSignificance(file,record.significance);
 if(!STATUSES.has(record.status))fail(file,`unknown status "${record.status}"`);
 if(!ACCESSES.has(record.access))fail(file,`unknown access "${record.access}"`);
 if(!REVIEW_STATUSES.has(record.reviewStatus))fail(file,`unknown reviewStatus "${record.reviewStatus}"`);
 validateDate(file,record.updatedAt);
 requireNullableString(file,record.osmId,'osmId');
 requireNullableString(file,record.atlasId,'atlasId');
 requireNullableString(file,record.districtId,'districtId');
 requireNullableString(file,record.originalLanguage,'originalLanguage');
 if(record.notes!==undefined)requireString(file,record.notes,'notes',{allowEmpty:true});
 const out={
  id,
  name:names.ru,
  nameKa:names.ka,
  nameEn:names.en,
  nameUk:names.uk,
  names,
  description:descriptions.ru,
  descriptions,
  descriptionStatus:record.descriptionStatus,
  category,
  subcategory,
  coordinates,
  source,
  otherSources:record.otherSources,
  heritage,
  recognition,
  significance,
  score:significance.score,
  status:record.status,
  access:record.access,
  reviewStatus:record.reviewStatus,
  updatedAt:record.updatedAt,
  rank,
 };
 if(record.osmId!==null&&record.osmId!==undefined)out.osmId=record.osmId;
 if(record.atlasId!==null&&record.atlasId!==undefined)out.atlasId=record.atlasId;
 if(record.districtId!==null&&record.districtId!==undefined)out.districtId=record.districtId;
 if(record.originalLanguage!==null&&record.originalLanguage!==undefined)out.originalLanguage=record.originalLanguage;
 if(record.notes!==undefined)out.notes=record.notes;
 return out;
}

/**
 * Read data/landmarks/<city>/*.json and write the packed city bundle.
 * @param {{city?:string,root?:string,outFile?:string,quiet?:boolean}} options
 */
export async function assembleLandmarks({city=DEFAULT_CITY,root=ROOT,outFile,quiet=false}={}){
 const destination=outFile??(city===DEFAULT_CITY?DEFAULT_OUT:path.join(root,'public','atlas',`landmarks-${city}.json`));
 const sourceDir=path.join(root,'data','landmarks',city);
 let files;
 try{files=(await readdir(sourceDir)).filter(name=>name.endsWith('.json')).sort();}
 catch(error){throw new Error(`${path.relative(root,sourceDir)}: ${error.message}`);}
 if(!files.length)throw new Error(`${path.relative(root,sourceDir)}: no landmark objects found`);
 const progress=new Progress(files.length,{label:`pack ${city} landmarks`,stream:quiet?silent:process.stderr});
 progress.start();
 const landmarks=[];
 const ids=new Set();
 const osmIds=new Set();
 for(const file of files){
  const relative=path.join('data','landmarks',city,file);
  const id=path.basename(file,'.json');
  let record;
  try{record=JSON.parse(await readFile(path.join(sourceDir,file),'utf8'));}
  catch(error){throw new Error(`${relative}: ${error.message}`);}
  if(record.id!==id)fail(relative,`id "${record.id}" does not match filename "${id}.json"`);
  if(ids.has(id))fail(relative,`duplicate id "${id}"`);
  ids.add(id);
  if(record.osmId!==null&&record.osmId!==undefined){
   if(osmIds.has(record.osmId))fail(relative,`duplicate osmId "${record.osmId}"`);
   osmIds.add(record.osmId);
  }
  if(record.atlasId){
   const atlasFile=path.join(root,'data','atlas',city,`${record.atlasId}.json`);
   try{await readFile(atlasFile)}catch{fail(relative,`atlasId "${record.atlasId}" has no data/atlas/${city}/${record.atlasId}.json`)}
  }
  landmarks.push(record);
  progress.advance(file);
 }
 progress.finish();
 landmarks.sort((a,b)=>b.significance.score-a.significance.score||a.category.localeCompare(b.category)||a.id.localeCompare(b.id));
 const packed=landmarks.map((record,index)=>hydrateLandmark(record,path.join('data','landmarks',city,`${record.id}.json`),index+1));
 // Catch exact duplicates that the id/osmId checks cannot see.
 for(let i=0;i<packed.length;i++){
  for(let j=i+1;j<packed.length;j++){
   const a=packed[i],b=packed[j];
   if(a.coordinates[0]===b.coordinates[0]&&a.coordinates[1]===b.coordinates[1]&&normalized(a.name)===normalized(b.name))fail(`data/landmarks/${city}`,`${a.id} and ${b.id} share coordinates and name`);
   if(distanceMetres(a.coordinates,b.coordinates)<10&&normalized(a.name)===normalized(b.name))fail(`data/landmarks/${city}`,`${a.id} and ${b.id} are closer than 10 m with the same name`);
  }
 }
 await mkdir(path.dirname(destination),{recursive:true});
 await writeFileAtomic(destination,`${JSON.stringify(packed)}\n`);
 return {landmarks:packed,city,outFile:destination};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const argument=(name)=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
 const city=argument('city')??DEFAULT_CITY;
 const out=argument('out');
 const result=await assembleLandmarks({city,outFile:out?path.resolve(ROOT,out):undefined});
 console.log(`Packed ${result.landmarks.length} landmarks from data/landmarks/${result.city}/ into ${path.relative(ROOT,result.outFile)}`);
}
