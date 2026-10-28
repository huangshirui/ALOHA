import { describe, expect, it, vi } from 'vitest'
import { handleHealthApi, type HealthEnv } from './worker'

const env: HealthEnv = {
  LIFESPACE_IDENTITY_BASE_URL: 'https://identity.example.com',
  LIFESPACE_CORE_BASE_URL: 'https://core.example.com',
  LIFESPACE_APPLICATION_CREDENTIAL: 'lsa_fake_for_test',
}
const jwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.fake'
const url = 'https://health.example.com/health/api/v1/spaces/spc_test/models/health_metric/records'
const make = (path: string, method='GET', body?: unknown, extra?: Record<string,string>) =>
  new Request(path, {
    method,
    headers: {
      'Cf-Access-Jwt-Assertion': jwt,
      ...(method === 'GET' ? {} : { 'Origin':'https://health.example.com','Content-Type':'application/json' }),
      ...extra,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
const success = (data: unknown) => Response.json({ data })
const fetcher = () => vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
  const path = new URL(String(input)).pathname
  if (path === '/internal/v1/access/tokens') return success({ accessToken:'jwt_server_only' })
  if (path.endsWith('/records')) return success({ items:[],nextCursor:null })
  return success({ id:'rec_fake',valueType:'number' })
})
describe('Health trusted BFF', () => {
  it('rejects unconfigured requests without contacting a backend', async () => {
    const f=fetcher()
    const r=await handleHealthApi(make(url),{},f)
    expect(r.status).toBe(503)
    expect(f).not.toHaveBeenCalled()
  })
  it('requires raw Access proof and does not forward client credentials', async () => {
    const f=fetcher()
    const r=await handleHealthApi(make(url,'GET',undefined,{'Cf-Access-Jwt-Assertion':''}),env,f)
    expect(r.status).toBe(401)
    expect(f).not.toHaveBeenCalled()
  })
  it('rejects unexpected models, methods, paths and cross-origin mutations', async () => {
    const f=fetcher()
    expect((await handleHealthApi(make(url.replace('health_metric','other')) ,env,f)).status).toBe(404)
    expect((await handleHealthApi(make(url,'DELETE',{version:1}),env,f)).status).toBe(404)
    expect((await handleHealthApi(make(url,'POST',{name:'Test'},{Origin:'https://evil.example'}),env,f)).status).toBe(403)
    expect(f).not.toHaveBeenCalled()
  })
  it('exchanges access assertion only on server and forwards scoped query', async () => {
    const f=fetcher()
    const r=await handleHealthApi(make(url+'?limit=20'),env,f)
    expect(r.status).toBe(200)
    expect((await r.json()).data.items).toEqual([])
    const init = f.mock.calls[0]?.[1] as RequestInit
    expect(String(init.body)).toContain('requestedScopes')
    expect(String(init.body)).not.toContain('lsa_fake_for_test')
    expect(f.mock.calls[1]?.[0].toString()).toContain('limit=20')
    expect((f.mock.calls[1]?.[1] as RequestInit).headers).toMatchObject({ Authorization:'Bearer jwt_server_only' })
  })
  it('enforces optimistic-concurrency version on mutations', async () => {
    const f=fetcher()
    const r=await handleHealthApi(make(url+'/rec_test','DELETE',{}),env,f)
    expect(r.status).toBe(400)
  })
  it('blocks invalid reference bounds', async () => {
    const f=fetcher()
    const r=await handleHealthApi(make(url,'POST',{name:'Synthetic',valueType:'number',referenceLow:10,referenceHigh:1}),env,f)
    expect(r.status).toBe(422)
    expect(f).toHaveBeenCalledTimes(1)
  })
  it('blocks mismatched Observation type before writing', async () => {
    const f=fetcher()
    const observation=url.replace('health_metric','health_observation')
    const r=await handleHealthApi(make(observation,'POST',{
      metricId:'rec_test',observedDate:'2026-10-01',subjectPersonId:'per_test',valueText:'not a number',
    }),env,f)
    expect(r.status).toBe(422)
    expect(f).toHaveBeenCalledTimes(2)
  })
  it('resolves only the authenticated user\'s linked Person, not another member', async () => {
    const selfUrl='https://health.example.com/health/api/v1/spaces/spc_test/own-person'
    const f=vi.fn(async (input:RequestInfo|URL, _init?:RequestInit) => {
      const path=new URL(String(input)).pathname
      if(path==='/internal/v1/access/tokens') return success({accessToken:'jwt_server_only'})
      if(path==='/api/v1/me') return success({principal:{id:'usr_me',type:'user'}})
      if(path.endsWith('/members')) return success([
        {userId:'usr_other',personId:'per_other'},
        {userId:'usr_me',personId:'per_me'},
      ])
      return Response.json({error:'not_found'},{status:404})
    })
    const response=await handleHealthApi(make(selfUrl),env,f)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({data:{personId:'per_me'}})
    expect(String((f.mock.calls[0]?.[1] as RequestInit).body)).toContain('profile:read')
    expect((await handleHealthApi(make(selfUrl.replace('own-person','people')),env,f)).status).toBe(404)
  })
  it('fails closed when the current user has no linked Person in the Space', async () => {
    const selfUrl='https://health.example.com/health/api/v1/spaces/spc_test/own-person'
    const f=vi.fn(async (input:RequestInfo|URL,_init?:RequestInit) => {
      const path=new URL(String(input)).pathname
      if(path==='/internal/v1/access/tokens') return success({accessToken:'jwt_server_only'})
      if(path==='/api/v1/me') return success({principal:{id:'usr_me',type:'user'}})
      if(path.endsWith('/members')) return success([{userId:'usr_other',personId:'per_other'}])
      return Response.json({error:'not_found'},{status:404})
    })
    const response=await handleHealthApi(make(selfUrl),env,f)
    expect(response.status).toBe(409)
  })
  it('does not collapse identity denial to a success', async () => {
    const f=vi.fn(async () => Response.json({error:'forbidden'},{status:403}))
    const r=await handleHealthApi(make(url),env,f)
    expect(r.status).toBe(403)
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('requires D1 for Health presentation, without affecting normal Core CRUD',async()=>{
    const f=fetcher()
    const p='https://health.example.com/health/api/v1/spaces/spc_test/presentation/concerns'
    expect((await handleHealthApi(make(p),env,f)).status).toBe(503)
    expect((await handleHealthApi(make(url),env,f)).status).toBe(200)
  })
  it('serves only authenticated own-Person presentation after Core model read authorization',async()=>{
    const p='https://health.example.com/health/api/v1/spaces/spc_test/presentation/concerns'
    const all=vi.fn(async()=>({results:[{
      concern_id:'rec_test',attention:'watch',view:null,asset_id:null,x:null,y:null,
    }]}))
    const db={prepare:vi.fn(()=>({bind:()=>({all,first:async()=>null,run:async()=>({success:true})})}))}
    const f=vi.fn(async(input:RequestInfo|URL,_init?:RequestInit)=>{
      const path=new URL(String(input)).pathname
      if(path==='/internal/v1/access/tokens')return success({accessToken:'server_token'})
      if(path==='/api/v1/me')return success({principal:{id:'usr_self',type:'user'}})
      if(path.endsWith('/members'))return success([
        {userId:'usr_other',personId:'per_other'},
        {userId:'usr_self',personId:'per_self'},
      ])
      if(path.endsWith('/models/health_concern/records'))return success({items:[],nextCursor:null})
      return Response.json({error:'unexpected'},{status:404})
    })
    const result=await handleHealthApi(make(p),{...env,PRESENTATION_DB:db as any},f)
    expect(result.status).toBe(200)
    expect((await result.json()).data.items).toMatchObject([{concernId:'rec_test',attention:'watch'}])
    expect(db.prepare).toHaveBeenCalledTimes(1)
    const second=f.mock.calls.find(call=>new URL(String(call[0])).pathname.endsWith('/records'))
    expect(second).toBeDefined()
    expect(String(second![0])).toContain('limit=1')
  })
  it('rejects editing another Person concern even when current Space membership exists',async()=>{
    const p='https://health.example.com/health/api/v1/spaces/spc_test/presentation/concerns/rec_other'
    const db={prepare:vi.fn()}
    const f=vi.fn(async(input:RequestInfo|URL,_init?:RequestInit)=>{
      const path=new URL(String(input)).pathname
      if(path==='/internal/v1/access/tokens')return success({accessToken:'server_token'})
      if(path==='/api/v1/me')return success({principal:{id:'usr_self',type:'user'}})
      if(path.endsWith('/members'))return success([{userId:'usr_self',personId:'per_self'}])
      if(path.endsWith('/rec_other'))return success({id:'rec_other',subjectPersonId:'per_other'})
      return Response.json({error:'unexpected'},{status:404})
    })
    const result=await handleHealthApi(make(p,'PATCH',{attention:'watch'}),{...env,PRESENTATION_DB:db as any},f)
    expect(result.status).toBe(403)
    expect(db.prepare).not.toHaveBeenCalled()
    expect((await handleHealthApi(make(p,'PATCH',{attention:'watch'},
      {Origin:'https://evil.example'}),{...env,PRESENTATION_DB:db as any},f)).status).toBe(403)
  })
  it('does not bypass a denied Core model read when listing app presentation data',async()=>{
    const p='https://health.example.com/health/api/v1/spaces/spc_test/presentation/concerns'
    const db={prepare:vi.fn()}
    const f=vi.fn(async(input:RequestInfo|URL,_init?:RequestInit)=>{
      const path=new URL(String(input)).pathname
      if(path==='/internal/v1/access/tokens')return success({accessToken:'server_token'})
      if(path==='/api/v1/me')return success({principal:{id:'usr_self',type:'user'}})
      if(path.endsWith('/members'))return success([{userId:'usr_self',personId:'per_self'}])
      return Response.json({error:'model_forbidden'},{status:403})
    })
    const result=await handleHealthApi(make(p),{...env,PRESENTATION_DB:db as any},f)
    expect(result.status).toBe(403)
    expect(db.prepare).not.toHaveBeenCalled()
  })

})
