import type {Observation} from './demo-model'
type LoadState='idle'|'loading'|'ready'|'error'
/** One pass, preserving the existing first-observation tie break. */
export function latestObservationIndex(observations:readonly Observation[]):Map<string,Observation>{
  const result=new Map<string,Observation>()
  for(const observation of observations){
    const previous=result.get(observation.metricId)
    if(!previous||observation.observedDate.localeCompare(previous.observedDate)>0)result.set(observation.metricId,observation)
  }
  return result
}
/** An empty relation is only meaningful after both dependencies succeed. */
export function concernContentState(live:boolean,records:LoadState,relations:LoadState):'loading'|'ready'|'error'{
  if(!live)return 'ready'
  if(records==='error'||relations==='error')return 'error'
  return records==='ready'&&relations==='ready'?'ready':'loading'
}
