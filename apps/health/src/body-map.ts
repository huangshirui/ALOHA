/**
 * ALOHA-only BodyMap asset/coordinate projection. Not part of LifeSpace
 * HealthConcern schemas or a health diagnosis.
 *
 * Coordinates are normalized [0,1] positions on the (cropped) front artwork,
 * never page pixels. Changing artwork requires a new assetId and point map.
 */
export const BODY_MAP_ASSET_ID = 'body-outline-clean-2026-10-v2'
/** The uploaded 1024×559 geometry is untouched. Only white margins are cropped. */
export const BODY_MAP_CROP = { x:390, y:40, width:244, height:475 } as const
export interface SourcePixel {x:number;y:number}
/** For one image and its interaction layer, both use this exact cropped viewBox. */
export function sourceToNormalized(point:SourcePixel):BodyPoint {
  return normalizedPoint((point.x-BODY_MAP_CROP.x)/BODY_MAP_CROP.width,
    (point.y-BODY_MAP_CROP.y)/BODY_MAP_CROP.height)
}
export function normalizedToSource(point:BodyPoint):SourcePixel {
  return {x:BODY_MAP_CROP.x+point.x*BODY_MAP_CROP.width,
    y:BODY_MAP_CROP.y+point.y*BODY_MAP_CROP.height}
}
export type BodyRegionId = 'head' | 'chest' | 'abdomen' | 'arms' | 'legs'
export interface BodyPoint { x: number; y: number }
export interface BodyMapRegion {
  id: BodyRegionId
  label: string
  anchor: BodyPoint
  hint: string
}
export interface BodyMapBinding {
  concernId: string
  regionId: BodyRegionId
  assetId?: string
  /** User-placed point; absent means the region's default anchor. */
  point?: BodyPoint
}
export interface BodyMapConcern {
  id: string
  name: string
  summary: string
  status: string
}

/** Seed anchors are layout hints on this artwork, not anatomical inference. */
export const bodyRegions: ReadonlyArray<BodyMapRegion> = [
  { id:'head', label:'头颈', anchor:sourceToNormalized({x:512,y:88}), hint:'头部及颈部' },
  { id:'chest', label:'胸部', anchor:sourceToNormalized({x:512,y:192}), hint:'胸部与循环相关' },
  { id:'abdomen', label:'腹部', anchor:sourceToNormalized({x:512,y:269}), hint:'腹部相关' },
  { id:'arms', label:'上肢', anchor:sourceToNormalized({x:446,y:254}), hint:'手臂及肩部' },
  { id:'legs', label:'下肢', anchor:sourceToNormalized({x:538,y:398}), hint:'下肢及运动恢复' },
]

export function normalizedPoint(x:number,y:number):BodyPoint {
  return {
    x:Math.max(0,Math.min(1,x)),
    y:Math.max(0,Math.min(1,y)),
  }
}
/**
 * A simple hit mask for placing a point. This is intentionally conservative,
 * only to reject background clicks; NOT an anatomical segmentation model.
 */
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

export function resolvePoint(binding:BodyMapBinding):BodyPoint {
  if(binding.point && binding.assetId===BODY_MAP_ASSET_ID)
    return normalizedPoint(binding.point.x,binding.point.y)
  return bodyRegions.find(region=>region.id===binding.regionId)?.anchor ?? {x:.5,y:.5}
}
export function closestRegion(point:BodyPoint):BodyRegionId {
  const src=normalizedToSource(point)
  if(((src.x-512)/26)**2+((src.y-88)/37)**2<=1) return 'head'
  // Region selection uses the simple silhouette hit zones, never health inference.
  if(inPolygon(src,regionPolygons[1]!)||inPolygon(src,regionPolygons[2]!)) return 'arms'
  if(inPolygon(src,regionPolygons[3]!)||inPolygon(src,regionPolygons[4]!)) return 'legs'
  if(inPolygon(src,regionPolygons[0]!)) return src.y < 224 ? 'chest' : 'abdomen'
  return [...bodyRegions].sort((a,b)=>{
    const distance=(r:BodyMapRegion)=>
      Math.pow(r.anchor.x-point.x,2)+Math.pow(r.anchor.y-point.y,2)
    return distance(a)-distance(b)
  })[0]!.id
}

/** Prototype-only illustrative associations: no real-user medical data. */
export function seedBodyBindings():BodyMapBinding[] {
  return [
    { concernId:'c-1', regionId:'chest' },
    { concernId:'c-2', regionId:'legs' },
  ]
}
export function concernsForRegion<T extends BodyMapConcern>(
  concerns:ReadonlyArray<T>, bindings:ReadonlyArray<BodyMapBinding>,regionId:BodyRegionId,
):T[] {
  const ids=new Set(bindings.filter(b=>b.regionId===regionId).map(b=>b.concernId))
  return concerns.filter(c=>ids.has(c.id))
}
export function unmappedConcerns<T extends BodyMapConcern>(
  concerns:ReadonlyArray<T>,bindings:ReadonlyArray<BodyMapBinding>,
):T[] {
  const ids=new Set(bindings.map(b=>b.concernId))
  return concerns.filter(c=>!ids.has(c.id))
}
export function setConcernRegion(
  bindings:ReadonlyArray<BodyMapBinding>,concernId:string,regionId:BodyRegionId|'',
):BodyMapBinding[] {
  const next=bindings.filter(b=>b.concernId!==concernId)
  if(regionId) next.push({concernId,regionId})
  return next
}
/** Explicit point binding keeps a stable coordinate on the selected asset. */
export function setConcernPoint(
  bindings:ReadonlyArray<BodyMapBinding>,concernId:string,point:BodyPoint,
):BodyMapBinding[] {
  const normalized=normalizedPoint(point.x,point.y)
  if(!isPointOnBody(normalized)) throw new Error('Please select a location inside the body outline.')
  return [...bindings.filter(b=>b.concernId!==concernId),{
    concernId, regionId:closestRegion(normalized),assetId:BODY_MAP_ASSET_ID,point:normalized,
  }]
}
/** One small hotspot per concerned region; multiple concerns use right-side list. */
export interface BodyHotspot {regionId:BodyRegionId;count:number;point:BodyPoint}
export function concernHotspots<T extends BodyMapConcern>(
  concerns:ReadonlyArray<T>,bindings:ReadonlyArray<BodyMapBinding>,
):BodyHotspot[] {
  const active=new Set(concerns.filter(c=>c.status==='active').map(c=>c.id))
  return bodyRegions.flatMap(region=>{
    const matched=bindings.filter(b=>active.has(b.concernId)&&b.regionId===region.id)
    if(!matched.length)return []
    const points=matched.map(resolvePoint)
    return [{
      regionId:region.id,count:matched.length,
      point:normalizedPoint(
        points.reduce((sum,p)=>sum+p.x,0)/points.length,
        points.reduce((sum,p)=>sum+p.y,0)/points.length,
      ),
    }]
  })
}
