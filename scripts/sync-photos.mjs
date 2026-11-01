// Copy canonical photos from data/photos/<city>/... into the published atlas
// directory public/atlas/photos/.... The public tree is generated and ignored by
// git; data/photos is the source of truth.
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

/** Copy every source photo into public/atlas/photos and remove stale copies. */
export async function syncPhotos({root=ROOT,quiet=false}={}){
 const source=path.join(root,'data','photos');
 const destination=path.join(root,'public','atlas','photos');
 let files;
 try{files=await walk(source);}
 catch(error){throw new Error(`data/photos: ${error.message}`);}
 if(!files.length)throw new Error('data/photos: no photos found');
 const progress=new Progress(files.length,{label:'publish photos',stream:quiet?silent:process.stderr});
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
 const wanted=new Set(files);
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
 progress.finish();
 return {files:files.length,copied,kept,removed};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=await syncPhotos();
 console.log(`Published ${result.files} photo files: ${result.copied} copied, ${result.kept} unchanged, ${result.removed} stale removed.`);
}
