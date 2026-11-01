import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {assembleLandmarks,hydrateLandmark} from '../scripts/assemble-landmarks.mjs';

const labels=(ru,en,ka,uk)=>({ru,en,ka,uk});

function landmark(id,overrides={}){
 return {
  id,
  osmId:`way/${id.split('-').at(-1)}`,
  category:'museum',
  subcategory:'museum',
  names:labels('Музей','Museum','მუზეუმი','Музей'),
  addresses:labels('','','',''),
  descriptions:labels('Описание','Description','აღწერა','Опис'),
  descriptionStatus:'reviewed',
  coordinates:[44.8,41.7],
  source:`https://example.com/${id}`,
  otherSources:[],
  heritage:{status:'unknown',registryId:null,osm:null,url:null},
  recognition:{wikidata:null,wikipedia:labels('','','',''),commonsCategory:null,languageCount:0},
  significance:{score:10,components:{heritage:0,recognition:0,architecturalRole:10,age:0,editorial:0},reasons:['тест'],status:'provisional'},
  status:'active',
  access:'public',
  reviewStatus:'draft',
  updatedAt:'2026-11-01',
  ...overrides,
 };
}

async function fixture(){
 const root=await mkdtemp(path.join(os.tmpdir(),'landmark-assemble-'));
 await mkdir(path.join(root,'data','landmarks','tbilisi'),{recursive:true});
 return root;
}

async function writeLandmark(root,name,value){
 await writeFile(path.join(root,'data','landmarks','tbilisi',name),JSON.stringify(value));
}

test('packs landmarks by significance and adds flat UI fields',async()=>{
 const root=await fixture();
 try{
  await writeLandmark(root,'osm-1.json',landmark('osm-1'));
  await writeLandmark(root,'osm-2.json',landmark('osm-2',{
   names:labels('Галерея','Gallery','გალერეა','Галерея'),
   significance:{score:20,components:{heritage:0,recognition:0,architecturalRole:20,age:0,editorial:0},reasons:['тест'],status:'provisional'},
  }));
  const outFile=path.join(root,'public','atlas','landmarks.json');
  const {landmarks}=await assembleLandmarks({root,outFile,quiet:true});
  assert.deepEqual(landmarks.map(item=>item.id),['osm-2','osm-1']);
  assert.equal(landmarks[0].rank,1);
  assert.equal(landmarks[0].name,'Галерея');
  assert.equal(landmarks[0].description,'Описание');
  assert.equal(landmarks[0].score,20);
  assert.equal(landmarks[1].rank,2);
 }finally{await rm(root,{recursive:true,force:true})}
});

test('rejects a score that does not match its components',async()=>{
 const root=await fixture();
 try{
  await writeLandmark(root,'osm-1.json',landmark('osm-1',{significance:{score:11,components:{heritage:0,recognition:0,architecturalRole:10,age:0,editorial:0},reasons:['тест'],status:'provisional'}}));
  await assert.rejects(()=>assembleLandmarks({root,outFile:path.join(root,'out.json'),quiet:true}),/does not equal the component sum/);
 }finally{await rm(root,{recursive:true,force:true})}
});

test('rejects reviewed descriptions with an empty language',async()=>{
 const root=await fixture();
 try{
  await writeLandmark(root,'osm-1.json',landmark('osm-1',{descriptions:labels('Описание','','აღწერა','Опис')}));
  await assert.rejects(()=>assembleLandmarks({root,outFile:path.join(root,'out.json'),quiet:true}),/reviewed descriptions/);
 }finally{await rm(root,{recursive:true,force:true})}
});

test('rejects duplicate osm ids',async()=>{
 const root=await fixture();
 try{
  await writeLandmark(root,'osm-1.json',landmark('osm-1'));
  await writeLandmark(root,'osm-2.json',landmark('osm-2',{osmId:'way/1'}));
  await assert.rejects(()=>assembleLandmarks({root,outFile:path.join(root,'out.json'),quiet:true}),/duplicate osmId/);
 }finally{await rm(root,{recursive:true,force:true})}
});

test('rejects a missing atlas reference',async()=>{
 const root=await fixture();
 try{
  await writeLandmark(root,'osm-1.json',landmark('osm-1',{atlasId:'missing'}));
  await assert.rejects(()=>assembleLandmarks({root,outFile:path.join(root,'out.json'),quiet:true}),/has no data/);
 }finally{await rm(root,{recursive:true,force:true})}
});

test('hydrateLandmark keeps a missing description empty',async()=>{
 const record=landmark('osm-1',{descriptions:labels('','','',''),descriptionStatus:'missing'});
 const out=hydrateLandmark(record,'test',1);
 assert.equal(out.description,'');
 assert.equal(out.descriptionStatus,'missing');
});
