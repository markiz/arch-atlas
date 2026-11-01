// Run the Python preview generator from the Node build pipeline (build, check
// and the Vite dev server). The generator owns the conversion logic; this
// wrapper only keeps the invocation consistent and quiet where asked.
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SCRIPT=path.join(ROOT,'scripts','create-photo-thumbs.py');

/** Generate missing/stale previews and keep card `thumb` fields in sync. */
export function createPhotoThumbs({quiet=false,args=[]}={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.env.PYTHON??'python3',[SCRIPT,...args],{
   cwd:ROOT,
   stdio:quiet?['ignore','ignore','ignore']:'inherit',
  });
  child.on('error',error=>reject(new Error(`Cannot start Python preview generator: ${error.message}`)));
  child.on('close',code=>{
   if(code===0)resolve();
   else reject(new Error(`Preview generation failed with exit code ${code}. Run npm run photos:thumbs for details.`));
  });
 });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  await createPhotoThumbs({args:process.argv.slice(2)});
 }catch(error){
  console.error(error instanceof Error?error.message:String(error));
  process.exitCode=1;
 }
}
