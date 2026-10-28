/** ALOHA Health trend: chart-only projection over real numeric observations.
 * Missing days/months/years are connected visually, never manufactured.
 */
export type MetricGranularity='day'|'month'|'year'
export const TREND_CHART_HEIGHT=320
export const TREND_CHART_LEFT=64
export const TREND_CHART_RIGHT_PADDING=22
export const TREND_CHART_Y_LABEL_X=54
export const TREND_CHART_X_LABEL_Y=305
export interface ReferenceMarkers {
  referenceLow?:number|null
  referenceHigh?:number|null
}
export interface ReferenceLine {
  side:'low'|'high'
  value:number
  y:number
  label:string
}
/** Reference limits are visual guides, not extra observation points. */
export function projectReferenceLines(
  domain:{min:number;max:number}|null,bounds:ReferenceMarkers,height=TREND_CHART_HEIGHT,
):ReferenceLine[] {
  if(!domain || domain.max<=domain.min)return []
  const low=bounds.referenceLow,high=bounds.referenceHigh
  const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)
  if(finite(low)&&finite(high)&&low>high)return []
  const bottom=height-46,top=26
  const yFor=(v:number)=>Number((bottom-(v-domain.min)/(domain.max-domain.min)*(bottom-top)).toFixed(2))
  const result:ReferenceLine[]=[]
  if(finite(low))result.push({side:'low',value:low,y:yFor(low),label:finite(high)&&low===high?'参考值':'下限'})
  if(finite(high)&&(!finite(low)||low!==high))result.push({side:'high',value:high,y:yFor(high),label:'上限'})
  return result
}
export interface NumericObservation {
 id:string;observedDate:string;valueNumber:number|null;status:string
}
export interface TrendPoint {
 key:string; label:string; value:number; count:number; recordIds:string[]
}
export interface ChartPoint extends TrendPoint {x:number;y:number}
/** No automatic selection: the hero already gives the latest value. */
export function selectedTrendPoint<T extends {key:string}>(points:ReadonlyArray<T>,key:string):T|null {
 return key ? (points.find(p=>p.key===key)??null) : null
}
export interface TrendChart {
 points:ChartPoint[]
 path:string
 ticks:{key:string;label:string;x:number}[]
 yTicks:{value:number;y:number;label:string}[]
 domain:{min:number;max:number}|null
}
const DATE=/^(\d{4})-(\d{2})-(\d{2})$/
const valid=(str:string)=>{
 const m=DATE.exec(str);if(!m)return false
 const y=+m[1]!,mo=+m[2]!,d=+m[3]!
 const date=new Date(Date.UTC(y,mo-1,d))
 return date.getUTCFullYear()===y && date.getUTCMonth()===mo-1 && date.getUTCDate()===d
}
function keyFor(date:string,g:MetricGranularity){
 return g==='year'?date.slice(0,4):g==='month'?date.slice(0,7):date
}
function labelFor(key:string,g:MetricGranularity) {
 if(g==='year')return key+'年'
 if(g==='month')return Number(key.slice(5))+'月'
 return Number(key.slice(5,7))+'/'+Number(key.slice(8))
}
export function aggregateTrend(rows:ReadonlyArray<NumericObservation>,g:MetricGranularity):TrendPoint[] {
 const map=new Map<string,{values:number[];ids:string[]}>()
 for(const r of rows){
  if(!valid(r.observedDate)||r.status==='entered_in_error'||r.valueNumber===null||!Number.isFinite(r.valueNumber))continue
  const key=keyFor(r.observedDate,g)
  let bag=map.get(key);if(!bag){bag={values:[],ids:[]};map.set(key,bag)}
  bag.values.push(r.valueNumber);bag.ids.push(r.id)
 }
 return [...map.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([key,bag])=>({
  key,label:labelFor(key,g),value:bag.values.reduce((a,b)=>a+b,0)/bag.values.length,
  count:bag.values.length,recordIds:bag.ids,
 }))
}
function timeIndex(key:string,g:MetricGranularity):number {
 const year=Number(key.slice(0,4))
 if(g==='year')return year
 const month=Number(key.slice(5,7))-1
 if(g==='month')return year*12+month
 return Date.UTC(year,month,Number(key.slice(8)))/86400000
}
const round=(n:number)=>Number(n.toFixed(2))
const tickLabel=(v:number)=>Number(v.toFixed(2)).toLocaleString('en-US',{maximumFractionDigits:2})
/** A non-overshooting, C1-smooth segment. Control points are horizontal at
 * observations; empty calendar slots are NOT added to chart points.
 */
export function smoothPath(points:ReadonlyArray<{x:number;y:number}>):string {
 if(!points.length)return ''
 let path=`M ${round(points[0]!.x)} ${round(points[0]!.y)}`
 for(let i=1;i<points.length;i++){
  const a=points[i-1]!,b=points[i]!,dx=b.x-a.x
  path+=` C ${round(a.x+dx/3)} ${round(a.y)}, ${round(b.x-dx/3)} ${round(b.y)}, ${round(b.x)} ${round(b.y)}`
 }
 return path
}
export function buildTrendChart(raw:ReadonlyArray<NumericObservation>,g:MetricGranularity,width=680,height=TREND_CHART_HEIGHT,reference?:ReferenceMarkers):TrendChart{
 const aggregate=aggregateTrend(raw,g)
 if(!aggregate.length)return {points:[],path:'',ticks:[],yTicks:[],domain:null}
 const left=TREND_CHART_LEFT,right=width-TREND_CHART_RIGHT_PADDING,top=26,bottom=height-46
 const observed=aggregate.map(p=>p.value)
 const low=reference?.referenceLow,high=reference?.referenceHigh
 const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)
 // Extend the axis to display real configured thresholds. These values are
 // scale guides only, never treated as HealthObservation or chart points.
 const bounds=valid(low)&&valid(high)&&low>high?[]:[low,high].filter(valid)
 const values=[...observed,...bounds]
 const vmin=Math.min(...values),vmax=Math.max(...values)
 const padding=(vmax-vmin||Math.max(1,Math.abs(vmax)*.06))*.15
 const min=vmin-padding,max=vmax+padding
 const time=aggregate.map(p=>timeIndex(p.key,g))
 const first=time[0]!,last=time[time.length-1]!
 const xFor=(v:number)=>first===last?(left+right)/2:left+(v-first)/(last-first)*(right-left)
 const yFor=(v:number)=>bottom-(v-min)/(max-min)*(bottom-top)
 const points=aggregate.map((p,i)=>({...p,x:round(xFor(time[i]!)),y:round(yFor(p.value))}))
 const maxTicks=width<440?3:width<620?4:5
 const tickPositions=aggregate.length<=maxTicks?aggregate.map((p,i)=>i):
  Array.from(new Set(Array.from({length:maxTicks},(_,i)=>Math.round(i*(aggregate.length-1)/(maxTicks-1)))))
 const ticks=tickPositions.map(i=>({key:points[i]!.key,label:points[i]!.label,x:points[i]!.x}))
 const yTicks=Array.from({length:3},(_,i)=>{const value=min+(max-min)*i/2;return {value,y:round(yFor(value)),label:tickLabel(value)}})
 return {points,path:smoothPath(points),ticks,yTicks,domain:{min,max}}
}
