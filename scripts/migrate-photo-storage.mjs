// One-off, idempotent migration from the flat public/atlas/photos/*.webp layout
// to data/photos/<city>/<object>/<n>.webp. Photo metadata in the source cards is
// rewritten to the published path photos/<city>/<object>/<n>.webp.
import {readFile,readdir,writeFile,rename,mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Progress} from './lib/progress.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const city=process.argv.find(value=>value.startsWith('--city='))?.slice('--city='.length)??'tbilisi';
const dryRun=process.argv.includes('--dry-run');
const sourceDir=path.join(ROOT,'data','atlas',city);
const sourcePhotos=path.join(ROOT,'data','photos',city);
const flatPhotos=path.join(ROOT,'public','atlas','photos');

async function exists(file){
 try{await stat(file);return true}catch{return false}
}

async function atomicWrite(file,contents){
 const temporary=`${file}.${process.pid}.tmp`;
 await writeFile(temporary,contents);
 await rename(temporary,file);
}

const cards=(await readdir(sourceDir)).filter(name=>name.endsWith('.json')).sort();
const progress=new Progress(cards.length,{label:`organize ${city} photos`});
progress.start(`${cards.length} cards`);
let moved=0,updated=0,unchangedPhotos=0,unchangedCards=0;
for(const name of cards){
 const file=path.join(sourceDir,name);
 const card=JSON.parse(await readFile(file,'utf8'));
 let changed=false;
 const photos=card.photos??(card.photo?[card.photo]:[]);
 for(const [index,photo] of photos.entries()){
  const expected=`photos/${city}/${card.id}/${index+1}.webp`;
  if(photo.file===expected){unchangedPhotos++;continue}
  const oldAbsolute=path.join(ROOT,'public','atlas',photo.file);
  const newAbsolute=path.join(sourcePhotos,card.id,`${index+1}.webp`);
  const oldIsFlat=photo.file.startsWith('photos/')&&!photo.file.slice('photos/'.length).includes('/');
  if(oldIsFlat&&await exists(oldAbsolute)){
   if(!dryRun){
    await mkdir(path.dirname(newAbsolute),{recursive:true});
    await rename(oldAbsolute,newAbsolute);
   }
   moved++;
  }else if(!(await exists(newAbsolute))){
   throw new Error(`${name}: cannot find ${photo.file} and ${path.relative(ROOT,newAbsolute)} is missing`);
  }
  photo.file=expected;
  changed=true;
  updated++;
 }
 if(changed){
  if(!dryRun)await atomicWrite(file,`${JSON.stringify(card,null,2)}\n`);
 }else{
  unchangedCards++;
 }
 progress.advance(name);
}
progress.finish();
if(!dryRun){
 // Remove now-empty legacy folders, but never the flat directory itself while
 // unknown files may still be there. The sync step performs the final cleanup.
 for(const dir of [flatPhotos]){
  try{const left=await readdir(dir);if(!left.length)await (await import('node:fs/promises')).rmdir(dir)}catch{}
 }
}
console.log(`Photo storage ${dryRun?'would update':'updated'}: ${updated} references, ${moved} files moved, ${unchangedPhotos} photos and ${unchangedCards} cards unchanged.`);
