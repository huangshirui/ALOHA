/** Presentation-only projection. Never average or manufacture observations. */
export interface NumericObservation {
 id:string;observedDate:string;valueNumber:number|null;status:string
}
export interface TrendReading {id:string;date:string;timestamp:number;value:number}
export function dateTimestamp(date:string):number|null {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null
 const t=Date.parse(date+'T00:00:00Z')
 return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===date?t:null
}
export function trendReadings(rows:ReadonlyArray<NumericObservation>):TrendReading[]{
 return rows.flatMap(r=>{
  const timestamp=dateTimestamp(r.observedDate)
  return timestamp===null||r.status==='entered_in_error'||r.valueNumber===null||!Number.isFinite(r.valueNumber)
    ?[]:[{id:r.id,date:r.observedDate,timestamp,value:r.valueNumber}]
 }).sort((a,b)=>a.timestamp-b.timestamp||a.id.localeCompare(b.id))
}
export function referenceBounds(low?:number|null,high?:number|null){
 const l=typeof low==='number'&&Number.isFinite(low)?low:undefined
 const h=typeof high==='number'&&Number.isFinite(high)?high:undefined
 return l!==undefined&&h!==undefined&&l>h?{}:{low:l,high:h}
}
export function trendDomain(readings:ReadonlyArray<TrendReading>,start?:string,end?:string){
 if(!readings.length)return undefined
 const first=readings[0]!.timestamp,last=readings[readings.length-1]!.timestamp
 const from=start?dateTimestamp(start):null,to=end?dateTimestamp(end):null
 const min=from===null?first:Math.min(first,from),max=to===null?last:Math.max(last,to)
 return min===max?{min:min-86400000,max:max+86400000}:{min,max}
}
export function formatTrendValue(value:number){
 return value.toLocaleString('zh-CN',{maximumFractionDigits:8})
}
