import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import { assembleAtlas, ROOT as PROJECT_ROOT } from './scripts/assemble-atlas.mjs';
import { createManifest } from './scripts/create-manifest.mjs';

let manifestRevision='dev';
try{manifestRevision=(JSON.parse(readFileSync('public/atlas/manifest.json','utf8')) as {revision?:string}).revision??'dev';}catch{}

// Repack data/atlas/*/*.json into the city bundle and refresh the manifest, then
// reload the page. Vite watches the source directory; generated files live in
// public/ and are not watched here, so the rebuild cannot loop on itself.
function atlasHotReload():Plugin{
 let timer:ReturnType<typeof setTimeout>|undefined;
 let running=false;
 let pending=false;
 async function rebuild(server:ViteDevServer,reload:boolean){
  if(running){pending=true;return;}
  running=true;
  try{
   const result=await assembleAtlas({quiet:true});
   await createManifest({quiet:true});
   if(reload)server.ws.send({type:'full-reload'});
   server.config.logger.info(`[atlas] packed ${result.cards.length} objects from data/atlas/${result.city}/`);
  }catch(error){
   const message=error instanceof Error?error.message:String(error);
   server.config.logger.error(`[atlas] ${message}`);
   if(reload)server.ws.send({type:'error',err:{message,stack:error instanceof Error?error.stack:undefined}});
  }finally{
   running=false;
   if(pending){pending=false;void rebuild(server,true);}
  }
 }
 return{
  name:'atlas-hot-reload',
  apply:'serve',
  async configureServer(server){
   await rebuild(server,false);
   const sourceRoot=path.join(PROJECT_ROOT,'data','atlas');
   const attributesFile=path.join(PROJECT_ROOT,'data','building-attribute-translations.json');
   server.watcher.add([sourceRoot,attributesFile]);
   const schedule=(file:string)=>{
    const relative=path.relative(PROJECT_ROOT,file).split(path.sep).join('/');
    const isSource=relative.startsWith('data/atlas/')&&relative.endsWith('.json');
    if(!isSource&&relative!=='data/building-attribute-translations.json')return;
    clearTimeout(timer);
    timer=setTimeout(()=>void rebuild(server,true),120);
   };
   server.watcher.on('add',schedule);
   server.watcher.on('change',schedule);
   server.watcher.on('unlink',schedule);
   server.httpServer?.once('close',()=>clearTimeout(timer));
  },
 };
}

export default defineConfig({base:'./',define:{__ATLAS_REVISION__:JSON.stringify(manifestRevision)},plugins:[atlasHotReload()],server:{watch:{usePolling:process.env.VITE_USE_POLLING==='true'}},build:{target:'es2022'}});
