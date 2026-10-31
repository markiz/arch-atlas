import type { GeoJsonObject, Geometry } from 'geojson';
export interface Photo {file:string; author:string; license:string; licenseUrl:string; source:string; modifications:string; description?:string}
export interface Building {id:string;name:string;nameKa:string;nameEn:string;address:string;district:string;minYear:number|null;maxYear:number|null;yearLabel:string;architects:string[];style:string;description:string;history:string;coordinates:[number,number];photo?:Photo;photos?:Photo[];source:string;otherSource?:string;googlePlaceId?:string;geometry?:Geometry|null;geometryQuality:string;osmId?:string;}
export interface Data {buildings:Building[];basemap:GeoJsonObject;photos:Record<string,string[]>}
export interface Filters {query:string;from:string;to:string;architect:string;style:string}
