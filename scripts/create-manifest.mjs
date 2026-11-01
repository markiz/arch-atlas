import {readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {Progress} from './lib/progress.mjs';

export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const ATLAS_ROOT=path.join(ROOT,'public','atlas');
const silent={write(){}};

async function writeFileAtomic(file,contents){
 const temporary=`${file}.${process.pid}.tmp`;
 await writeFile(temporary,contents);
 await rename(temporary,file);
}

/** Hash the packed city and landmark bundles, basemap, outlines and every referenced photo. */
export async function createManifest({root=ATLAS_ROOT,quiet=false}={}){
  const bundlePath=path.join(root,'buildings.json');
  const buildings=JSON.parse(await readFile(bundlePath,'utf8'));
  const paths=['buildings.json','landmarks.json','basemap.geojson','building-outlines.geojson',...new Set(buildings.flatMap(item=>(item.photos??(item.photo?[item.photo]:[])).flatMap(photo=>[photo.file,photo.thumb].filter(Boolean))))];
  const progress=new Progress(paths.length,{label:'hash atlas files',stream:quiet?silent:process.stderr});
  progress.start();
  const files=await Promise.all(paths.map(async relative=>{
    const bytes=await readFile(path.join(root,relative));
    const item={path:relative,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
    progress.advance(relative);
    return item;
  }));
  progress.finish();
  const revision=createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0,16);
  await writeFileAtomic(path.join(root,'manifest.json'),JSON.stringify({version:1,revision,files},null,2)+'\n');
  return {files,revision};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const {files}=await createManifest();
  console.log(`Manifest: ${files.length} files, ${files.reduce((total,file)=>total+file.size,0)} bytes`);
}
