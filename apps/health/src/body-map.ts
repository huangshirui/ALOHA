/**
 * ALOHA-only BodyMap asset/coordinate projection. Not part of LifeSpace
 * HealthConcern schemas or a health diagnosis.
 *
 * Coordinates are normalized [0,1] positions on the (cropped) front artwork,
 * never page pixels. Changing artwork requires a new assetId and point map.
 */
export const BODY_MAP_ASSET_ID = 'front-outline-v1'
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
  { id:'head', label:'头颈', anchor:{x:.5,y:.135}, hint:'头部及颈部' },
  { id:'chest', label:'胸部', anchor:{x:.5,y:.365}, hint:'胸部与循环相关' },
  { id:'abdomen', label:'腹部', anchor:{x:.5,y:.53}, hint:'腹部相关' },
  { id:'arms', label:'上肢', anchor:{x:.245,y:.49}, hint:'手臂及肩部' },
  { id:'legs', label:'下肢', anchor:{x:.58,y:.79}, hint:'下肢及运动恢复' },
]

export function normalizedPoint(x:number,y:number):BodyPoint {
  return {
    x:Math.max(0,Math.min(1,x)),
    y:Math.max(0,Math.min(1,y)),
  }
}
export function resolvePoint(binding:BodyMapBinding):BodyPoint {
  if(binding.point && binding.assetId===BODY_MAP_ASSET_ID)
    return normalizedPoint(binding.point.x,binding.point.y)
  return bodyRegions.find(region=>region.id===binding.regionId)?.anchor ?? {x:.5,y:.5}
}
export function closestRegion(point:BodyPoint):BodyRegionId {
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
