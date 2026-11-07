// Per-city auxiliary dictionaries: styles, architects, districts and date
// labels. Humans edit the small files under data/aux/<city>/; the build merges
// them into data/aux/<city>.json, the single JSON consumed by assemble-atlas.mjs.
import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
export const LANGS=['ru','en','ka','uk'];
export const AUX_TABLES=[
 {key:'styles',file:'styles.json',label:'styles'},
 {key:'architects',file:'architects.json',label:'architects'},
 {key:'districts',file:'districts.json',label:'districts'},
 {key:'yearLabels',file:'year-labels.json',label:'year labels'},
];

function isPlainObject(value){
 return value!==null&&typeof value==='object'&&!Array.isArray(value);
}

function fail(file,message){
 throw new Error(`${file}: ${message}`);
}

function requireString(file,value,field,{allowEmpty=false}={}){
 if(typeof value!=='string'||(!allowEmpty&&!value.trim()))fail(file,`${field} must be a ${allowEmpty?'':'non-empty '}string`);
 return value;
}

function requireLabels(file,value,field){
 if(!isPlainObject(value))fail(file,`${field} must be an object with ru/en/ka/uk`);
 if(Object.keys(value).length!==LANGS.length||!LANGS.every(lang=>Object.hasOwn(value,lang)))fail(file,`${field} must contain exactly ru/en/ka/uk`);
 for(const lang of LANGS)requireString(file,value[lang],`${field}.${lang}`);
 return {ru:value.ru,en:value.en,ka:value.ka,uk:value.uk};
}

function validateTable(file,table){
 if(!isPlainObject(table))fail(file,'must be an object with id -> entry');
 const ids=Object.keys(table);
 if(!ids.length)fail(file,'must not be empty');
 for(const [id,entry] of Object.entries(table)){
  requireString(file,id,'id');
  if(!isPlainObject(entry))fail(file,`${id} must be an object`);
  requireLabels(file,entry.labels,`${id}.labels`);
  if(entry.source!==undefined)requireString(file,entry.source,`${id}.source`);
 }
 return table;
}

/** Read data/aux/<city>/*.json and return the merged city dictionary. */
export async function readCityAux({root=ROOT,city='tbilisi'}={}){
 if(!/^[a-z0-9-]+$/.test(city))throw new Error(`invalid city "${city}"`);
 const aux={version:1,city};
 for(const {key,file,label} of AUX_TABLES){
  const relative=path.join('data','aux',city,file);
  let parsed;
  try{parsed=JSON.parse(await readFile(path.join(root,relative),'utf8'));}
  catch(error){throw new Error(`${relative}: ${error.message}`);}
  aux[key]=validateTable(relative,parsed);
 }
 return aux;
}

async function atomicWrite(file,contents){
 const temporary=`${file}.${process.pid}.tmp`;
 await writeFile(temporary,contents);
 await rename(temporary,file);
}

/**
 * Merge data/aux/<city>/*.json into data/aux/<city>.json. The merged file is a build
 * artifact, not a published resource and not a hand-edited source.
 */
export async function ensureMergedAux({root=ROOT,city='tbilisi'}={}){
 const aux=await readCityAux({root,city});
 const destination=path.join(root,'data','aux',`${city}.json`);
 const contents=`${JSON.stringify(aux,null,2)}\n`;
 let current=null;
 try{current=await readFile(destination,'utf8');}catch{}
 if(current!==contents){
  await mkdir(path.dirname(destination),{recursive:true});
  await atomicWrite(destination,contents);
  return {aux,file:destination,written:true};
 }
 return {aux,file:destination,written:false};
}

/** Refresh data/aux/<city>.json and read the single file back for the build. */
export async function loadCityAux({root=ROOT,city='tbilisi'}={}){
 const {file}=await ensureMergedAux({root,city});
 return JSON.parse(await readFile(file,'utf8'));
}
