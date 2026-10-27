/**
 * Body map is an ALOHA-side presentation projection, not a LifeSpace model.
 * Bindings point at HealthConcern records without changing their canonical schema.
 * Only synthetic prototype mappings are included in this public repository.
 */
export type BodyRegionId = 'head' | 'chest' | 'abdomen' | 'arms' | 'legs'
export interface BodyMapRegion {
  id: BodyRegionId
  label: string
  markerX: number
  markerY: number
  hint: string
}
export interface BodyMapBinding {
  concernId: string
  regionId: BodyRegionId
}
export interface BodyMapConcern {
  id: string
  name: string
  summary: string
  status: string
}

export const bodyRegions: ReadonlyArray<BodyMapRegion> = [
  { id:'head', label:'头颈', markerX:50, markerY:14, hint:'头部及颈部' },
  { id:'chest', label:'胸部', markerX:50, markerY:36, hint:'胸部与循环相关' },
  { id:'abdomen', label:'腹部', markerX:50, markerY:52, hint:'腹部相关' },
  { id:'arms', label:'上肢', markerX:18, markerY:45, hint:'手臂及肩部' },
  { id:'legs', label:'下肢', markerX:61, markerY:79, hint:'下肢及运动恢复' },
]

/** Prototype-only illustrative associations, never medical inference. */
export function seedBodyBindings(): BodyMapBinding[] {
  return [
    { concernId:'c-1', regionId:'chest' },
    { concernId:'c-2', regionId:'legs' },
  ]
}
export function concernsForRegion<T extends BodyMapConcern>(
  concerns: ReadonlyArray<T>, bindings: ReadonlyArray<BodyMapBinding>, regionId:BodyRegionId
):T[] {
  const ids=new Set(bindings.filter(binding=>binding.regionId===regionId).map(binding=>binding.concernId))
  return concerns.filter(c=>ids.has(c.id))
}
export function unmappedConcerns<T extends BodyMapConcern>(
  concerns: ReadonlyArray<T>, bindings: ReadonlyArray<BodyMapBinding>
):T[] {
  const ids=new Set(bindings.map(binding=>binding.concernId))
  return concerns.filter(c=>!ids.has(c.id))
}
export function setConcernRegion(bindings:BodyMapBinding[], concernId:string, regionId:BodyRegionId|'') {
  const next=bindings.filter(binding=>binding.concernId!==concernId)
  if(regionId) next.push({concernId,regionId})
  return next
}
