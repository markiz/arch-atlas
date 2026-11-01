// Rebuild the published map layers public/atlas/basemap.geojson and
// public/atlas/building-outlines.geojson from the tracked raw extracts, but
// only when an input actually changed.
//
// scripts/build-data.py is deterministic: the same raw/osm-grid-*.xml,
// raw/osm-tbilisi-*.{json,geojson}, name translations and the script itself
// always produce byte-identical layers. Hashing that input set costs ~0.3 s
// against ~5 s for the Python pass, so the build is skipped unless the hash
// differs, an output is missing, or --force was passed. The stamp lives in
// .cache/ and is not committed.
import {createHash} from 'node:crypto';
import {readFile,readdir,stat,writeFile,rename,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {Progress} from './lib/progress.mjs';

export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const ATLAS=path.join(ROOT,'public','atlas');
export const STAMP=path.join(ROOT,'.cache','map-layers.json');
const SCRIPT='scripts/build-data.py';
const OUTPUTS=['basemap.geojson','building-outlines.geojson'];
// Everything build-data.py reads besides raw/osm-grid-*.xml. The optional
// translations file is hashed as "missing" when absent, so creating it later
// still invalidates the stamp.
const EXTRA_INPUTS=[
 'raw/osm-tbilisi-selected.json',
 'raw/osm-tbilisi-building-outlines.geojson',
 'data/landmark-name-translations.json',
 'data/basemap-name-translations.json',
 SCRIPT,
];
const silent={write(){}};
// After a failed Python lookup, keep quiet on later rebuilds in the same
// process (the Vite dev plugin calls this on every data change).
let pythonUnavailable=false;

async function fileExists(file){
 try{return (await stat(file)).isFile()}catch{return false}
}

async function inputPaths(){
 const names=await readdir(path.join(ROOT,'raw'));
 const grid=names
  .filter(name=>name.startsWith('osm-grid-')&&name.endsWith('.xml'))
  .sort()
  .map(name=>`raw/${name}`);
 return [...grid,...EXTRA_INPUTS];
}

/** SHA-256 over every input path and its content; mtime alone is not trusted. */
async function inputDigest(stream){
 const files=await inputPaths();
 const progress=new Progress(files.length,{label:'hash map inputs',stream});
 progress.start(`${files.length} files`);
 const digest=createHash('sha256');
 for(const relative of files){
  let content=null;
  try{content=await readFile(path.join(ROOT,relative))}catch(error){if(error.code!=='ENOENT')throw error}
  const contentHash=content?createHash('sha256').update(content).digest('hex'):'missing';
  digest.update(`${relative}\0${contentHash}\n`);
  progress.advance(relative);
 }
 progress.finish();
 return digest.digest('hex');
}

async function readStamp(){
 try{return JSON.parse(await readFile(STAMP,'utf8'))}catch{return null}
}

async function writeStamp(value){
 await mkdir(path.dirname(STAMP),{recursive:true});
 const temporary=`${STAMP}.${process.pid}.tmp`;
 await writeFile(temporary,`${JSON.stringify(value,null,2)}\n`);
 await rename(temporary,STAMP);
}

async function runBuildData(quiet){
 const executable=process.env.PYTHON||'python3';
 let output='';
 await new Promise((resolve,reject)=>{
  const child=spawn(executable,[SCRIPT],{cwd:ROOT,stdio:quiet?['ignore','pipe','pipe']:'inherit'});
  if(quiet){
   const collect=chunk=>{output=`${output}${chunk}`.slice(-4000)};
   child.stdout?.on('data',collect);
   child.stderr?.on('data',collect);
  }
  child.on('error',error=>{
   const failure=error.code==='ENOENT'
    ?Object.assign(new Error(`Не найден ${executable}: для сборки слоёв карты нужен Python 3 (см. README). Путь можно задать через PYTHON=/путь/к/python3.`),{code:error.code})
    :new Error(`${executable}: ${error.message}`);
   reject(failure);
  });
  child.on('close',code=>{
   if(code===0){resolve();return}
   const tail=quiet&&output.trim()?`\n${output.trim()}`:'';
   reject(new Error(`${SCRIPT} завершился с кодом ${code}${tail}`));
  });
 });
}

/**
 * Ensure both map layers exist and match the current raw inputs.
 * @returns {{rebuilt:boolean,digest:string,reason?:string}}
 */
export async function buildMapLayers({fresh=false,quiet=false}={}){
 const stream=quiet?silent:process.stderr;
 const digest=await inputDigest(stream);
 const [stamp,missing]=await Promise.all([
  readStamp(),
  Promise.all(OUTPUTS.map(async name=>({name,present:await fileExists(path.join(ATLAS,name))})))
   .then(items=>items.filter(item=>!item.present).map(item=>item.name)),
 ]);
 const upToDate=!fresh&&missing.length===0&&stamp?.version===1&&stamp.digest===digest;
 if(upToDate){
  if(!quiet)console.log(`Слои карты актуальны (${OUTPUTS.join(', ')}), build-data.py пропущен.`);
  return {rebuilt:false,digest};
 }
 if(pythonUnavailable&&missing.length===0){
  if(!quiet)console.warn('[map-layers] Python 3 не найден, используются существующие слои карты.');
  return {rebuilt:false,digest,reason:'no-python'};
 }
 if(!quiet){
  const reason=fresh?'принудительно':missing.length?`нет ${missing.join(', ')}`:stamp?'исходники изменились':'нет отметки сборки';
  console.log(`Собираю слои карты: ${reason}.`);
 }
 try{
  await runBuildData(quiet);
 }catch(error){
  if(error.code!=='ENOENT')throw error;
  pythonUnavailable=true;
  if(missing.length)throw error;
  if(!quiet)console.warn(`[map-layers] ${error.message} Использую существующие ${OUTPUTS.join(' и ')}; если raw/ менялся, пересобери слои вручную.`);
  return {rebuilt:false,digest,reason:'no-python'};
 }
 const sizes={};
 for(const name of OUTPUTS)sizes[name]=(await stat(path.join(ATLAS,name))).size;
 await writeStamp({version:1,digest,builtAt:new Date().toISOString(),outputs:sizes});
 return {rebuilt:true,digest};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const {rebuilt}=await buildMapLayers({fresh:process.argv.includes('--force')});
  console.log(rebuilt?'Слои карты пересобраны.':'Слои карты пересобирать не нужно.');
 }catch(error){
  console.error(error instanceof Error?error.message:String(error));
  process.exitCode=1;
 }
}
