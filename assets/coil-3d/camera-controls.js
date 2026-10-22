export const MIN_ZOOM=.5,MAX_ZOOM=100;
// Front orthographic view: look along -Z, with the apparatus axis vertical.
export const DEFAULT_AZIMUTH=0,DEFAULT_POLAR=Math.PI/2;

export function orbitByPixels(state,dx,dy,width,height){
  if(![dx,dy,width,height].every(Number.isFinite)||width<=0||height<=0)return {...state};
  // Periodic normalization, not a clamp: either axis can turn indefinitely.
  const tau=2*Math.PI,wrap=angle=>((angle%tau)+tau)%tau;
  return {azimuth:wrap(state.azimuth-tau*dx/width),polar:wrap(state.polar-tau*dy/height)};
}

export function orbitFrame({azimuth,polar}){
  const sa=Math.sin(azimuth),ca=Math.cos(azimuth),sp=Math.sin(polar),cp=Math.cos(polar);
  // Rotate the camera's up vector too. It remains perpendicular to the view
  // through both poles, avoiding lookAt's singularity and a 180-degree flip.
  return {direction:[sp*sa,cp,sp*ca],up:[-cp*sa,sp,-cp*ca]};
}

export function wheelZoom(current,delta,mode=0,height=600){
  if(!Number.isFinite(delta))return current;
  const pixels=delta*(mode===1?16:mode===2?Math.max(1,height):1);
  return Math.min(MAX_ZOOM,Math.max(MIN_ZOOM,current*Math.exp(-Math.min(240,Math.max(-240,pixels))*.0018)));
}

// Pan is in units of the fitted camera's half width/height. This keeps the same
// normalized location when the viewport or model dimensions change.
export function zoomAtPoint(state,target,x=0,y=0){
  if(!Number.isFinite(target))return {...state};
  const zoom=Math.min(MAX_ZOOM,Math.max(MIN_ZOOM,target));
  return {zoom,x:state.x+x*(1/state.zoom-1/zoom),y:state.y+y*(1/state.zoom-1/zoom)};
}

export function panByPixels(state,dx,dy,width,height){
  if(![dx,dy,width,height].every(Number.isFinite)||width<=0||height<=0)return {...state};
  return {...state,x:state.x-2*dx/(width*state.zoom),y:state.y+2*dy/(height*state.zoom)};
}
