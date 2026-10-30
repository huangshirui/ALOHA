import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:workers'
import { evictDurableObject, runInDurableObject } from 'cloudflare:test'

// Synthetic records only; never use private user or medical data in this public repo.
const namespace=(env as unknown as {HEALTH_PRESENTATION:DurableObjectNamespace}).HEALTH_PRESENTATION
const payload=(op:string,person='per_example',space='spc_example',concern='rec_example',patch?:unknown)=>
  new Request('https://presentation.internal/'+op,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({spaceId:space,personId:person,concernId:concern,patch}),
  })

describe('Health presentation SQLite Durable Object / Workers runtime',()=>{
  it('initializes real SQLite and persists independent attention updates across eviction',async()=>{
    const user=namespace.get(namespace.idFromName('runtime-test-user-a'))
    const response=await user.fetch(payload('patch','per_example','spc_example','rec_example',{
      attention:'priority',
    }))
    expect(response.status).toBe(200)
    expect((await response.json() as any).data.attention).toBe('priority')
    await runInDurableObject(user,async(_instance,state)=>{
      const rows=state.storage.sql.exec<{attention:string}>(
        'SELECT attention FROM health_concern_presentation WHERE concern_id=?','rec_example',
      ).toArray()
      expect(rows).toEqual([{attention:'priority'}])
    })
    await evictDurableObject(user)
    const again=await user.fetch(payload('list'))
    expect((await again.json() as any).data.items).toMatchObject([
      {concernId:'rec_example',attention:'priority',placement:null},
    ])
  })
  it('isolates independent users and Space/Person combinations',async()=>{
    const userA=namespace.get(namespace.idFromName('runtime-test-user-c'))
    const userB=namespace.get(namespace.idFromName('runtime-test-user-d'))
    expect((await userA.fetch(payload('patch','per_example','spc_example','rec_example',{
      attention:'routine',
    }))).status).toBe(200)
    expect((await (await userB.fetch(payload('list'))).json() as any).data.items).toEqual([])
    expect((await (await userA.fetch(payload('list','per_other'))).json() as any).data.items).toEqual([])
    expect((await (await userA.fetch(payload('list','per_example','spc_other'))).json() as any).data.items).toEqual([])
  })
  it('handles invalid patches without inserting rows',async()=>{
    const user=namespace.get(namespace.idFromName('runtime-test-user-invalid'))
    const result=await user.fetch(payload('patch','per_example','spc_example','rec_example',{
      attention:'invalid',
    }))
    expect(result.status).toBe(422)
    expect((await (await user.fetch(payload('list'))).json() as any).data.items).toEqual([])
  })
})
