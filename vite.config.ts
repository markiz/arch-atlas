import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const manifest=JSON.parse(readFileSync('public/atlas/manifest.json','utf8')) as {revision?:string};
export default defineConfig({base:'./',define:{__ATLAS_REVISION__:JSON.stringify(manifest.revision??'dev')},server:{watch:{usePolling:process.env.VITE_USE_POLLING==='true'}},build:{target:'es2022'}});
