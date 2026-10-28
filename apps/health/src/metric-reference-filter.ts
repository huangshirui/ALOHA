import {compareReference, type ReferenceMetric, type ReferenceObservation} from './health-reference'

export type MetricReferenceFilter='all'|'within'|'outside'|'unknown'
export type MetricReferenceState=Exclude<MetricReferenceFilter,'all'>
export interface MetricReading extends ReferenceObservation {id:string;observedDate:string}
export interface ReferenceMetricWithId extends ReferenceMetric {id:string;name:string}

/** Latest usable recorded fact only. No conclusion without an applicable source range. */
export function latestMetricReading(rows:ReadonlyArray<MetricReading>,metricId:string,belongsTo:(row:MetricReading)=>boolean):MetricReading|null {
 const filtered=rows.filter(row=>belongsTo(row)&&row.status!=='entered_in_error')
 return filtered.slice().sort((a,b)=>b.observedDate.localeCompare(a.observedDate))[0]??null
}
export function metricReferenceState(metric:ReferenceMetric,reading?:ReferenceObservation|null):MetricReferenceState {
 if(!reading)return 'unknown'
 const comparison=compareReference(metric,reading).comparison
 if(!comparison)return 'unknown'
 return comparison.position==='within'?'within':'outside'
}
export function matchMetricReferenceFilter(state:MetricReferenceState,filter:MetricReferenceFilter):boolean{
 return filter==='all'||state===filter
}
