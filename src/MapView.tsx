import {useEffect, useRef, useState} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type {Geometry} from 'geojson';
import type {Building} from './types';
import {period} from './domain';

type Props={buildings:Building[];basemap:GeoJSON.FeatureCollection;selected:string|null;onSelect:(id:string)=>void;focus:{id:string;serial:number}|null;reset:number;fit:number};
export default function MapView({buildings,basemap,selected,onSelect,focus,reset,fit}:Props){
 const container=useRef<HTMLDivElement>(null),mapRef=useRef<L.Map|null>(null),objects=useRef<L.LayerGroup|null>(null),position=useRef<L.LayerGroup|null>(null),selectionRef=useRef(onSelect);
 const [locationMessage,setLocationMessage]=useState(''),[locating,setLocating]=useState(false);
 selectionRef.current=onSelect;
 useEffect(()=>{
  if(!container.current)return;
  const map=L.map(container.current,{zoomControl:false,attributionControl:true,minZoom:10,maxZoom:19,zoomSnap:.5,preferCanvas:false}).setView([41.715,44.800],11.5);
  mapRef.current=map;
  L.control.zoom({position:'bottomright'}).addTo(map);
  map.attributionControl.setPrefix('');
  const localPane=map.createPane('localBasemap');localPane.style.zIndex='190';
  const canvas=L.canvas({padding:.5,pane:'localBasemap'});
  const layer=(kind:string,style:(f:any)=>L.PathOptions)=>L.geoJSON(basemap,{renderer:canvas,interactive:false,filter:f=>f.properties?.kind===kind,style} as L.GeoJSONOptions).addTo(map);
  layer('green',()=>({color:'#e0e8d8',weight:1,fillColor:'#e0e8d8',fillOpacity:1}));
  layer('water',()=>({color:'#a6c2c1',weight:4,fillColor:'#b7d0ce',fillOpacity:1}));
  layer('building',()=>({color:'#c9cdc1',weight:.65,fillColor:'#dedfd5',fillOpacity:.48}));
  layer('road',f=>({color:['primary','secondary','trunk','tertiary'].includes(f.properties?.class)?'#fffdf7':'#fbfaf4',weight:['primary','secondary','trunk'].includes(f.properties?.class)?3.3:1.7,opacity:1}));
  map.attributionControl.addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors');
  const roadFeatures=basemap.features.filter(f=>f.properties?.kind==='road'&&typeof f.properties?.name==='string'&&f.properties.name.trim());
  const roadLength=(f:typeof roadFeatures[number])=>{
   const lines=f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.type==='MultiLineString'?f.geometry.coordinates:[];
   return lines.reduce((total,line)=>total+line.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-line[i][0],p[1]-line[i][1]),0),0);
  };
  const namedRoads=new Map<string,typeof roadFeatures[number]>();
  for(const feature of roadFeatures){const name=String(feature.properties.name).trim(),current=namedRoads.get(name);if(!current||roadLength(feature)>roadLength(current))namedRoads.set(name,feature)}
  const streetLabels=L.layerGroup().addTo(map);
  for(const feature of namedRoads.values()){
   const line=L.geoJSON(feature as GeoJSON.Feature,{interactive:false}).getLayers()[0] as L.Layer & {getBounds?:()=>L.LatLngBounds};
   if(!line.getBounds)continue;
   const center=line.getBounds().getCenter();
   L.tooltip({permanent:true,direction:'center',className:'street-label',opacity:.9}).setLatLng(center).setContent(String(feature.properties.name)).addTo(streetLabels);
  }
  const updateStreetLabels=()=>{if(map.getZoom()>=14){if(!map.hasLayer(streetLabels))streetLabels.addTo(map)}else if(map.hasLayer(streetLabels))map.removeLayer(streetLabels)};
  map.on('zoomend',updateStreetLabels);updateStreetLabels();
  objects.current=L.layerGroup().addTo(map);position.current=L.layerGroup().addTo(map);
  return()=>{map.remove();mapRef.current=null;objects.current=null;position.current=null};
 },[basemap]);
 useEffect(()=>{
  const group=objects.current;if(!group)return;group.clearLayers();
  for(const b of buildings){
   if(!b.geometry)continue;
   const color=period(b.minYear,b.maxYear)!.color,isSelected=b.id===selected;
   L.geoJSON({type:'Feature',properties:{},geometry:b.geometry as Geometry} as GeoJSON.Feature,{style:{color:isSelected?'#244c3c':'#ffffff',weight:isSelected?3:1.2,fillColor:color,fillOpacity:.92},onEachFeature:(_f,l)=>{l.on('click',e=>{L.DomEvent.stopPropagation(e);selectionRef.current(b.id)});const tip=document.createElement('span');tip.textContent=b.name;l.bindTooltip(tip,{direction:'top',sticky:true})}}).addTo(group);
  }
 },[buildings,selected]);
 useEffect(()=>{if(focus&&mapRef.current){const b=buildings.find(x=>x.id===focus.id);if(b) mapRef.current.flyTo([b.coordinates[1],b.coordinates[0]],17,{duration:.45})}},[focus]);
 useEffect(()=>{if(fit&&mapRef.current&&buildings.length){const bounds=L.latLngBounds(buildings.map(b=>[b.coordinates[1],b.coordinates[0]]));mapRef.current.fitBounds(bounds.pad(.12),{maxZoom:16})}},[fit]);
 useEffect(()=>{if(reset&&mapRef.current)mapRef.current.flyTo([41.715,44.800],11.5,{duration:.45})},[reset]);
 function locate(){
  if(!navigator.geolocation){setLocationMessage('Геолокация недоступна в этом браузере.');return}
  setLocating(true);setLocationMessage('Определяем местоположение…');
  navigator.geolocation.getCurrentPosition(({coords})=>{
   setLocating(false);const point:L.LatLngExpression=[coords.latitude,coords.longitude];const map=mapRef.current,group=position.current;
   if(!map||!group)return;group.clearLayers();
   L.circle(point,{radius:coords.accuracy,color:'#4383b9',weight:1,fillColor:'#4383b9',fillOpacity:.10,interactive:false}).addTo(group);
   L.circleMarker(point,{radius:8,color:'#fff',weight:3,fillColor:'#287ac2',fillOpacity:1,interactive:false}).addTo(group);map.flyTo(point,17,{duration:.45});
   setLocationMessage('Ваше местоположение показано на карте.');
  },err=>{setLocating(false);setLocationMessage(err.code===1?'Доступ к местоположению запрещён.':err.code===3?'Не удалось определить местоположение вовремя.':'Не удалось определить местоположение.')},{enableHighAccuracy:false,timeout:12000,maximumAge:60000});
 }
 return <><div ref={container} className="map-canvas" aria-label="Интерактивная карта архитектурного атласа"/><button className="locate-button" onClick={locate} disabled={locating} title="Моё местоположение" aria-label="Показать моё местоположение"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg></button>{locationMessage&&<div className="location-message" role="status">{locationMessage}<button onClick={()=>setLocationMessage('')} aria-label="Закрыть сообщение">×</button></div>}</>;
}
