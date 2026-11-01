#!/usr/bin/env node
// Merge per-card reviewed registry selections into the canonical selection
// file used by scripts/fetch-registry-photos.py.
//
// Review agents write `work/registry-batch/selections/<card-id>.json`; the
// existing `data/registry-photo-selection.json` is kept as the base so manual
// entries (for example the pilot card) are not lost.
import {readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SELECTION=path.join(ROOT,'data','registry-photo-selection.json');
const DIRECTORY=path.join(ROOT,'work','registry-batch','selections');
const TAXONOMY=path.join(ROOT,'data','photo-visual-tags.json');

async function readJson(file){
 return JSON.parse(await readFile(file,'utf8'));
}

async function main(){
 const taxonomy=await readJson(TAXONOMY);
 const allowed=new Set(taxonomy.tags.map(tag=>tag.id));
 let base={schema:1,note:'',items:{}};
 try{base=await readJson(SELECTION)}catch{}
 const items={...(base.items||{})};
 let files=[];
 try{files=(await readdir(DIRECTORY)).filter(name=>name.endsWith('.json')).sort()}catch{}
 const errors=[];
 let added=0;
 for(const name of files){
  const file=path.join(DIRECTORY,name);
  let entry;
  try{entry=await readJson(file)}catch(error){errors.push(`${name}: ${error.message}`);continue}
  const cardId=entry.cardId||entry.id;
  if(typeof cardId!=='string'||!cardId){errors.push(`${name}: missing cardId`);continue}
  if(!Array.isArray(entry.photos)||!entry.photos.length){errors.push(`${name}: photos must be a non-empty array`);continue}
  if(entry.photos.length>4){errors.push(`${name}: ${entry.photos.length} photos, maximum is 4`);continue}
  const seen=new Set();
  let valid=true;
  for(const photo of entry.photos){
   const id=Number(photo?.id);
   if(!Number.isInteger(id)||id<=0){errors.push(`${name}: invalid photo id ${photo?.id}`);valid=false;break}
   if(seen.has(id)){errors.push(`${name}: duplicate photo ${id}`);valid=false;break}
   seen.add(id);
   if(photo.visualTags!==undefined){
    if(!Array.isArray(photo.visualTags)||!photo.visualTags.length){errors.push(`${name}: ${id} needs a non-empty visualTags array`);valid=false;break}
    const unknown=photo.visualTags.filter(tag=>!allowed.has(tag));
    if(unknown.length){errors.push(`${name}: ${id} unknown tags ${unknown.join(', ')}`);valid=false;break}
    if(new Set(photo.visualTags).size!==photo.visualTags.length){errors.push(`${name}: ${id} duplicate tags`);valid=false;break}
   }
  }
  if(!valid)continue;
  items[cardId]={
   registryId:entry.registryId,
   note:entry.note||'',
   photos:entry.photos.map(photo=>({
    id:Number(photo.id),
    ...(photo.visualTags?{visualTags:photo.visualTags}:{})
   }))
  };
  added++;
 }
 const output={
  schema:1,
  note:'Ручной отбор фотографий реестра после просмотра контактных листов; id — photoIds записи memkvidreoba.gov.ge, visualTags назначены в том же проходе.',
  items:Object.fromEntries(Object.entries(items).sort(([a],[b])=>a.localeCompare(b)))
 };
 await writeFile(SELECTION,JSON.stringify(output,null,2)+'\n','utf8');
 for(const error of errors)console.error(`ERROR ${error}`);
 console.log(`Merged ${added} per-card selections (${files.length} files); ${Object.keys(output.items).length} cards in ${path.relative(ROOT,SELECTION)}; ${errors.length} errors.`);
 return errors.length?1:0;
}

process.exitCode=await main();
