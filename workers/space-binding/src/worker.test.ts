import {describe,it,expect} from 'vitest'
import worker,{WorkspaceState} from './worker'
import {workspaceState,workspaceView} from '@aloha/contracts'
function fixture(){
  const objects=new Map<string,WorkspaceState>()
  const env={WORKSPACE_STATE:{
    idFromName:(name:string)=>name,
    get:(id:unknown)=>{
      const key=String(id)
      if(!objects.has(key)){
        const store=new Map<string,unknown>()
        let tail=Promise.resolve<unknown>(undefined)
        objects.set(key,new WorkspaceState({
          storage:{get:async<T>(k:string)=>store.get(k) as T|undefined,put:async<T>(k:string,v:T)=>{store.set(k,v)}},
          blockConcurrencyWhile<T>(fn:()=>Promise<T>){const p=tail.then(fn);tail=p.catch(()=>undefined);return p},
        }))
      }
      return objects.get(key)!
    },
  }}
  return {fetch:(request:Request)=>worker.fetch(request,env)}
}
describe('private ALOHA workspace state',()=>{
  it('serializes first setup, isolates users, and survives repeated reads',async()=>{
    const svc=fixture()
    const a=await workspaceState(svc,'usr_a','read')
    expect(a).toEqual({revision:0,status:'unbound',spaceId:null})
    const results=await Promise.all([
      workspaceState(svc,'usr_a','reserve',{expectedRevision:0}),
      workspaceState(svc,'usr_a','reserve',{expectedRevision:0}),
    ])
    expect(results.filter(x=>x instanceof Response).length).toBe(1)
    const done=await workspaceState(svc,'usr_a','finish',{expectedRevision:1,outcome:'bound',spaceId:'spc_a'})
    expect(done).toEqual({revision:2,status:'bound',spaceId:'spc_a'})
    expect(await workspaceState(svc,'usr_a','read')).toEqual(done)
    expect(await workspaceState(svc,'usr_b','read')).toEqual(a)
    if(done instanceof Response)throw Error('unexpected')
    expect(workspaceView(done,[]).status).toBe('reselect')
  })
  it('preserves uncertain outcome and rejects blind retry; explicit bind resolves',async()=>{
    const svc=fixture()
    await workspaceState(svc,'usr_a','reserve',{expectedRevision:0})
    await workspaceState(svc,'usr_a','finish',{expectedRevision:1,outcome:'uncertain'})
    const retry=await workspaceState(svc,'usr_a','reserve',{expectedRevision:2})
    expect(retry instanceof Response&&retry.status).toBe(409)
    expect(await workspaceState(svc,'usr_a','bind',{expectedRevision:2,spaceId:'spc_existing'})).toEqual({revision:3,status:'bound',spaceId:'spc_existing'})
  })
  it('rejects public origin, malformed user and unsupported routes',async()=>{
    const svc=fixture()
    expect((await svc.fetch(new Request('https://example.com/read',{method:'POST',body:'{}'}))).status).toBe(404)
    expect((await svc.fetch(new Request('https://workspace.internal/read',{method:'POST',body:'{"userId":"victim"}'}))).status).toBe(400)
  })
})
