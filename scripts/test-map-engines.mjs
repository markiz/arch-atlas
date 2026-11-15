#!/usr/bin/env node
// Visual and interaction comparison for the Leaflet fallback and the Canvas
// engine. Run in an image with Playwright (see docs/browser-checks.md):
//
//   NODE_PATH=/usr/local/lib/node_modules/@playwright/mcp/node_modules \
//   PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers \
//   npm run test:engines
//
// The test starts its own Vite server, drives two isolated browser pages (one
// per engine), hides non-map chrome for screenshots, and compares the resulting
// PNGs with scripts/compare-images.py. Pixel-exact equality is not expected:
// Canvas and SVG rasterise lines differently, so each scene has explicit mean
// and strongly-different-pixel limits.
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OUT=path.join(ROOT,'work','map-engine-tests');
const VIEWPORT={width:1440,height:900};
const HELPER=path.join(ROOT,'scripts','compare-images.py');
const require=createRequire(import.meta.url);

// In the atlas-codex/atlas-deepseek images Playwright is provided by the MCP
// package outside the project. Keep the suite opt-in; it is not part of npm test.
function loadPlaywright(){
 const candidates=[
  process.env.ATLAS_PLAYWRIGHT_MODULE,
  'playwright',
  '/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright',
 ].filter(Boolean);
 for(const candidate of candidates){
  try{return require(candidate)}
  catch(error){if(candidate===process.env.ATLAS_PLAYWRIGHT_MODULE)console.error(String(error))}
 }
 console.error('Playwright is not available. Run this suite in a browser-enabled image with NODE_PATH pointing to @playwright/mcp/node_modules.');
 process.exit(2);
}
if(!process.env.PLAYWRIGHT_BROWSERS_PATH&&existsSync('/opt/playwright-browsers'))process.env.PLAYWRIGHT_BROWSERS_PATH='/opt/playwright-browsers';
const {chromium}=loadPlaywright();

const scenarios=[
 {name:'base-map',layers:{roads:true,water:true,green:true,buildings:false,details:false,landmarks:false},hide:'base',zoom:0,thresholds:{mean:2.5,gt40:.75}},
 {name:'water-only',layers:{roads:false,water:true,green:false,buildings:false,details:false,landmarks:false},hide:'base',zoom:0,thresholds:{mean:.5,gt40:.3}},
 {name:'full-map',layers:{roads:true,water:true,green:true,buildings:true,details:false,landmarks:false},hide:'full',zoom:0,thresholds:{mean:8,gt40:5}},
 {name:'buildings-only',layers:{roads:false,water:false,green:false,buildings:true,details:false,landmarks:false},hide:'base',zoom:0,thresholds:{mean:6.5,gt40:3.5}},
 {name:'atlas-z15',layers:{roads:false,water:false,green:false,buildings:false,details:false,landmarks:false},hide:'atlas',zoom:2,thresholds:{mean:2,gt40:1.5}},
];

const failures=[];
const log=(message)=>console.log(message);
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const sameView=(a,b,tolerance=1e-9)=>!!a&&!!b&&Math.abs(a.center.lat-b.center.lat)<=tolerance&&Math.abs(a.center.lng-b.center.lng)<=tolerance&&Math.abs(a.zoom-b.zoom)<=1e-9;

async function readView(page){
 return page.evaluate(async()=>{
  const module=await import('/src/map/view-memory.ts');
  return module.savedMapView();
 });
}

async function openLayers(page){
 if(!await page.locator('#map-layers-panel').count())await page.locator('button[aria-controls="map-layers-panel"]').click();
}
async function closeLayers(page){
 if(await page.locator('#map-layers-panel').count())await page.locator('button[aria-controls="map-layers-panel"]').click();
}

async function setLayers(page,layers){
 await openLayers(page);
 const labels={roads:'Улицы',buildings:'Силуэты зданий',water:'Реки и водоёмы',details:'Подробности улиц и названия',landmarks:'Достопримечательности',green:'Парки и природные зоны'};
 for(const [key,label] of Object.entries(labels)){
  const checkbox=page.getByRole('checkbox',{name:label});
  const desired=!!layers[key];
  if(await checkbox.isChecked()!==desired)await (desired?checkbox.check():checkbox.uncheck());
 }
 if(layers.buildings){
  await page.waitForFunction(()=>{
   const label=[...document.querySelectorAll('#map-layers-panel label')].find(item=>item.textContent.includes('Силуэты зданий'));
   return !label||!label.textContent.includes('Загружается');
  },null,{timeout:30000});
 }
 await closeLayers(page);
 await page.waitForTimeout(250);
}

async function zoomIn(page,engine,times){
 for(let index=0;index<times;index++){
  const control=engine==='canvas'?'.atlas-map-canvas a[aria-label="Приблизить"]':'.leaflet-control-zoom-in';
  await page.locator(control).click();
  await page.waitForTimeout(400);
 }
}

const commonHide='.map-caption,.legend,.overview,.map-actions,.locate-button,.location-message,.leaflet-top,.leaflet-bottom{display:none!important}';
function engineHide(engine,mode){
 if(mode==='atlas')return engine==='canvas'?'.atlas-map-base,.atlas-map-markers{display:none!important}':'.leaflet-localBasemap-pane,.leaflet-marker-pane,.leaflet-tooltip-pane{display:none!important}';
 if(mode==='full')return engine==='canvas'?'.atlas-map-markers{display:none!important}':'.leaflet-marker-pane,.leaflet-tooltip-pane{display:none!important}';
 return engine==='canvas'?'.atlas-map-overlay,.atlas-map-markers{display:none!important}':'.leaflet-overlay-pane,.leaflet-marker-pane,.leaflet-tooltip-pane{display:none!important}';
}

async function screenshot(page,engine,mode,name){
 const style=await page.addStyleTag({content:commonHide+engineHide(engine,mode)});
 try{
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const file=path.join(OUT,`${name}-${engine}.png`);
  await page.locator('.map-canvas').screenshot({path:file,animations:'disabled'});
  return file;
 }finally{
  await style.evaluate(element=>element.remove()).catch(()=>{});
 }
}

function compareImages(left,right,diff){
 try{
  return JSON.parse(execFileSync('python3',[HELPER,left,right,diff],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 }catch(error){
  throw new Error(`image comparison failed: ${error.stderr||error.message}`);
 }
}

async function openEngine(browser,base,engine,label){
 const context=await browser.newContext({viewport:VIEWPORT,deviceScaleFactor:1,reducedMotion:'reduce',locale:'ru-RU'});
 await context.addInitScript((engine)=>{
  try{
   localStorage.setItem('atlas-map-engine',engine);
   localStorage.setItem('atlas-language','ru');
   localStorage.setItem('atlas-layer-landmarks','false');
  }catch{}
 },engine);
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',error=>errors.push(`${label} pageerror: ${error.message}`));
 page.on('console',message=>{if(message.type()==='error')errors.push(`${label} console: ${message.text()}`)});
 await page.goto(base,{waitUntil:'load'});
 await page.locator(engine==='canvas'?'.atlas-map-host':'.leaflet-container').waitFor({state:'visible',timeout:30000});
 await page.locator('.map-caption').waitFor({state:'visible',timeout:30000});
 await page.waitForTimeout(400);
 return {context,page,engine,errors};
}

async function runScenario(scenario,canvas,leaflet){
 await setLayers(canvas.page,scenario.layers);
 await setLayers(leaflet.page,scenario.layers);
 if(scenario.zoom){
  await zoomIn(canvas.page,'canvas',scenario.zoom);
  await zoomIn(leaflet.page,'leaflet',scenario.zoom);
  await canvas.page.waitForTimeout(350);
  await leaflet.page.waitForTimeout(350);
 }
 const canvasView=await readView(canvas.page);
 const leafletView=await readView(leaflet.page);
 assert(sameView(canvasView,leafletView,1e-4),`cameras differ: ${JSON.stringify({canvasView,leafletView})}`);
 const left=await screenshot(canvas.page,'canvas',scenario.hide,scenario.name);
 const right=await screenshot(leaflet.page,'leaflet',scenario.hide,scenario.name);
 const diff=path.join(OUT,`${scenario.name}-diff.png`);
 const metrics=compareImages(left,right,diff);
 const pass=metrics.mean_abs<=scenario.thresholds.mean&&metrics.pct_gt_40<=scenario.thresholds.gt40;
 const summary=`mean=${metrics.mean_abs}/255 pct>40=${metrics.pct_gt_40}%`;
 if(!pass)throw new Error(`too far from baseline: ${summary}; limits mean<=${scenario.thresholds.mean}, pct>40<=${scenario.thresholds.gt40}%; screenshots ${left} ${right}`);
 return {...metrics,summary};
}

function viewLabel(view){
 return `${view.center.lat.toFixed(7)},${view.center.lng.toFixed(7)} z${view.zoom}`;
}

async function switchEngine(page,to){
 await openLayers(page);
 // Switch via DOM: Playwright's check() waits for the input to stay attached,
 // but React unmounts the whole map panel as soon as the engine changes.
 await page.evaluate(()=>{
  const label=[...document.querySelectorAll('#map-layers-panel label')].find(item=>item.textContent.includes('Canvas-рендер'));
  label?.querySelector('input')?.click();
 });
 await page.locator(to==='canvas'?'.atlas-map-host':'.leaflet-container').waitFor({state:'visible',timeout:30000});
 await page.waitForTimeout(900);
}

async function checkViewportAndLayers(canvas){
 log('[functional] viewport and layer state survive engine switches');
 await setLayers(canvas.page,{roads:true,water:true,green:false,buildings:false,details:false,landmarks:true});
 await canvas.page.getByTitle('Вернуться к центру').click();
 await canvas.page.waitForTimeout(600);
 const box=await canvas.page.locator('.atlas-map-host').boundingBox();
 await canvas.page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await canvas.page.mouse.down();
 for(let index=1;index<=30;index++){await canvas.page.mouse.move(box.x+box.width/2-index*5,box.y+box.height/2-index*2);await canvas.page.waitForTimeout(12)}
 await canvas.page.mouse.up();
 await canvas.page.waitForTimeout(300);
 const before=await readView(canvas.page);
 assert(before, 'Canvas did not report a view');
 await switchEngine(canvas.page,'leaflet');
 const afterLeaflet=await readView(canvas.page);
 assert(sameView(before,afterLeaflet),`viewport changed on Canvas->Leaflet: ${viewLabel(before)} -> ${afterLeaflet&&viewLabel(afterLeaflet)}`);
 await openLayers(canvas.page);
 for(const [name,expected] of [['Улицы',true],['Реки и водоёмы',true],['Парки и природные зоны',false],['Силуэты зданий',false],['Достопримечательности',true]]){
  const checked=await canvas.page.getByRole('checkbox',{name}).isChecked();
  assert(checked===expected,`layer "${name}" changed across engine switch`);
 }
 await closeLayers(canvas.page);
 await switchEngine(canvas.page,'canvas');
 const afterCanvas=await readView(canvas.page);
 assert(sameView(before,afterCanvas),`viewport changed on Leaflet->Canvas: ${viewLabel(before)} -> ${afterCanvas&&viewLabel(afterCanvas)}`);
 log('  PASS viewport and layers matched exactly');
}

async function checkFocusIsOneShot(canvas){
 log('[functional] focus is not replayed after engine switch');
 await canvas.page.getByRole('button',{name:'Каталог'}).click();
 await canvas.page.waitForTimeout(300);
 await canvas.page.locator('.card').first().locator('.text-link').click();
 await canvas.page.waitForTimeout(900);
 const focused=await readView(canvas.page);
 assert(focused, 'focus did not produce a saved view');
 const box=await canvas.page.locator('.atlas-map-host').boundingBox();
 await canvas.page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await canvas.page.mouse.down();
 for(let index=1;index<=25;index++){await canvas.page.mouse.move(box.x+box.width/2-index*5,box.y+box.height/2+index*2);await canvas.page.waitForTimeout(12)}
 await canvas.page.mouse.up();
 await canvas.page.waitForTimeout(300);
 const panned=await readView(canvas.page);
 await switchEngine(canvas.page,'leaflet');
 const afterSwitch=await readView(canvas.page);
 assert(sameView(panned,afterSwitch),`focus was replayed after switch: ${viewLabel(panned)} -> ${afterSwitch&&viewLabel(afterSwitch)}`);
 await switchEngine(canvas.page,'canvas');
 log('  PASS focus did not override the panned camera');
}

const coverageExpression=()=>{
 const pan=document.querySelector('.atlas-map-pan');
 const base=document.querySelector('.atlas-map-base');
 const host=document.querySelector('.atlas-map-host').getBoundingClientRect();
 if(!pan||!base)return null;
 const matrix=new DOMMatrix(getComputedStyle(pan).transform);
 const scale=matrix.a,tx=matrix.m41,ty=matrix.m42;
 const padX=Math.abs(parseFloat(base.style.left)),padY=Math.abs(parseFloat(base.style.top));
 const width=host.width,height=host.height;
 const canvasWidth=parseFloat(base.style.width),canvasHeight=parseFloat(base.style.height);
 const left=(0-tx)/scale+padX,right=(width-tx)/scale+padX;
 const top=(0-ty)/scale+padY,bottom=(height-ty)/scale+padY;
 return {covered:left>=0&&right<=canvasWidth&&top>=0&&bottom<=canvasHeight,left,right,top,bottom,canvasWidth,canvasHeight};
};

async function checkDragCoverage(canvas){
 log('[functional] long drag never exposes an unrendered strip');
 const inspectorClose=canvas.page.locator('.inspector .icon-btn');
 if(await inspectorClose.count())await inspectorClose.click();
 await canvas.page.waitForTimeout(300);
 if(!await canvas.page.locator('.atlas-map-host').count())throw new Error('canvas engine is not active');
 await canvas.page.getByTitle('Вернуться к центру').click();
 await canvas.page.waitForTimeout(500);
 const box=await canvas.page.locator('.atlas-map-host').boundingBox();
 const x0=box.x+box.width-70,y0=box.y+box.height/2;
 await canvas.page.mouse.move(x0,y0);
 await canvas.page.mouse.down();
 for(let index=1;index<=100;index++){
  await canvas.page.mouse.move(x0-index*9,y0-index*2.4);
  await canvas.page.waitForTimeout(10);
  if(index%10===0){
   const coverage=await canvas.page.evaluate(coverageExpression);
   assert(coverage&&coverage.covered,`unrendered area at drag step ${index}: ${JSON.stringify(coverage)}`);
  }
 }
 await canvas.page.mouse.up();
 await canvas.page.waitForTimeout(300);
 const finalCoverage=await canvas.page.evaluate(coverageExpression);
 assert(finalCoverage&&finalCoverage.covered,`unrendered area after drag: ${JSON.stringify(finalCoverage)}`);
 log('  PASS all sampled drag positions stayed inside the rendered canvas');
}

async function main(){
 await mkdir(OUT,{recursive:true});
 log('Starting Vite test server...');
 const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});
 await server.listen();
 const address=server.httpServer.address();
 const base=`http://127.0.0.1:${address.port}/`;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 let canvas,leaflet;
 try{
  log(`Test page: ${base}`);
  canvas=await openEngine(browser,base,'canvas','canvas');
  leaflet=await openEngine(browser,base,'leaflet','leaflet');
  for(let index=0;index<scenarios.length;index++){
   const scenario=scenarios[index];
   log(`[visual ${index+1}/${scenarios.length}] ${scenario.name}`);
   try{
    const metrics=await runScenario(scenario,canvas,leaflet);
    log(`  PASS ${metrics.summary}`);
   }catch(error){
    failures.push(`${scenario.name}: ${error.message}`);
    log(`  FAIL ${error.message}`);
   }
  }
  try{
   await checkViewportAndLayers(canvas);
  }catch(error){
   failures.push(`viewport/layers: ${error.message}`);
   log(`  FAIL ${error.message}`);
  }
  try{
   await checkFocusIsOneShot(canvas);
  }catch(error){
   failures.push(`focus: ${error.message}`);
   log(`  FAIL ${error.message}`);
  }
  try{
   await checkDragCoverage(canvas);
  }catch(error){
   failures.push(`drag coverage: ${error.message}`);
   log(`  FAIL ${error.message}`);
  }
  const errors=[...canvas.errors,...leaflet.errors];
  if(errors.length)failures.push(`browser errors:\n${errors.join('\n')}`);
  if(failures.length){
   log(`\n${failures.length} failure(s):`);
   for(const failure of failures)log(`- ${failure}`);
   process.exitCode=1;
  }else{
   log('\nAll map engine checks passed.');
  }
 }finally{
  await canvas?.context.close().catch(()=>{});
  await leaflet?.context.close().catch(()=>{});
  await browser.close().catch(()=>{});
  await server.close().catch(()=>{});
 }
}

main().catch(error=>{console.error(error);process.exitCode=1});
