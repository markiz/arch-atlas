import type {LatLng} from './types';

export type SavedMapView={center:LatLng;zoom:number};

let remembered:SavedMapView|null=null;

/** Remember the current camera so the other map engine can restore it. */
export function rememberMapView(center:LatLng,zoom:number):void{
 remembered={center:{lat:center.lat,lng:center.lng},zoom};
}

/** Last camera used on this page, or null before the first map is shown. */
export function savedMapView():SavedMapView|null{
 return remembered?{center:{...remembered.center},zoom:remembered.zoom}:null;
}
