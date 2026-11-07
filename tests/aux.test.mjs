import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {readCityAux,ensureMergedAux} from '../scripts/lib/aux.mjs';

const labels=(ru,en,ka,uk)=>({ru,en,ka,uk});

async function fixture(){
 const root=await mkdtemp(path.join(os.tmpdir(),'atlas-aux-'));
 const dir=path.join(root,'data','aux','tbilisi');
 await mkdir(dir,{recursive:true});
 const tables={
  'styles.json':{empire:{source:'Ампир',labels:labels('Ампир','Empire','ამპირი','Ампір')}},
  'architects.json':{zaar:{source:'Карл Заар',labels:labels('Карл Заар','Karl Zaar','კარლ ზაარი','Карл Заар')}},
  'districts.json':{tbilisi:{labels:labels('Тбилиси','Tbilisi','თბილისი','Тбілісі')}},
  'year-labels.json':{'year-1905':{source:'1905',labels:labels('1905','1905','1905','1905')}},
 };
 for(const [name,value] of Object.entries(tables))await writeFile(path.join(dir,name),JSON.stringify(value));
 return root;
}

test('merges the four city dictionaries into one build artifact',async()=>{
 const root=await fixture();
 try{
  const {aux,file,written}=await ensureMergedAux({root});
  assert.equal(written,true);
  assert.equal(path.relative(root,file),path.join('data','aux','tbilisi.json'));
  assert.equal(aux.city,'tbilisi');
  assert.deepEqual(Object.keys(aux.styles),['empire']);
  assert.equal(aux.architects.zaar.labels.ka,'კარლ ზაარი');
  assert.equal(aux.districts.tbilisi.labels.uk,'Тбілісі');
  assert.equal(aux.yearLabels['year-1905'].labels.ru,'1905');
  const writtenFile=JSON.parse(await readFile(file,'utf8'));
  assert.equal(writtenFile.version,1);
  assert.equal(writtenFile.city,'tbilisi');
  assert.equal('styleIdBySource' in writtenFile,false);
  assert.equal((await ensureMergedAux({root})).written,false);
 }finally{
  await rm(root,{recursive:true,force:true});
 }
});

test('rejects incomplete labels and unsafe city names',async()=>{
 const root=await fixture();
 try{
  await writeFile(path.join(root,'data','aux','tbilisi','styles.json'),JSON.stringify({broken:{labels:{ru:'Стиль',en:'Style'}}}));
  await assert.rejects(()=>readCityAux({root}),/must contain exactly ru\/en\/ka\/uk/);
  await assert.rejects(()=>readCityAux({root,city:'../etc'}),/invalid city/);
 }finally{
  await rm(root,{recursive:true,force:true});
 }
});
