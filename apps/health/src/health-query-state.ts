/** Health-local session projection cache. Cache freshness never grants authority. */
export const HEALTH_STALE_MS=120_000
export const HEALTH_GC_MS=900_000
export const HEALTH_REFRESH_PAGES=6
export type QueryTag='concern'|'metric'|'observation'|'event'|'document'|'regimen'|'assessment'|'relation'|'presentation'
export type QueryKey=readonly (string|number|null)[]
export type QueryHit<T>={data:T;fresh:boolean;updatedAt:number}
type Entry={data:unknown;updatedAt:number;touchedAt:number;invalidated:boolean;tags:readonly QueryTag[];weight:number}
/** Queries own result membership and cursor chains, independent of the entity pool. */
export class HealthQueryState {
  private entries=new Map<string,Entry>()
  constructor(private maxEntries=40,private maxWeight=12_000){}
  get<T>(key:QueryKey,now=Date.now()):QueryHit<T>|undefined{
    const id=JSON.stringify(key),entry=this.entries.get(id)
    if(!entry)return
    this.entries.delete(id)
    if(now-entry.touchedAt>=HEALTH_GC_MS)return
    entry.touchedAt=now;this.entries.set(id,entry)
    return {data:entry.data as T,fresh:!entry.invalidated&&now-entry.updatedAt<HEALTH_STALE_MS,updatedAt:entry.updatedAt}
  }
  set<T>(key:QueryKey,data:T,tags:readonly QueryTag[],weight=1,now=Date.now(),updatedAt=now){
    const id=JSON.stringify(key)
    this.entries.delete(id)
    this.entries.set(id,{data,tags,weight:Math.max(1,weight),updatedAt,touchedAt:now,invalidated:false})
    let total=[...this.entries.values()].reduce((sum,e)=>sum+e.weight,0)
    while(this.entries.size>1&&(this.entries.size>this.maxEntries||total>this.maxWeight)){
      const first=this.entries.keys().next().value!
      total-=this.entries.get(first)!.weight;this.entries.delete(first)
    }
  }
  invalidate(...tags:QueryTag[]){
    for(const entry of this.entries.values())if(entry.tags.some(tag=>tags.includes(tag)))entry.invalidated=true
  }
  invalidateAll(){for(const entry of this.entries.values())entry.invalidated=true}
  remove(key:QueryKey){this.entries.delete(JSON.stringify(key))}
  clear(){this.entries.clear()}
}
export class HealthViewState<T>{
  private views=new Map<string,T>()
  constructor(private limit=40){}
  save(key:QueryKey,value:T){
    const id=JSON.stringify(key);this.views.delete(id);this.views.set(id,value)
    while(this.views.size>this.limit)this.views.delete(this.views.keys().next().value!)
  }
  restore(key:QueryKey):T|undefined{return this.views.get(JSON.stringify(key))}
  clear(){this.views.clear()}
}
type Flight={controller:AbortController;promise:Promise<unknown>;users:number}
/** Same exact read shares transport; one caller cancelling must not cancel others.
 * Limit parallel upstream requests across all Health read regions. */
export class HealthReadCoordinator{
  private flights=new Map<string,Flight>()
  private active=0
  private queue:(()=>void)[]=[]
  constructor(private concurrency=4){}
  private async acquire(signal:AbortSignal){
    if(signal.aborted)throw new DOMException('Aborted','AbortError')
    if(this.active<this.concurrency){this.active++;return}
    await new Promise<void>((resolve,reject)=>{
      const start=()=>{signal.removeEventListener('abort',abort);resolve()}
      const abort=()=>{const i=this.queue.indexOf(start);if(i>=0)this.queue.splice(i,1);reject(new DOMException('Aborted','AbortError'))}
      this.queue.push(start);signal.addEventListener('abort',abort,{once:true})
    })
    // The releasing request transfers its active slot to this waiter.
  }
  private release(){const next=this.queue.shift();if(next)next();else this.active--}
  read<T>(key:QueryKey,loader:(signal:AbortSignal)=>Promise<T>,signal?:AbortSignal):Promise<T>{
    if(signal?.aborted)return Promise.reject(new DOMException('Aborted','AbortError'))
    const id=JSON.stringify(key)
    let flight=this.flights.get(id)
    if(!flight||flight.controller.signal.aborted){
      const controller=new AbortController()
      const created:Flight={controller,users:0,promise:Promise.resolve()}
      created.promise=(async()=>{
        await this.acquire(controller.signal)
        const timeout=setTimeout(()=>controller.abort(),45_000)
        try{if(controller.signal.aborted)throw new DOMException('Aborted','AbortError');return await loader(controller.signal)}
        finally{clearTimeout(timeout);this.release()}
      })().finally(()=>{if(this.flights.get(id)===created)this.flights.delete(id)})
      this.flights.set(id,created);flight=created
    }
    const shared=flight
    shared.users++
    return new Promise<T>((resolve,reject)=>{
      let finished=false
      const finish=()=>{if(finished)return false;finished=true;signal?.removeEventListener('abort',abort);if(--shared.users===0)shared.controller.abort();return true}
      const abort=()=>{if(finish())reject(new DOMException('Aborted','AbortError'))}
      signal?.addEventListener('abort',abort,{once:true})
      shared.promise.then(value=>{if(finish())resolve(value as T)},error=>{if(finish())reject(error)})
    })
  }
  clear(){for(const flight of this.flights.values())flight.controller.abort();this.flights.clear()}
}
export async function rebuildCursorWindow<T>(count:number,read:(cursor:string|null)=>Promise<{items:T[];nextCursor:string|null}>,start:string|null=null){
  const items:T[]=[];let cursor=start,pages=0
  do {
    const result=await read(cursor)
    if(result.nextCursor!==null&&(!result.nextCursor||result.nextCursor===cursor))throw Error('分页游标无效')
    items.push(...result.items);cursor=result.nextCursor;pages++
  }while(cursor&&pages<count)
  return {items,cursor,pages}
}
