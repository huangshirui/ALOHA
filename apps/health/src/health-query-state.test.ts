import {describe,it,expect,vi} from 'vitest'
import {HealthQueryState,HealthViewState,HealthReadCoordinator,rebuildCursorWindow,HEALTH_GC_MS,HEALTH_STALE_MS} from './health-query-state'
describe('Health query/view lifecycle',()=>{
  it('freshness is not eviction; scope and query keys isolate results',()=>{
    const state=new HealthQueryState(),key=['session','space','person','metric','a']
    state.set(key,{ids:['fake'],cursor:'next'},['metric'],1,0)
    expect(state.get(key,1)?.fresh).toBe(true)
    expect(state.get(key,HEALTH_STALE_MS)).toEqual({data:{ids:['fake'],cursor:'next'},fresh:false,updatedAt:0})
    expect(state.get(['session','space','other','metric','a'],1)).toBeUndefined()
    expect(state.get(key,HEALTH_STALE_MS+HEALTH_GC_MS)).toBeUndefined()
  })
  it('invalidates dependencies without erasing last success',()=>{
    const state=new HealthQueryState()
    state.set(['metrics'],[1],['metric','observation'],1,0)
    state.set(['documents'],[2],['document'],1,0)
    state.invalidate('observation')
    expect(state.get(['metrics'],1)).toEqual({data:[1],fresh:false,updatedAt:0})
    expect(state.get(['documents'],1)?.fresh).toBe(true)
    state.clear();expect(state.get(['metrics'],2)).toBeUndefined()
  })
  it('restores exact view parameters and scroll separately from queries',()=>{
    const views=new HealthViewState<{search:string;scroll:number}>()
    views.save(['metrics'],{search:'test',scroll:320})
    views.save(['timeline'],{search:'',scroll:0})
    expect(views.restore(['metrics'])).toEqual({search:'test',scroll:320})
    views.clear();expect(views.restore(['metrics'])).toBeUndefined()
  })
  it('deduplicates concurrent requests while cancelling callers independently',async()=>{
    const coordinator=new HealthReadCoordinator()
    let resolve!:(value:number)=>void
    const loader=vi.fn(()=>new Promise<number>(r=>{resolve=r}))
    const a=new AbortController()
    const first=coordinator.read(['same'],loader,a.signal)
    const second=coordinator.read(['same'],loader)
    await Promise.resolve();a.abort()
    await expect(first).rejects.toMatchObject({name:'AbortError'})
    resolve(7);await expect(second).resolves.toBe(7)
    expect(loader).toHaveBeenCalledTimes(1)
  })
  it('rebuilds from a new cursor chain, stopping at exhaustion',async()=>{
    const read=vi.fn(async(cursor:string|null)=>cursor?{items:[2],nextCursor:null}:{items:[1],nextCursor:'new'})
    expect(await rebuildCursorWindow(3,read)).toEqual({items:[1,2],cursor:null,pages:2})
    expect(read.mock.calls).toEqual([[null],['new']])
  })
})
