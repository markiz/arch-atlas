import {useEffect, useMemo, useRef, useState} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type {Geometry} from 'geojson';
import type {Building} from './types';
import {period} from './domain';
import {useI18n} from './i18n';

type Props={buildings:Building[];allBuildings:Building[];basemap:GeoJSON.FeatureCollection;selected:string|null;onSelect:(id:string)=>void;focus:{id:string;serial:number}|null;reset:number;fit:number;showFit:boolean;onFit:()=>void;highlightedPeriods:string[]};
function landmarkIcon(category:string){
 const drawings:Record<string,string>={
  museum:'M4 13h16M6 13v8M10 13v8M14 13v8M18 13v8M3 21h18M12 4 3 10h18L12 4Z',
  castle:'M4 21V10h3V6h3v4h4V6h3v4h3v11H4ZM9 21v-6h6v6M2 10h5m7 0h8',
  church:'M5 21V11l7-5 7 5v10M3 21h18M9 21v-6h6v6M12 2v7M9.5 5h5'
 };
 const fill=category==='castle'?'#746542':category==='church'?'#805664':'#a96f43';
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('width','30');svg.setAttribute('height','36');svg.setAttribute('viewBox','0 0 30 36');svg.setAttribute('aria-hidden','true');
 const pin=document.createElementNS(svg.namespaceURI,'path');
 pin.setAttribute('d','M15 1C7.4 1 1.5 6.8 1.5 14c0 9.2 13.5 21 13.5 21S28.5 23.2 28.5 14C28.5 6.8 22.6 1 15 1Z');pin.setAttribute('fill',fill);pin.setAttribute('stroke','#fffef5');pin.setAttribute('stroke-width','1.5');svg.append(pin);
 const glyph=document.createElementNS(svg.namespaceURI,'path');
 glyph.setAttribute('d',drawings[category]||drawings.museum);glyph.setAttribute('transform','translate(6 7) scale(.75)');glyph.setAttribute('fill','none');glyph.setAttribute('stroke','#fffef5');glyph.setAttribute('stroke-width','1.7');glyph.setAttribute('stroke-linecap','round');glyph.setAttribute('stroke-linejoin','round');svg.append(glyph);
 return L.divIcon({className:'landmark-icon',html:svg,iconSize:[30,36],iconAnchor:[15,35],tooltipAnchor:[0,-31]});
}
export default function MapView({buildings,allBuildings,basemap,selected,onSelect,focus,reset,fit,showFit,onFit,highlightedPeriods}:Props){
 const {t,language}=useI18n();
 const container=useRef<HTMLDivElement>(null),mapRef=useRef<L.Map|null>(null),objects=useRef<L.LayerGroup|null>(null),atlasRenderer=useRef<L.SVG|null>(null),position=useRef<L.LayerGroup|null>(null),selectionRef=useRef(onSelect),languageRef=useRef(language),streetLabels=useRef<{latlng:L.LatLng;names:Record<string,string>;fallback:string;angle:number;major:boolean}[]>([]),redrawLabels=useRef<()=>void>(()=>{}),setLabelsEnabled=useRef<(enabled:boolean)=>void>(()=>{});
 const atlasBounds=useMemo(()=>{const bounds=L.latLngBounds([]);const visit=(coordinates:any):void=>{if(!Array.isArray(coordinates))return;if(typeof coordinates[0]==='number'&&typeof coordinates[1]==='number'){bounds.extend([coordinates[1],coordinates[0]]);return}coordinates.forEach(visit)};const geometry=(g:Geometry|null):void=>{if(!g)return;if(g.type==='GeometryCollection')g.geometries.forEach(geometry);else visit(g.coordinates)};allBuildings.forEach(building=>geometry(building.geometry as Geometry|null));return bounds},[allBuildings]);
 const layerRefs=useRef<{roads:L.GeoJSON;buildings:L.GeoJSON;water:L.GeoJSON;green:L.GeoJSON;landmarks:L.GeoJSON}|null>(null);
 const [locationMessage,setLocationMessage]=useState(''),[locating,setLocating]=useState(false),[layersOpen,setLayersOpen]=useState(false);
 const [showRoads,setShowRoads]=useState(true),[showBuildings,setShowBuildings]=useState(false),[showWater,setShowWater]=useState(true),[detailedStreets,setDetailedStreets]=useState(false),[showLandmarks,setShowLandmarks]=useState(()=>{try{return localStorage.getItem('atlas-layer-landmarks')==='true'}catch{return false}}),[showGreen,setShowGreen]=useState(true);
 selectionRef.current=onSelect;
 languageRef.current=language;
 useEffect(()=>{try{localStorage.setItem('atlas-layer-landmarks',String(showLandmarks))}catch{}},[showLandmarks]);
 useEffect(()=>{
  if(!container.current)return;
  streetLabels.current=[];
  const map=L.map(container.current,{zoomControl:false,attributionControl:true,minZoom:10,maxZoom:19,zoomSnap:.5,scrollWheelZoom:false,preferCanvas:false}).setView([41.715,44.800],11.5);
  if(atlasBounds.isValid())map.fitBounds(atlasBounds.pad(.08));
  mapRef.current=map;
  // Animate intermediate zoom levels while keeping new wheel input in the target.
  let wheelDelta=0,wheelPoint=L.point(0,0),wheelTimer:ReturnType<typeof setTimeout>|null=null,wheelFrame:number|null=null,targetZoom=map.getZoom();
  const animateWheelZoom=(startZoom:number,startTime:number)=>{
   const progress=Math.min((performance.now()-startTime)/220,1),eased=1-(1-progress)**3;
   const snap=map.options.zoomSnap;map.options.zoomSnap=0;
   map.setZoomAround(wheelPoint,startZoom+(targetZoom-startZoom)*eased,{animate:false});
   map.options.zoomSnap=snap;
   wheelFrame=progress<1?requestAnimationFrame(()=>animateWheelZoom(startZoom,startTime)):null;
  };
  const applyWheelZoom=()=>{
   wheelTimer=null;if(!wheelDelta)return;
   const amount=4*Math.log(2/(1+Math.exp(-Math.abs(wheelDelta)/240)))/Math.LN2;
   const delta=Math.ceil(amount/.5)*.5*Math.sign(wheelDelta);wheelDelta=0;
   targetZoom=Math.max(map.getMinZoom(),Math.min(map.getMaxZoom(),(wheelFrame===null?map.getZoom():targetZoom)+delta));
   if(wheelFrame!==null)cancelAnimationFrame(wheelFrame);
   if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){map.setZoomAround(wheelPoint,targetZoom,{animate:false});wheelFrame=null}
   else wheelFrame=requestAnimationFrame(()=>animateWheelZoom(map.getZoom(),performance.now()));
  };
  const onWheel=(event:Event)=>{
   wheelDelta+=L.DomEvent.getWheelDelta(event);wheelPoint=map.mouseEventToContainerPoint(event as WheelEvent);
   if(wheelTimer!==null)clearTimeout(wheelTimer);
   wheelTimer=setTimeout(applyWheelZoom,40);L.DomEvent.stop(event);
  };
  L.DomEvent.on(container.current,'wheel',onWheel);
  const resizeObserver=new ResizeObserver(()=>map.invalidateSize({pan:false}));resizeObserver.observe(container.current);
  L.control.zoom({position:'bottomright'}).addTo(map);
  map.attributionControl.setPrefix('');map.attributionControl.setPosition('topleft');
  const localPane=map.createPane('localBasemap');localPane.style.zIndex='190';
  const canvas=L.canvas({padding:.5,pane:'localBasemap'});
  const atlasSvg=L.svg({padding:.5});atlasRenderer.current=atlasSvg;
  const layer=(kind:string,style:(f:any)=>L.PathOptions)=>L.geoJSON(basemap,{renderer:canvas,interactive:kind==='landmark',filter:f=>f.properties?.kind===kind,pointToLayer:(feature,latlng)=>kind==='landmark'?L.marker(latlng,{icon:landmarkIcon(String(feature.properties?.category??'museum')),zIndexOffset:500}):L.circleMarker(latlng),style,onEachFeature:(feature,shape)=>{if(kind==='landmark'&&feature.properties?.name)shape.bindTooltip(()=>String(feature.properties?.names?.[languageRef.current]||feature.properties?.name),{direction:'top'})}} as L.GeoJSONOptions);
  const green=layer('green',()=>({color:'#d5dfd2',weight:.8,fillColor:'#d5dfd2',fillOpacity:.42}));
  const water=layer('water',()=>({color:'#9cbab9',weight:3,fillColor:'#b7d0ce',fillOpacity:.8}));
  const buildingLayer=layer('building',()=>({color:'#9da497',weight:.7,fillColor:'#d6d8cf',fillOpacity:.34}));
  const roads=layer('road',()=>({color:'#fffefa',weight:1.5,opacity:1}));
  const landmarks=layer('landmark',f=>({color:'#947652',weight:1.4,fillColor:'#c7a878',fillOpacity:.34}));
  roads.addTo(map);buildingLayer.addTo(map);water.addTo(map);
  map.attributionControl.addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors');
  const roadFeatures=basemap.features.filter(f=>f.properties?.kind==='road'&&typeof f.properties?.name==='string'&&f.properties.name.trim());
  const lineCoordinates=(f:typeof roadFeatures[number])=>f.geometry.type==='LineString'?f.geometry.coordinates:f.geometry.type==='MultiLineString'?f.geometry.coordinates.flat():[];
  const roadLength=(f:typeof roadFeatures[number])=>{const line=lineCoordinates(f);return line.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-line[i][0],p[1]-line[i][1]),0)};
  const namedRoads=new Map<string,typeof roadFeatures[number]>();
  for(const feature of roadFeatures){const name=String(feature.properties?.name??'').trim(),current=namedRoads.get(name);if(!current||roadLength(feature)>roadLength(current))namedRoads.set(name,feature)}
  for(const feature of namedRoads.values()){
   const coordinates=lineCoordinates(feature);if(coordinates.length<2)continue;
   const total=roadLength(feature);if(total<.00035)continue;
   let passed=0,midpoint=coordinates[Math.floor(coordinates.length/2)],direction=[0,0];
   for(let i=1;i<coordinates.length;i++){
    const a=coordinates[i-1],b=coordinates[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(passed+length>=total/2){const t=(total/2-passed)/length;midpoint=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];direction=[b[0]-a[0],b[1]-a[1]];break}passed+=length;
   }
   let angle=Math.atan2(-direction[1],direction[0])*180/Math.PI;if(angle>90)angle-=180;if(angle< -90)angle+=180;
   if(!direction[0]&&!direction[1])angle=0;
   const roadClass=String(feature.properties?.class),major=['motorway','trunk','primary','secondary','tertiary'].includes(roadClass);
   if(!major&&!['residential','unclassified','living_street','pedestrian'].includes(roadClass))continue;
   const fallback=String(feature.properties?.name??''),names=(feature.properties?.names??{}) as Record<string,string>;
   streetLabels.current.push({latlng:L.latLng(midpoint[1],midpoint[0]),names,fallback,angle,major});
  }
  layerRefs.current={roads,buildings:buildingLayer,water,green,landmarks};
  const labelCanvas=L.DomUtil.create('canvas');
  labelCanvas.style.position='absolute';labelCanvas.style.pointerEvents='none';
  map.getPane('overlayPane')!.appendChild(labelCanvas);
  streetLabels.current.sort((a,b)=>Number(b.major)-Number(a.major));
  let labelsEnabled=false;
  const drawLabels=()=>{
   const size=map.getSize(),ratio=window.devicePixelRatio||1;
   const padding=size.multiplyBy(.3),canvasSize=size.add(padding.multiplyBy(2));
   labelCanvas.width=Math.round(canvasSize.x*ratio);labelCanvas.height=Math.round(canvasSize.y*ratio);
   labelCanvas.style.width=`${canvasSize.x}px`;labelCanvas.style.height=`${canvasSize.y}px`;
   L.DomUtil.setPosition(labelCanvas,map.containerPointToLayerPoint(padding.multiplyBy(-1)));
   labelCanvas.style.display='';
   if(!labelsEnabled)return;
   const ctx=labelCanvas.getContext('2d');if(!ctx)return;
   ctx.scale(ratio,ratio);ctx.font='500 8.5px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.fillStyle='rgba(117,129,118,.75)';ctx.strokeStyle='rgba(255,254,248,.85)';ctx.lineWidth=3;ctx.lineJoin='round';
   const zoom=map.getZoom(),occupied=new Set<string>();
   for(const entry of streetLabels.current){
    if(zoom<(entry.major?11.5:14))continue;
    const point=map.latLngToContainerPoint(entry.latlng).add(padding);
    if(point.x<0||point.y<0||point.x>canvasSize.x||point.y>canvasSize.y)continue;
    const name=entry.names[languageRef.current]||entry.fallback;
    const width=ctx.measureText(name).width, radius=Math.max(width/2,10);
    const cells:string[]=[];
    for(let x=Math.floor((point.x-radius)/80);x<=Math.floor((point.x+radius)/80);x++)for(let y=Math.floor((point.y-10)/24);y<=Math.floor((point.y+10)/24);y++)cells.push(`${x}:${y}`);
    if(cells.some(cell=>occupied.has(cell)))continue;
    cells.forEach(cell=>occupied.add(cell));
    ctx.save();ctx.translate(point.x,point.y);ctx.rotate(entry.angle*Math.PI/180);ctx.strokeText(name,0,0);ctx.fillText(name,0,0);ctx.restore();
   }
  };
  const hideLabels=()=>{labelCanvas.style.display='none'};
  let dragOrigin=map.getPixelBounds().min!,dragFrame:number|null=null;
  const finishMove=()=>{dragOrigin=map.getPixelBounds().min!;drawLabels()};
  const refreshDuringDrag=()=>{
   if(dragFrame!==null)return;
   dragFrame=requestAnimationFrame(()=>{
    dragFrame=null;
    const current=map.getPixelBounds().min!,size=map.getSize();
    if(Math.abs(current.x-dragOrigin.x)<size.x*.2&&Math.abs(current.y-dragOrigin.y)<size.y*.2)return;
    dragOrigin=current;
    // Leaflet's canvas renderer normally refreshes only on moveend.
    if(map.hasLayer(canvas))(canvas as L.Canvas & {_update:()=>void})._update();
    drawLabels();
   });
  };
  map.on('drag',refreshDuringDrag);map.on('moveend',finishMove);map.on('zoomstart',hideLabels);
  redrawLabels.current=drawLabels;
  setLabelsEnabled.current=(enabled)=>{labelsEnabled=enabled;drawLabels()};
  objects.current=L.layerGroup().addTo(map);position.current=L.layerGroup().addTo(map);
  return()=>{resizeObserver.disconnect();L.DomEvent.off(map.getContainer(),'wheel',onWheel);if(wheelTimer!==null)clearTimeout(wheelTimer);if(wheelFrame!==null)cancelAnimationFrame(wheelFrame);map.off('drag',refreshDuringDrag);map.off('moveend',finishMove);map.off('zoomstart',hideLabels);if(dragFrame!==null)cancelAnimationFrame(dragFrame);labelCanvas.remove();redrawLabels.current=()=>{};setLabelsEnabled.current=()=>{};map.remove();mapRef.current=null;objects.current=null;atlasRenderer.current=null;position.current=null};
 },[basemap,atlasBounds]);
 useEffect(()=>{redrawLabels.current()},[language]);
 useEffect(()=>{
  const map=mapRef.current,layers=layerRefs.current;if(!map||!layers)return;
  const sync=(layer:L.Layer,visible:boolean)=>{if(visible&&!map.hasLayer(layer))layer.addTo(map);else if(!visible&&map.hasLayer(layer))map.removeLayer(layer)};
  sync(layers.roads,showRoads);sync(layers.buildings,showBuildings);sync(layers.water,showWater);sync(layers.green,showGreen);sync(layers.landmarks,showLandmarks);
  layers.roads.setStyle((feature:any)=>({color:'#fffefa',weight:detailedStreets?(['primary','secondary','trunk'].includes(feature?.properties?.class)?3.1:1.7):1.5,opacity:1}));
  setLabelsEnabled.current(detailedStreets);
 },[showRoads,showBuildings,showWater,detailedStreets,showLandmarks,showGreen,basemap]);
 useEffect(()=>{
  const group=objects.current;if(!group)return;group.clearLayers();
  for(const b of buildings){
   if(!b.geometry)continue;
   const buildingPeriod=period(b.minYear,b.maxYear)!,color=buildingPeriod.color,isSelected=b.id===selected,matches=!highlightedPeriods.length||highlightedPeriods.includes(buildingPeriod.label);
   L.geoJSON({type:'Feature',properties:{},geometry:b.geometry as Geometry} as GeoJSON.Feature,{renderer:atlasRenderer.current??undefined,noClip:true,style:{color:isSelected?'#244c3c':'#ffffff',weight:isSelected?3:highlightedPeriods.length&&matches?2.8:1.2,fillColor:color,fillOpacity:highlightedPeriods.length&&!matches ? .12 : .92,opacity:highlightedPeriods.length&&!matches ? .25 : 1},onEachFeature:(_f,l)=>{l.on('click',e=>{L.DomEvent.stopPropagation(e);selectionRef.current(b.id)});const tip=document.createElement('span');tip.textContent=b.names?.[language]||b.name;l.bindTooltip(tip,{direction:'top',sticky:true})}} as L.GeoJSONOptions & L.PolylineOptions).addTo(group);
  }
 },[buildings,selected,highlightedPeriods,language]);
 useEffect(()=>{if(focus&&mapRef.current){const b=buildings.find(x=>x.id===focus.id);if(b) mapRef.current.flyTo([b.coordinates[1],b.coordinates[0]],17,{duration:.45})}},[focus]);
 useEffect(()=>{if(fit&&mapRef.current&&buildings.length){const bounds=L.latLngBounds(buildings.map(b=>[b.coordinates[1],b.coordinates[0]]));mapRef.current.fitBounds(bounds.pad(.12),{maxZoom:16})}},[fit]);
 useEffect(()=>{if(reset&&mapRef.current){if(atlasBounds.isValid())mapRef.current.fitBounds(atlasBounds.pad(.08),{animate:true,duration:.45});else mapRef.current.flyTo([41.715,44.800],11.5,{duration:.45})}},[reset,atlasBounds]);
 function locate(){
  if(!navigator.geolocation){setLocationMessage(t('Геолокация недоступна в этом браузере.'));return}
  setLocating(true);setLocationMessage(t('Определяем местоположение…'));
  navigator.geolocation.getCurrentPosition(({coords})=>{
   setLocating(false);const point:L.LatLngExpression=[coords.latitude,coords.longitude];const map=mapRef.current,group=position.current;
   if(!map||!group)return;group.clearLayers();
   L.circle(point,{radius:coords.accuracy,color:'#4383b9',weight:1,fillColor:'#4383b9',fillOpacity:.10,interactive:false}).addTo(group);
   L.circleMarker(point,{radius:8,color:'#fff',weight:3,fillColor:'#287ac2',fillOpacity:1,interactive:false}).addTo(group);map.flyTo(point,17,{duration:.45});
   setLocationMessage(t('Ваше местоположение показано на карте.'));
  },err=>{setLocating(false);setLocationMessage(t(err.code===1?'Доступ к местоположению запрещён.':err.code===3?'Не удалось определить местоположение вовремя.':'Не удалось определить местоположение.'))},{enableHighAccuracy:false,timeout:12000,maximumAge:60000});
 }
 return <><div ref={container} className="map-canvas" aria-label={t('Интерактивная карта архитектурного атласа')}/><div className="map-actions">{showFit&&<button className="fit-results" disabled={!buildings.length} onClick={onFit}>{t('Показать найденные')}</button>}<div className="map-layers"><button className="map-layers-toggle" aria-label={t('Слои')} onClick={()=>setLayersOpen(x=>!x)} aria-expanded={layersOpen} aria-controls="map-layers-panel"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></svg><span>{t('Слои')}</span></button>{layersOpen&&<div id="map-layers-panel" className="map-layers-panel"><p>{t('ОСНОВНАЯ КАРТА')}</p><label><input type="checkbox" checked={showRoads} onChange={e=>setShowRoads(e.target.checked)}/> {t('Улицы')}</label><label><input type="checkbox" checked={showBuildings} onChange={e=>setShowBuildings(e.target.checked)}/> {t('Силуэты зданий')}</label><label><input type="checkbox" checked={showWater} onChange={e=>setShowWater(e.target.checked)}/> {t('Реки и водоёмы')}</label><p>{t('ДОПОЛНИТЕЛЬНЫЕ СЛОИ')}</p><label><input type="checkbox" checked={detailedStreets} onChange={e=>setDetailedStreets(e.target.checked)}/> {t('Подробности улиц и названия')}</label><label><input type="checkbox" checked={showLandmarks} onChange={e=>setShowLandmarks(e.target.checked)}/> {t('Музеи, церкви и крепости')}</label><label><input type="checkbox" checked={showGreen} onChange={e=>setShowGreen(e.target.checked)}/> {t('Парки и природные зоны')}</label></div>}</div></div><button className="locate-button" onClick={locate} disabled={locating} title={t('Моё местоположение')} aria-label={t('Показать моё местоположение')}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg></button>{locationMessage&&<div className="location-message" role="status">{locationMessage}<button onClick={()=>setLocationMessage('')} aria-label={t('Закрыть сообщение')}>×</button></div>}</>;
}
