/** ALOHA-only body-map presentation projection, not LifeSpace Health Schema.
 * Every HealthConcern has its own explicit point on front OR back.
 * No inferred anatomical region, diagnosis, or clinical severity.
 */
export type BodyView = 'front' | 'back'
export const BODY_MAP_ASSET_ID = 'body-outline-clean-2026-10-v2'
export const BODY_MAP_ASSET_IDS:Readonly<Record<BodyView,string>> = {
  front:BODY_MAP_ASSET_ID,
  back:'body-outline-back-2026-10-v1',
}
export const BODY_MAP_CROP = { x:390, y:40, width:244, height:475 } as const
export interface BodyPoint { x:number; y:number }
export interface SourcePixel { x:number; y:number }
export interface BodyMapBinding {
  concernId:string
  view:BodyView
  assetId:string
  point:BodyPoint
}
export interface BodyMapConcern {id:string;name:string;summary:string;status:string}
export function normalizedPoint(x:number,y:number):BodyPoint {
  return {x:Math.max(0,Math.min(1,x)),y:Math.max(0,Math.min(1,y))}
}
export function sourceToNormalized(point:SourcePixel):BodyPoint {
  return normalizedPoint((point.x-BODY_MAP_CROP.x)/BODY_MAP_CROP.width,
    (point.y-BODY_MAP_CROP.y)/BODY_MAP_CROP.height)
}
export function normalizedToSource(point:BodyPoint):SourcePixel {
  return {x:BODY_MAP_CROP.x+point.x*BODY_MAP_CROP.width,y:BODY_MAP_CROP.y+point.y*BODY_MAP_CROP.height}
}
/** A permissive hit mask for the outline, not an anatomical region classifier. */
function inPolygon(point:SourcePixel,vertices:ReadonlyArray<readonly [number,number]>):boolean {
  let inside=false
  for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
    const [xi,yi]=vertices[i]!,[xj,yj]=vertices[j]!
    if(((yi>point.y)!==(yj>point.y)) && point.x < (xj-xi)*(point.y-yi)/(yj-yi)+xi)
      inside=!inside
  }
  return inside
}
const regionPolygons:ReadonlyArray<ReadonlyArray<readonly [number,number]>>=[
  [[456,142],[492,120],[532,120],[568,142],[576,173],[556,207],[555,303],[468,303],[469,207],[448,173]],
  [[451,149],[471,175],[471,211],[450,280],[446,327],[424,331],[417,305],[434,275],[441,206]],
  [[573,149],[553,175],[553,211],[574,280],[578,327],[600,331],[607,305],[590,275],[583,206]],
  [[468,297],[513,297],[507,366],[502,430],[499,504],[466,504],[478,476],[470,416]],
  [[511,297],[557,297],[554,416],[558,476],[558,504],[525,504],[522,430],[517,366]],
]
export function isPointOnBody(point:BodyPoint):boolean {
  const src=normalizedToSource(point)
  if(((src.x-512)/26)**2+((src.y-88)/37)**2<=1)return true
  return regionPolygons.some(polygon=>inPolygon(src,polygon))
}
export function seedBodyBindings():BodyMapBinding[] {
  // Fully synthetic examples so both front/back discovery flows are testable.
  return [
    {concernId:'c-1',view:'front',assetId:BODY_MAP_ASSET_ID,point:sourceToNormalized({x:512,y:195})},
    {concernId:'c-2',view:'back',assetId:BODY_MAP_ASSET_IDS.back,point:sourceToNormalized({x:536,y:397})},
  ]
}
export function visibleHotspots<T extends BodyMapConcern>(
  concerns:ReadonlyArray<T>, bindings:ReadonlyArray<BodyMapBinding>, view:BodyView,
):Array<{concern:T; point:BodyPoint}> {
  const lookup=new Map(concerns.filter(c=>c.status==='active').map(c=>[c.id,c]))
  return bindings.flatMap(b=>{
    const concern=lookup.get(b.concernId)
    return concern && b.view===view && b.assetId===BODY_MAP_ASSET_IDS[view]
      ? [{concern,point:b.point}] : []
  })
}
export function countForView<T extends BodyMapConcern>(
  concerns:ReadonlyArray<T>,bindings:ReadonlyArray<BodyMapBinding>,view:BodyView,
):number { return visibleHotspots(concerns,bindings,view).length }
export function unmappedConcerns<T extends BodyMapConcern>(
  concerns:ReadonlyArray<T>,bindings:ReadonlyArray<BodyMapBinding>,
):T[] {
  const ids=new Set(bindings.filter(b=>b.assetId===BODY_MAP_ASSET_IDS[b.view]).map(b=>b.concernId))
  return concerns.filter(c=>!ids.has(c.id))
}
export function setConcernPoint(
  bindings:ReadonlyArray<BodyMapBinding>,concernId:string,view:BodyView,point:BodyPoint,
):BodyMapBinding[] {
  // Don't silently clamp out-of-bounds screen coordinates into valid body points.
  if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||point.x<0||point.x>1||point.y<0||point.y>1
    ||!isPointOnBody(point)) throw new Error('请选择人体轮廓内的位置')
  return [...bindings.filter(b=>b.concernId!==concernId),{
    concernId,view,assetId:BODY_MAP_ASSET_IDS[view],point:{...point},
  }]
}
export function removeConcernPoint(bindings:ReadonlyArray<BodyMapBinding>,concernId:string):BodyMapBinding[] {
  return bindings.filter(b=>b.concernId!==concernId)
}
