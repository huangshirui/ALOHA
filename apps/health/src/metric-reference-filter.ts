import {compareReference, type ReferenceMetric, type ReferenceObservation} from './health-reference'

export type MetricReferenceFilter='all'|'within'|'outside'|'unknown'
export type MetricReferenceState=Exclude<MetricReferenceFilter,'all'>
/** A missing applicable range is unclassified, not automatically normal. */
export function metricReferenceState(metric:ReferenceMetric,reading?:ReferenceObservation|null):MetricReferenceState {
 if(!reading)return 'unknown'
 const comparison=compareReference(metric,reading).comparison
 if(!comparison)return 'unknown'
 return comparison.position==='within'?'within':'outside'
}
export function matchMetricReferenceFilter(state:MetricReferenceState,filter:MetricReferenceFilter):boolean{
 return filter==='all'||state===filter
}
