/** Pure UI projection: compact, newest-first Concern cards and recent metric history.
 * These functions never change LifeSpace's underlying records or relation edges.
 */
export const CONCERN_PAGE_SIZE=3

export function newestFirst<T extends {id:string}>(items:readonly T[],date:(item:T)=>string):T[]{
  return [...items].sort((a,b)=>date(b).localeCompare(date(a))||a.id.localeCompare(b.id))
}

export function pageOf<T>(items:readonly T[],page:number,pageSize=CONCERN_PAGE_SIZE):T[]{
  return items.slice(Math.max(0,page)*pageSize,(Math.max(0,page)+1)*pageSize)
}

export function pageCount(total:number,pageSize=CONCERN_PAGE_SIZE):number{
  return Math.max(1,Math.ceil(total/pageSize))
}

export function recentMetricIds(
  observations:readonly {metricId:string;observedDate:string}[],
  available:readonly {id:string}[],
  limit=5,
):string[]{
  const ids=new Set(available.map(m=>m.id)),seen=new Set<string>(),out:string[]=[]
  for(const row of newestFirst(observations.map((o,i)=>({...o,id:String(i)})),o=>o.observedDate)){
    if(!ids.has(row.metricId)||seen.has(row.metricId))continue
    seen.add(row.metricId);out.push(row.metricId)
    if(out.length>=limit)break
  }
  return out
}

/** Search is accent/case-insensitive for the local Metric picker; Core still owns IDs. */
export function searchMetrics<T extends {name:string}>(metrics:readonly T[],raw:string):T[]{
  const term=raw.trim().normalize('NFKC').toLocaleLowerCase()
  return metrics.filter(metric=>metric.name.normalize('NFKC').toLocaleLowerCase().includes(term))
}
