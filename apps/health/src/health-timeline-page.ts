import type {TimelineEntry,TimelineFilter,TimelineKind} from './health-timeline'
export type TimelineStream={kind:TimelineKind;started:boolean;cursor:string|null;buffer:TimelineEntry[]}
export type TimelineRead=(kind:TimelineKind,cursor:string|null)=>Promise<{items:TimelineEntry[];nextCursor:string|null}>
export const newTimelineStreams=(filter:TimelineFilter):TimelineStream[]=>
  (['observation','event','assessment'] as const).filter(kind=>filter==='all'||kind===filter)
    .map(kind=>({kind,started:false,cursor:null,buffer:[]}))
export const timelineHasMore=(streams:TimelineStream[])=>streams.some(s=>!s.started||s.buffer.length>0||s.cursor!==null)
/** Merge date-descending streams without advancing an opaque cursor past unconsumed rows.
 * A failed request never mutates the caller's continuation. Search scans a bounded
 * number of chronological candidates; exhaustion is distinct from zero matches.
 */
export async function mergeTimelinePage(previous:TimelineStream[],read:TimelineRead,term:string,seen:ReadonlySet<string>,limit=30,scanLimit=120){
  const streams=previous.map(s=>({...s,buffer:[...s.buffer]}))
  const items:TimelineEntry[]=[]
  const used=new Set(seen)
  let scanned=0,reads=0
  while(items.length<limit&&scanned<scanLimit){
    const needed=streams.filter(s=>!s.buffer.length&&(!s.started||s.cursor!==null))
    if(reads+needed.length>12)break
    reads+=needed.length
    await Promise.all(needed.map(async s=>{
      const old=s.cursor,result=await read(s.kind,old)
      if(!Array.isArray(result.items)||result.items.some(e=>e.kind!==s.kind)||
        result.nextCursor!==null&&(typeof result.nextCursor!=='string'||!result.nextCursor||result.nextCursor===old)||
        result.items.some((e,i)=>i>0&&e.date>result.items[i-1]!.date))throw Error('时间线分页响应无效')
      s.started=true;s.cursor=result.nextCursor;s.buffer=result.items
    }))
    // Empty pages with continuations are legal; don't emit older records until
    // the missing stream has a known head.
    if(streams.some(s=>!s.buffer.length&&s.cursor!==null))continue
    let best:TimelineStream|undefined
    for(const stream of streams)if(stream.buffer.length&&(!best||stream.buffer[0]!.date>best.buffer[0]!.date))best=stream
    if(!best)break
    const entry=best.buffer.shift()!;scanned++
    const key=entry.kind+':'+entry.id
    if(used.has(key))continue
    used.add(key)
    if(!term||entry.title.includes(term)||entry.meta.includes(term))items.push(entry)
  }
  return {items,streams,hasMore:timelineHasMore(streams),scanned}
}
