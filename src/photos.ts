import {useEffect,useRef,useState} from 'react';
import type {Building,ManifestFile,Photo} from './types';

const atlasBase=import.meta.env.BASE_URL+'atlas/';

export interface PhotoAsset {photo:Photo;full?:string;thumb?:string}
export interface BuildingPhotos {
 status:'loading'|'ready'|'error';
 phase:'preview'|'gallery'|null;
 assets:PhotoAsset[];
 total:number;
 loaded:number;
 error?:string;
}

interface PhotoRun {state:BuildingPhotos;promise:Promise<BuildingPhotos>;listeners:Set<(state:BuildingPhotos)=>void>}

const fileRequests=new Map<string,Promise<string>>();
const resolvedFiles=new Map<string,string>();
const runs=new Map<string,PhotoRun>();

function errorText(error:unknown){
 return error instanceof Error?error.message:'Не удалось загрузить фотографию';
}

function isSafePath(file:string){
 return !!file&&!file.includes('..')&&!file.startsWith('/');
}

function hashHex(bytes:ArrayBuffer){
 return crypto.subtle.digest('SHA-256',bytes).then(digest=>Array.from(new Uint8Array(digest)).map(value=>value.toString(16).padStart(2,'0')).join(''));
}

/** Download and verify one photo from the local atlas bundle. */
export function loadPhotoFile(file:string,files:ReadonlyMap<string,ManifestFile>):Promise<string>{
 const resolved=resolvedFiles.get(file);
 if(resolved)return Promise.resolve(resolved);
 const pending=fileRequests.get(file);
 if(pending)return pending;
 const manifest=files.get(file);
 if(!manifest)return Promise.reject(new Error(`В пакете нет фотографии ${file}`));
 if(!isSafePath(file)||manifest.path!==file)return Promise.reject(new Error(`Некорректный путь фотографии ${file}`));
 const request=(async()=>{
  const response=await fetch(`${atlasBase}${file}?v=${encodeURIComponent(manifest.sha256)}`);
  if(!response.ok)throw new Error(`Не удалось загрузить фотографию ${file}`);
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength!==manifest.size||(await hashHex(bytes))!==manifest.sha256)throw new Error(`Повреждена фотография ${file}`);
  const url=URL.createObjectURL(new Blob([bytes],{type:'image/webp'}));
  resolvedFiles.set(file,url);
  return url;
 })();
 const tracked=request.catch(error=>{fileRequests.delete(file);throw error});
 fileRequests.set(file,tracked);
 return tracked;
}

/** A photo already downloaded during this session, if any. */
export function cachedPhotoUrl(file:string|undefined){
 return file?resolvedFiles.get(file):undefined;
}

function publish(run:PhotoRun,state:BuildingPhotos){
 run.state=state;
 for(const listener of run.listeners)listener(state);
}

function startBuildingRun(building:Building,files:ReadonlyMap<string,ManifestFile>):PhotoRun{
 const run:PhotoRun={state:{status:'loading',phase:null,assets:[],total:0,loaded:0},promise:Promise.resolve({status:'loading',phase:null,assets:[],total:0,loaded:0}),listeners:new Set()};
 runs.set(building.id,run);
 run.promise=(async()=>{
  const photos=building.photos??(building.photo?[building.photo]:[]);
  const total=photos.length;
  if(!total){const empty:BuildingPhotos={status:'ready',phase:'gallery',assets:[],total:0,loaded:0};publish(run,empty);return empty}
  const thumbResults=await Promise.allSettled(photos.map(photo=>photo.thumb?loadPhotoFile(photo.thumb,files):Promise.reject(new Error('У фотографии нет уменьшенной версии'))));
  const previewAssets=photos.map((photo,index)=>{const result=thumbResults[index];return {photo,thumb:result.status==='fulfilled'?result.value:undefined}});
  const previewFailures=thumbResults.filter(result=>result.status==='rejected').length;
  const preview:BuildingPhotos={status:previewFailures===total&&total>0?'loading':'ready',phase:'preview',assets:previewAssets,total,loaded:total-previewFailures,error:previewFailures?'Часть превью не загрузилась.':undefined};
  publish(run,preview);
  const fullResults=await Promise.allSettled(photos.map(photo=>loadPhotoFile(photo.file,files)));
  const assets=photos.map((photo,index)=>{const result=fullResults[index];return {photo,thumb:previewAssets[index].thumb,full:result.status==='fulfilled'?result.value:undefined}});
  const failures=fullResults.filter(result=>result.status==='rejected').length;
  if(failures===total)throw new Error(errorText(fullResults.find(result=>result.status==='rejected')?.reason));
  const ready:BuildingPhotos={status:'ready',phase:'gallery',assets,total,loaded:total-failures,error:failures?'Часть фотографий не загрузилась.':undefined};
  publish(run,ready);
  return ready;
 })().catch(error=>{
  const failed:BuildingPhotos={status:'error',phase:null,assets:[],total:0,loaded:0,error:errorText(error)};
  publish(run,failed);
  return failed;
 });
 return run;
}

/** Load all previews for an object first, then its full gallery files. */
export function useBuildingPhotos(building:Building|null,files:ReadonlyMap<string,ManifestFile>){
 const [attempt,setAttempt]=useState(0);
 const [state,setState]=useState<BuildingPhotos>({status:'loading',phase:null,assets:[],total:0,loaded:0});
 useEffect(()=>{
  if(!building){setState({status:'ready',phase:'gallery',assets:[],total:0,loaded:0});return}
  const run=startBuildingRun(building,files);
  setState(run.state);
  run.listeners.add(setState);
  return()=>{run.listeners.delete(setState)};
 },[building?.id,files,attempt]);
 const retry=()=>{if(!building)return;runs.delete(building.id);setAttempt(value=>value+1)};
 return {...state,retry};
}

/** Request one preview file only after its card becomes visible. */
export function useLazyPhoto(file:string|undefined,files:ReadonlyMap<string,ManifestFile>,visible:boolean){
 const [url,setUrl]=useState<string|undefined>(()=>cachedPhotoUrl(file));
 const [error,setError]=useState('');
 useEffect(()=>{
  if(!file||!visible||url)return;
  let active=true;
  loadPhotoFile(file,files).then(value=>{if(active)setUrl(value)}).catch(value=>{if(active)setError(errorText(value))});
  return()=>{active=false};
 },[file,files,visible,url]);
 return {url,error};
}

export function useVisibility<T extends HTMLElement>(){
 const ref=useRef<T>(null);
 const [visible,setVisible]=useState(false);
 useEffect(()=>{
  if(visible||!ref.current)return;
  if(typeof IntersectionObserver==='undefined'){setVisible(true);return}
  const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect()}},{rootMargin:'240px'});
  observer.observe(ref.current);
  return()=>observer.disconnect();
 },[visible]);
 return {ref,visible};
}
