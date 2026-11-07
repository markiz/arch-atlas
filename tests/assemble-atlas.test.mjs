import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {assembleAtlas,hydrateCard} from '../scripts/assemble-atlas.mjs';

const labels=(ru,en,ka,uk)=>({ru,en,ka,uk});

function attributes(){
 return {
  styles:{'art-nouveau':{labels:labels('Модерн','Art Nouveau','არტ ნუვო','Модерн')}},
  yearLabels:{'year-1905':{labels:labels('1905 год','1905','1905','1905')}},
  districts:{sololaki:{labels:labels('Сололаки','Sololaki','სოლოლაკი','Сололакі')}},
  architects:{saar:{labels:labels('Карл Заар','Karl Saar','კარლ ზაარი','Карл Заар')}},
 };
}

function card(id,overrides={}){
 return {
  id,
  osmId:`way/${id.split('-').at(-1)}`,
  names:labels('Дом','House','სახლი','Будинок'),
  originalLanguage:'ka',
  addresses:labels('улица 1','1 Street','ქუჩა 1','вулиця 1'),
  descriptions:labels('Описание','Description','აღწერა','Опис'),
  histories:labels('История','History','ისტორია','Історія'),
  minYear:1905,
  maxYear:1905,
  yearLabelId:'year-1905',
  styleIds:['art-nouveau'],
  architectIds:['saar'],
  districtId:'sololaki',
  coordinates:[44.8,41.7],
  geometry:{type:'Polygon',coordinates:[[[44.8,41.7],[44.81,41.7],[44.81,41.71],[44.8,41.7]]]},
  geometryQuality:'тестовый контур',
  photos:[],
  source:`https://example.com/${id}`,
  ...overrides,
 };
}

async function fixture(){
 const root=await mkdtemp(path.join(os.tmpdir(),'atlas-assemble-'));
 await mkdir(path.join(root,'data','atlas','tbilisi'),{recursive:true});
 await mkdir(path.join(root,'data','aux','tbilisi'),{recursive:true});
 const tables=attributes();
 for(const [file,table] of [['styles.json','styles'],['architects.json','architects'],['districts.json','districts'],['year-labels.json','yearLabels']]){
  await writeFile(path.join(root,'data','aux','tbilisi',file),JSON.stringify(tables[table]));
 }
 return root;
}

async function writeCard(root,name,value){
 await writeFile(path.join(root,'data','atlas','tbilisi',name),JSON.stringify(value));
}

test('packs cards in filename order and resolves reference labels',async()=>{
 const root=await fixture();
 try{
  await writeCard(root,'osm-2.json',card('osm-2',{histories:undefined,architectIds:[],minYear:null,maxYear:null}));
  await writeCard(root,'osm-1.json',card('osm-1'));
  const outFile=path.join(root,'public','atlas','buildings.json');
  const {cards}=await assembleAtlas({root,outFile,quiet:true});
  assert.deepEqual(cards.map(item=>item.id),['osm-1','osm-2']);

  const first=cards[0];
  assert.equal(first.name,'Дом');
  assert.equal(first.nameKa,'სახლი');
  assert.equal(first.address,'улица 1');
  assert.equal(first.district,'Сололаки');
  assert.equal(first.style,'Модерн');
  assert.equal(first.yearLabel,'1905 год');
  assert.deepEqual(first.architects,['Карл Заар']);
  assert.deepEqual(first.architectsByLanguage,{ru:['Карл Заар'],en:['Karl Saar'],ka:['კარლ ზაარი'],uk:['Карл Заар']});
  assert.equal(first.history,'История');
  assert.deepEqual(first.histories,labels('История','History','ისტორია','Історія'));
  assert.deepEqual(first.styles,labels('Модерн','Art Nouveau','არტ ნუვო','Модерн'));

  const second=cards[1];
  assert.equal(second.history,'');
  assert.equal('histories' in second,false);
  assert.deepEqual(second.architects,[]);
  assert.equal(second.minYear,null);

  const written=JSON.parse(await readFile(outFile,'utf8'));
  assert.equal(written.length,2);
 }finally{
  await rm(root,{recursive:true,force:true});
 }
});

test('rejects a filename that does not match the card id',async()=>{
 const root=await fixture();
 try{
  await writeCard(root,'osm-1.json',card('osm-2'));
  await assert.rejects(()=>assembleAtlas({root,outFile:path.join(root,'out.json'),quiet:true}),/does not match filename/);
 }finally{
  await rm(root,{recursive:true,force:true});
 }
});

test('rejects unknown style and architect references',async()=>{
 const root=await fixture();
 try{
  await writeCard(root,'osm-1.json',card('osm-1',{styleIds:['missing-style']}));
  await assert.rejects(()=>assembleAtlas({root,outFile:path.join(root,'out.json'),quiet:true}),/unknown style reference/);
  await writeCard(root,'osm-1.json',card('osm-1',{architectIds:['missing-architect']}));
  await assert.rejects(()=>assembleAtlas({root,outFile:path.join(root,'out.json'),quiet:true}),/unknown architectIds\[0\] reference/);
 }finally{
  await rm(root,{recursive:true,force:true});
 }
});

test('rejects missing translations and invalid geometry',async()=>{
 const root=await fixture();
 try{
  await writeCard(root,'osm-1.json',card('osm-1',{names:{ru:'Дом'}}));
  await assert.rejects(()=>assembleAtlas({root,outFile:path.join(root,'out.json'),quiet:true}),/names must contain exactly/);
  await writeCard(root,'osm-1.json',card('osm-1',{geometry:{type:'Point',coordinates:[44.8,41.7]}}));
  await assert.rejects(()=>assembleAtlas({root,outFile:path.join(root,'out.json'),quiet:true}),/geometry must be a Polygon/);
 }finally{
  await rm(root,{recursive:true,force:true});
 }
});

test('hydrates translated geometry quality notes',()=>{
 const translations={en:'Test outline',ka:'სატესტო კონტური',uk:'Тестовий контур'};
 const out=hydrateCard(card('osm-2',{geometryQualityTranslations:translations}),attributes());
 assert.deepEqual(out.geometryQualityTranslations,translations);
 assert.equal(out.geometryQuality,'тестовый контур');
});

test('rejects incomplete geometry quality translations',()=>{
 assert.throws(()=>hydrateCard(card('osm-2',{geometryQualityTranslations:{en:'Test outline'}}),attributes()),/geometryQualityTranslations must contain exactly en\/ka\/uk/);
});

test('hydrateCard keeps an empty history out of the bundle',()=>{
 const out=hydrateCard(card('osm-3',{histories:undefined}),attributes());
 assert.equal(out.history,'');
 assert.equal('histories' in out,false);
});

async function writePhoto(root,id,metadata){
 await mkdir(path.join(root,'data','photos','tbilisi'),{recursive:true});
 await writeFile(path.join(root,'data','photos','tbilisi',`${id}.metadata.json`),JSON.stringify(metadata));
}

test('hydrates ordered sha256 photo ids from metadata sidecars',async()=>{
 const root=await fixture();
 const first='a'.repeat(64),second='b'.repeat(64);
 const metadata={author:'A',license:'CC BY 4.0',licenseUrl:'https://example.com/license',source:'https://example.com/photo',modifications:'resized',width:1600,height:1200,rating:87,sourceTags:['Facades','Tbilisi'],visualTags:['facade','balcony']};
 try{
  await writePhoto(root,first,metadata);
  await writePhoto(root,second,{...metadata,author:'B',description:'фасад'});
  await writeCard(root,'osm-1.json',card('osm-1',{photos:[second,first]}));
  const {cards}=await assembleAtlas({root,outFile:path.join(root,'out.json'),quiet:true});
  assert.deepEqual(cards[0].photos.map(photo=>photo.id),[second,first]);
  assert.equal(cards[0].photos[0].file,`photos/tbilisi/${second}.webp`);
  assert.equal(cards[0].photos[0].thumb,`thumbnails/tbilisi/${second}.webp`);
  assert.equal(cards[0].photos[0].author,'B');
  assert.equal(cards[0].photos[0].description,'фасад');
  assert.equal(cards[0].photos[0].width,1600);
  assert.equal(cards[0].photos[0].height,1200);
  assert.equal(cards[0].photos[0].rating,87);
  assert.deepEqual(cards[0].photos[0].sourceTags,['Facades','Tbilisi']);
  assert.deepEqual(cards[0].photos[0].visualTags,['facade','balcony']);

  await writePhoto(root,first,{...metadata,visualTags:['facade','facade']});
  await writeCard(root,'osm-1.json',card('osm-1',{photos:[first]}));
  await assert.rejects(()=>assembleAtlas({root,outFile:path.join(root,'out.json'),quiet:true}),/must not contain duplicates/);

  await writePhoto(root,first,{...metadata,width:0});
  await writeCard(root,'osm-1.json',card('osm-1',{photos:[first]}));
  await assert.rejects(()=>assembleAtlas({root,outFile:path.join(root,'out.json'),quiet:true}),/width must be a positive integer/);

  await writePhoto(root,first,{...metadata,rating:101});
  await writeCard(root,'osm-1.json',card('osm-1',{photos:[first]}));
  await assert.rejects(()=>assembleAtlas({root,outFile:path.join(root,'out.json'),quiet:true}),/rating must be an integer from 0 to 100/);

  await writePhoto(root,first,metadata);
  await writeCard(root,'osm-1.json',card('osm-1',{photos:['1']}));
  await assert.rejects(()=>assembleAtlas({root,outFile:path.join(root,'out.json'),quiet:true}),/lowercase sha256 photo id/);
  await writeCard(root,'osm-1.json',card('osm-1',{photos:['c'.repeat(64)]}));
  await assert.rejects(()=>assembleAtlas({root,outFile:path.join(root,'out.json'),quiet:true}),/references missing/);
  await writeCard(root,'osm-1.json',card('osm-1',{photos:[first,first]}));
  await assert.rejects(()=>assembleAtlas({root,outFile:path.join(root,'out.json'),quiet:true}),/duplicate photo/);
 }finally{
  await rm(root,{recursive:true,force:true});
 }
});
