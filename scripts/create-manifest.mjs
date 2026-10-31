import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='public/atlas/';
const buildings=JSON.parse(await readFile(root+'buildings.json','utf8'));
const paths=['buildings.json','basemap.geojson','building-outlines.geojson',...new Set(buildings.flatMap(x=>(x.photos??(x.photo?[x.photo]:[])).map(p=>p.file)))];
const files=await Promise.all(paths.map(async path=>{const bytes=await readFile(root+path);return {path,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}}));
const revision=createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0,16);
await writeFile(root+'manifest.json',JSON.stringify({version:1,revision,files},null,2)+'\n');
console.log(`Manifest: ${files.length} files, ${files.reduce((n,f)=>n+f.size,0)} bytes`);
