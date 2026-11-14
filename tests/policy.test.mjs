import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';

const ROOTS=['scripts','src'];
const UA='ArchAtlas/1.0';
const EMAIL=/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const FORBIDDEN_COMMANDS=[/git\s+remote\s+-v/,/git\s+config\s+--list/,/cat\s+\.env\b/,/printenv\b/];

async function walk(dir){
 const out=[];
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const full=path.join(dir,entry.name);
  if(entry.isDirectory())out.push(...await walk(full));
  else if(/\.(py|mjs|js|ts|tsx|sh)$/.test(entry.name))out.push(full);
 }
 return out;
}

test('network code uses the project User-Agent only',async()=>{
 const files=(await Promise.all(ROOTS.map(walk))).flat();
 for(const file of files){
  const text=await readFile(file,'utf8');
  for(const match of text.matchAll(/(?:const|let|var)?\s*UA\s*=\s*["']([^"']+)["']/g)){
   assert.equal(match[1],UA,`${file}: UA must be exactly ${UA}`);
   assert.ok(!EMAIL.test(match[1]),`${file}: UA must not contain an email`);
  }
  for(const match of text.matchAll(/User-Agent["']?\s*[:=]\s*["']([^"']+)["']/g)){
   assert.equal(match[1],UA,`${file}: User-Agent literal must be exactly ${UA}`);
   assert.ok(!EMAIL.test(match[1]),`${file}: User-Agent must not contain an email`);
  }
 }
});

test('scripts do not read git remotes or env files',async()=>{
 const files=(await Promise.all(ROOTS.map(walk))).flat();
 for(const file of files){
  const text=await readFile(file,'utf8');
  for(const pattern of FORBIDDEN_COMMANDS){
   assert.ok(!pattern.test(text),`${file}: forbidden personal-data command ${pattern}`);
  }
 }
});
