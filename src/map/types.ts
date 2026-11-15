import type {Building,ManifestFile} from '../types';

export type MapEngine='leaflet'|'canvas';
export type LatLng={lat:number;lng:number};
export type Point={x:number;y:number};
/** Lon/lat bounding box. */
export type BBox={minX:number;minY:number;maxX:number;maxY:number};
/** West/south/east/north bounds in degrees. */
export type Bounds={west:number;south:number;east:number;north:number};

export interface MapViewProps{
 buildings:Building[];
 allBuildings:Building[];
 basemap:GeoJSON.FeatureCollection;
 buildingOutlines:ManifestFile;
 selected:string|null;
 onSelect:(id:string)=>void;
 focus:{id:string;serial:number}|null;
 reset:number;
 fit:number;
 showFit:boolean;
 onFit:()=>void;
 selectedPeriods:string[];
 hoveredPeriod:string|null;
 engine:MapEngine;
 onEngineChange:(engine:MapEngine)=>void;
 onFocusHandled:()=>void;
}
