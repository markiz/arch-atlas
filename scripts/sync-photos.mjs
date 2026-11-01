// Publish the generated atlas images. Full photos are copied from
// data/photos/<city>/... to public/atlas/photos/..., previews from
// data/thumbnails/<city>/... to public/atlas/thumbnails/.... Both public trees
// are generated and ignored by git; the data trees are the source of truth.
import {readdir,copyFile,mkdir,stat,unlink,rmdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {Progress} from './lib/progress.mjs';

export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const silent={write(){}};

async function walk(directory,prefix=''){
 const entries=await readdir(directory,{withFileTypes:true});
 const files=[];
 for(const entry of entries){
  const relative=prefix?`${prefix}/${entry.name}`:entry.name;
  if(entry.isDirectory())files.push(...await walk(path.join(directory,entry.name),relative));
  else if(entry.isFile())files.push(relative);
 }
 return files.sort();
}

async function fileStat(file){
 try{return await stat(file)}catch{return null}
}

async function removeStale(destination,wanted){
 let removed=0;
 try{
  const published=await walk(destination);
  for(const relative of published)if(!wanted.has(relative)){await unlink(path.join(destination,relative));removed++}
  const directories=[];
  async function collect(directory,prefix=''){
   const entries=await readdir(directory,{withFileTypes:true});
   for(const entry of entries){
    const relative=prefix?`${prefix}/${entry.name}`:entry.name;
    if(entry.isDirectory()){await collect(path.join(directory,entry.name),relative);directories.push(relative)}
   }
  }
  try{await collect(destination)}catch{}
  for(const relative of directories.sort((a,b)=>b.length-a.length)){try{await rmdir(path.join(destination,relative))}catch{}}
 }catch{}
 return removed;
}

/** Mirror one generated image tree and remove files that no longer have a source. */
async function syncTree({root,sourceRelative,targetRelative,label,quiet}){
 const source=path.join(root,sourceRelative);
 const destination=path.join(root,targetRelative);
 let files;
 try{files=await walk(source);}
 catch(error){throw new Error(`${sourceRelative}: ${error.message}`);}
 if(!files.length)throw new Error(`${sourceRelative}: no files found`);
 const progress=new Progress(files.length,{label,stream:quiet?silent:process.stderr});
 progress.start(`${files.length} files`);
 let copied=0,kept=0;
 for(const relative of files){
  const from=path.join(source,relative);
  const to=path.join(destination,relative);
  const [sourceInfo,targetInfo]=await Promise.all([fileStat(from),fileStat(to)]);
  if(sourceInfo&&targetInfo&&sourceInfo.size===targetInfo.size&&sourceInfo.mtimeMs<=targetInfo.mtimeMs){kept++}
  else{
   await mkdir(path.dirname(to),{recursive:true});
   await copyFile(from,to);
   copied++;
  }
  progress.advance(relative);
 }
 const removed=await removeStale(destination,new Set(files));
 progress.finish();
 return {files:files.length,copied,kept,removed};
}

/** Copy every source photo and preview into the published atlas. */
export async function syncPhotos({root=ROOT,quiet=false}={}){
 const photos=await syncTree({root,sourceRelative:'data/photos',targetRelative:'public/atlas/photos',label:'publish photos',quiet});
 const thumbnails=await syncTree({root,sourceRelative:'data/thumbnails',targetRelative:'public/atlas/thumbnails',label:'publish photo previews',quiet});
 return {
  files:photos.files+thumbnails.files,
  copied:photos.copied+thumbnails.copied,
  kept:photos.kept+thumbnails.kept,
  removed:photos.removed+thumbnails.removed,
  photos,
  thumbnails,
 };
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=await syncPhotos();
 console.log(`Published ${result.files} image files: ${result.copied} copied, ${result.kept} unchanged, ${result.removed} stale removed (${result.photos.files} photos, ${result.thumbnails.files} previews).`);
}
