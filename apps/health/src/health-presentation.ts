/**
 * ALOHA-owned Health presentation state, deliberately separate from LifeSpace HealthConcern.
 * Coordinates are normalized to the versioned body artwork; attention is a user preference,
 * never clinical severity. Storage is scoped to the verified User + Space + Person + Concern.
 */
import { BODY_MAP_ASSET_IDS, isPointOnBody, type BodyMapBinding, type BodyView } from './body-map'
import { concernAttentionOptions, type ConcernAttention } from './concern-attention'

export interface ConcernPresentation {
  concernId:string
  attention:ConcernAttention
  placement:BodyMapBinding|null
}
export interface PresentationPatch {
  attention?:ConcernAttention
  placement?:BodyMapBinding|null
}
export interface PresentationScope {
  spaceId:string
  personId:string
  userId:string
}
export type PresentationRow = {
  concern_id:string;attention:string;view:string|null;asset_id:string|null
  x:number|null;y:number|null
}
const isObject=(value:unknown):value is Record<string,unknown>=>
  value!==null && typeof value==='object' && !Array.isArray(value)
const levels=new Set<string>(concernAttentionOptions.map(option=>option.value))
const keys=(value:Record<string,unknown>,allowed:string[]) =>
  Object.keys(value).every(key=>allowed.includes(key))

/** Validation mirrors BodyOverview's input boundary. Invalid points never enter private presentation storage. */
export function parsePresentationPatch(value:unknown,concernId:string):PresentationPatch {
  if(!isObject(value) || !keys(value,['attention','placement']) || !Object.keys(value).length)
    throw new Error('展示设置格式不正确')
  const patch:PresentationPatch={}
  if(Object.hasOwn(value,'attention')) {
    if(typeof value.attention!=='string' || !levels.has(value.attention))
      throw new Error('关注度不正确')
    patch.attention=value.attention as ConcernAttention
  }
  if(Object.hasOwn(value,'placement')) {
    if(value.placement===null) patch.placement=null
    else {
      const placement=value.placement
      if(!isObject(placement)||!keys(placement,['view','assetId','point','concernId'])||
        (placement.concernId!==undefined && placement.concernId!==concernId)||
        !isObject(placement.point)||!keys(placement.point,['x','y']))
        throw new Error('人体定位格式不正确')
      const view=placement.view
      const assetId=placement.assetId
      const x=placement.point.x,y=placement.point.y
      if((view!=='front'&&view!=='back') || assetId!==BODY_MAP_ASSET_IDS[view as BodyView] ||
        typeof x!=='number'||typeof y!=='number'||!Number.isFinite(x)||!Number.isFinite(y)||
        x<0||x>1||y<0||y>1||!isPointOnBody({x,y}))
        throw new Error('人体定位不在当前轮廓内')
      patch.placement={concernId,view,assetId,point:{x,y}}
    }
  }
  return patch
}
export function presentationFromRow(row:PresentationRow):ConcernPresentation {
  const view=row.view
  const placement:BodyMapBinding|null=view==='front'||view==='back'
    ? row.asset_id===BODY_MAP_ASSET_IDS[view] && typeof row.x==='number' &&
      typeof row.y==='number' && Number.isFinite(row.x) && Number.isFinite(row.y) &&
      row.x>=0&&row.x<=1&&row.y>=0&&row.y<=1
      ? {concernId:row.concern_id,view,assetId:row.asset_id,point:{x:row.x,y:row.y}}
      : null
    : null
  return {concernId:row.concern_id,
    attention:levels.has(row.attention)?row.attention as ConcernAttention:'unset',
    placement}
}
