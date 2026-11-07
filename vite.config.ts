import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import { assembleAtlas, ROOT as PROJECT_ROOT } from './scripts/assemble-atlas.mjs';
import { assembleLandmarks } from './scripts/assemble-landmarks.mjs';
import { buildMapLayers } from './scripts/build-map-layers.mjs';
import { createManifest } from './scripts/create-manifest.mjs';
import { createPhotoThumbs } from './scripts/create-photo-thumbs.mjs';
import { syncPhotos } from './scripts/sync-photos.mjs';

let manifestRevision='dev';
try{manifestRevision=(JSON.parse(readFileSync('public/atlas/manifest.json','utf8')) as {revision?:string}).revision??'dev';}catch{}

// Repack data/atlas/*/*.json into the city bundle and refresh the manifest, then
// reload the page. Vite watches the source directories; generated files live in
// public/ (and data/aux/<city>.json) and are filtered out here, so the rebuild
// cannot loop on itself. The raw-dependent map layers rebuild only when their
// input hash changes.
function atlasHotReload():Plugin{
 let timer:ReturnType<typeof setTimeout>|undefined;
 let running=false;
 let pending=false;
 async function rebuild(server:ViteDevServer,reload:boolean){
  if(running){pending=true;return;}
  running=true;
  try{
   try{await buildMapLayers({quiet:true});}
   catch(error){server.config.logger.error(`[atlas] map layers: ${error instanceof Error?error.message:String(error)}`);}
   try{await createPhotoThumbs({quiet:true});}
   catch(error){server.config.logger.error(`[atlas] photo previews: ${error instanceof Error?error.message:String(error)}`);}
   const result=await assembleAtlas({quiet:true});
   const landmarks=await assembleLandmarks({quiet:true});
   await syncPhotos({quiet:true});
   await createManifest({quiet:true});
   if(reload)server.ws.send({type:'full-reload'});
   server.config.logger.info(`[atlas] packed ${result.cards.length} objects and ${landmarks.landmarks.length} landmarks`);
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
   const landmarksRoot=path.join(PROJECT_ROOT,'data','landmarks');
   const auxRoot=path.join(PROJECT_ROOT,'data','aux');
   const photosRoot=path.join(PROJECT_ROOT,'data','photos');
   const rawRoot=path.join(PROJECT_ROOT,'raw');
   server.watcher.add([sourceRoot,landmarksRoot,auxRoot,photosRoot,rawRoot]);
   const schedule=(file:string)=>{
    const relative=path.relative(PROJECT_ROOT,file).split(path.sep).join('/');
    const isSource=relative.startsWith('data/atlas/')&&relative.endsWith('.json');
    const isLandmark=relative.startsWith('data/landmarks/')&&relative.endsWith('.json');
    const isPhoto=relative.startsWith('data/photos/');
    const isAux=relative.startsWith('data/aux/')&&relative.endsWith('.json')&&relative.split('/').length>3;
    const isLayerInput=relative.startsWith('raw/')&&/\.(?:xml|json|geojson)$/.test(relative);
    const isTranslations=relative==='data/landmark-name-translations.json'||relative==='data/basemap-name-translations.json';
    if(!isSource&&!isLandmark&&!isPhoto&&!isAux&&!isLayerInput&&!isTranslations)return;
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
