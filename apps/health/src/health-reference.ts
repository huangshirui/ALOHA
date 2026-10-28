/** Reference ranges compare values, not diagnoses.
 * Original report interpretations belong to the linked HealthDocument.
 */
export interface ReferenceBounds {
  referenceLow?:number|null
  referenceHigh?:number|null
  referenceSource?:string
}
export interface ReferenceMetric extends ReferenceBounds {defaultUnit:string;valueType:string}
export interface ReferenceObservation extends ReferenceBounds {
  valueNumber:number|null
  unit:string
}
export type ReferencePosition='below'|'within'|'above'
export type ReferenceComparison={
  position:ReferencePosition
  label:string
  range:ReferenceBounds
  source:'observation'|'metric'
  unit:string
  sourceNote:string
}
export type ReferenceResult={
  comparison:ReferenceComparison|null
  reason:'no_range'|'non_numeric'|'unit_mismatch'|'invalid_range'|null
}
const exists=(v:unknown):v is number=>typeof v==='number' && Number.isFinite(v)
const hasBounds=(r:ReferenceBounds)=>exists(r.referenceLow)||exists(r.referenceHigh)
export function validateReferenceDraft(
  rawLow:unknown,rawHigh:unknown,source:unknown,valueType:'number'|'text'|'boolean'='number',
):string|null{
  const low=String(rawLow??'').trim(), high=String(rawHigh??'').trim()
  if(valueType!=='number' && (low||high||String(source??'').trim()))return '只有数值型指标才能设置参考范围'
  if((low && !Number.isFinite(Number(low)))||(high && !Number.isFinite(Number(high))))return '参考上下限需要填写有效数值'
  if(low && high && Number(low)>Number(high))return '参考下限不能高于上限'
  if(!low && !high && String(source??'').trim())return '请先填写至少一项参考边界'
  return null
}
export function parseReferenceDraft(rawLow:unknown,rawHigh:unknown,source:unknown):Required<ReferenceBounds>{
 const strLow=String(rawLow??'').trim(),strHigh=String(rawHigh??'').trim()
 return {referenceLow:strLow?Number(strLow):null,referenceHigh:strHigh?Number(strHigh):null,referenceSource:String(source??'').trim()}
}
/** Observation-level bounds replace the entire default interval, even when one-sided. */
export function chooseReferenceRange(
  metric:ReferenceMetric,observation?:ReferenceObservation,
):{range:ReferenceBounds;source:'observation'|'metric';unit:string}|null {
  if(metric.valueType!=='number')return null
  if(observation && hasBounds(observation)){
    const unit=observation.unit.trim()||metric.defaultUnit.trim()
    return {range:observation,source:'observation',unit}
  }
  if(hasBounds(metric)){
    const metricUnit=metric.defaultUnit.trim()
    if(observation && metricUnit !== (observation.unit.trim()||metricUnit))return null
    return {range:metric,source:'metric',unit:metricUnit}
  }
  return null
}
export function compareReference(
  metric:ReferenceMetric,obs:ReferenceObservation,
):ReferenceResult {
  if(!exists(obs.valueNumber)||metric.valueType!=='number')return {comparison:null,reason:'non_numeric'}
  const selected=chooseReferenceRange(metric,obs)
  if(!selected){
    return {comparison:null,reason:hasBounds(metric)&&metric.defaultUnit.trim()!==(obs.unit.trim()||metric.defaultUnit.trim())?'unit_mismatch':'no_range'}
  }
  const {range,source,unit}=selected
  if(exists(range.referenceLow)&&exists(range.referenceHigh)&&range.referenceLow>range.referenceHigh)
    return {comparison:null,reason:'invalid_range'}
  let position:ReferencePosition='within'
  if(exists(range.referenceLow)&&obs.valueNumber<range.referenceLow)position='below'
  else if(exists(range.referenceHigh)&&obs.valueNumber>range.referenceHigh)position='above'
  return {comparison:{
    position,label:position==='below'?'低于参考范围':position==='above'?'高于参考范围':'在参考范围内',
    range,source,unit,sourceNote:range.referenceSource?.trim()||'来源未注明',
  },reason:null}
}
export function formatReferenceRange(range:ReferenceBounds,unit:string):string {
 const low=exists(range.referenceLow)?String(range.referenceLow):null
 const high=exists(range.referenceHigh)?String(range.referenceHigh):null
 const suffix=unit?' '+unit:''
 if(low!==null&&high!==null)return low+'–'+high+suffix
 if(low!==null)return '≥ '+low+suffix
 if(high!==null)return '≤ '+high+suffix
 return '未设置'
}
