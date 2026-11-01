#!/usr/bin/env node
// Split prepared registry review sheets into agent-sized batches.
// Excludes cards that already have a reviewed selection file and records with
// only one registry file (no gallery can be added).
import {readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const INDEX=path.join(ROOT,'work','registry-batch','index.json');
const SELECTIONS=path.join(ROOT,'work','registry-batch','selections');
const OUT=path.join(ROOT,'work','registry-batch','review-batches.json');
const BATCH_SIZE=Number(process.env.BATCH_SIZE||8);

const index=JSON.parse(await readFile(INDEX,'utf8'));
let done=new Set();
try{done=new Set((await readdir(SELECTIONS)).filter(name=>name.endsWith('.json')).map(name=>name.slice(0,-5)))}catch{}
const cards=(index.cards||[])
 .filter(card=>!done.has(card.id))
 .filter(card=>Number(card.allCount)>1)
 .map(card=>({id:card.id,registryId:card.registryId,sheet:card.sheet,allCount:card.allCount}));
const batches=[];
for(let offset=0;offset<cards.length;offset+=BATCH_SIZE){
 batches.push({number:batches.length+1,cards:cards.slice(offset,offset+BATCH_SIZE)});
}
await writeFile(OUT,JSON.stringify({schema:1,batchSize:BATCH_SIZE,total:cards.length,batches},null,2)+'\n','utf8');
console.log(`Prepared ${batches.length} batches for ${cards.length} cards (${done.size} already selected, batch size ${BATCH_SIZE}); ${path.relative(ROOT,OUT)}.`);
