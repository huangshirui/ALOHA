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
  it('exchanges the original signed Access assertion through a separate service-authenticated ingress', async () => {
    const f=fetcher()
    const original='original.user.jwt'
    const r=await handleHealthApi(make(url,'GET',undefined,{
      'Cf-Access-Jwt-Assertion':'upstream.service.jwt',
      'X-Aloha-Access-Assertion':original,
    }),env,f)
    expect(r.status).toBe(200)
    const init=f.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(String(init.body)).accessAssertion).toBe(original)
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

  it('requires a DO binding for presentation, without affecting normal Core CRUD',async()=>{
    const f=fetcher()
    const p='https://health.example.com/health/api/v1/spaces/spc_test/presentation/concerns'
    expect((await handleHealthApi(make(p),env,f)).status).toBe(503)
    expect((await handleHealthApi(make(url),env,f)).status).toBe(200)
  })
  it('derives DO instance from verified User and forwards only own Person scope',async()=>{
    const p='https://health.example.com/health/api/v1/spaces/spc_test/presentation/concerns'
    const stub={fetch:vi.fn(async(_req:Request)=>Response.json({data:{items:[
      {concernId:'rec_test',attention:'watch',placement:null},
    ]}}))}
    const namespace={idFromName:vi.fn((name:string)=>'id:'+name),
      get:vi.fn((_id:unknown)=>stub)}
    const f=vi.fn(async(input:RequestInfo|URL,_init?:RequestInit)=>{
      const path=new URL(String(input)).pathname
      if(path==='/internal/v1/access/tokens')return success({accessToken:'server_token'})
      if(path==='/api/v1/me')return success({principal:{id:'usr_self',type:'user'}})
      if(path.endsWith('/members'))return success([
        {userId:'usr_other',personId:'per_other'},{userId:'usr_self',personId:'per_self'},
      ])
      if(path.endsWith('/models/health_concern/records'))return success({items:[],nextCursor:null})
      return Response.json({error:'unexpected'},{status:404})
    })
    const response=await handleHealthApi(make(p),{...env,HEALTH_PRESENTATION:namespace},f)
    expect(response.status).toBe(200)
    expect((await response.json()).data.items).toMatchObject([{concernId:'rec_test',attention:'watch'}])
    expect(namespace.idFromName).toHaveBeenCalledWith('user:usr_self')
    expect(namespace.get).toHaveBeenCalledWith('id:user:usr_self')
    const passed=JSON.parse(await stub.fetch.mock.calls[0]![0].clone().text())
    expect(passed).toMatchObject({spaceId:'spc_test',personId:'per_self'})
    expect(passed).not.toHaveProperty('userId')
    const authorized=f.mock.calls.find(call=>new URL(String(call[0])).pathname.endsWith('/records'))
    expect(String(authorized![0])).toContain('limit=1')
  })
  it('rejects another Person concern without invoking DO',async()=>{
    const p='https://health.example.com/health/api/v1/spaces/spc_test/presentation/concerns/rec_other'
    const namespace={idFromName:vi.fn(),get:vi.fn()}
    const f=vi.fn(async(input:RequestInfo|URL,_init?:RequestInit)=>{
      const path=new URL(String(input)).pathname
      if(path==='/internal/v1/access/tokens')return success({accessToken:'server_token'})
      if(path==='/api/v1/me')return success({principal:{id:'usr_self',type:'user'}})
      if(path.endsWith('/members'))return success([{userId:'usr_self',personId:'per_self'}])
      if(path.endsWith('/rec_other'))return success({id:'rec_other',subjectPersonId:'per_other'})
      return Response.json({error:'unexpected'},{status:404})
    })
    const res=await handleHealthApi(make(p,'PATCH',{attention:'watch'}),
      {...env,HEALTH_PRESENTATION:namespace as any},f)
    expect(res.status).toBe(403)
    expect(namespace.get).not.toHaveBeenCalled()
    expect((await handleHealthApi(make(p,'PATCH',{attention:'watch'},
      {Origin:'https://evil.example'}),{...env,HEALTH_PRESENTATION:namespace as any},f)).status).toBe(403)
  })
  it('rejects invalid placement before DO write and forwards valid atomic patch',async()=>{
    const p='https://health.example.com/health/api/v1/spaces/spc_test/presentation/concerns/rec_self'
    const stub={fetch:vi.fn(async(_req:Request)=>Response.json({data:{
      concernId:'rec_self',attention:'watch',placement:null,
    }}))}
    const namespace={idFromName:vi.fn((name:string)=>name),get:vi.fn(()=>stub)}
    const f=vi.fn(async(input:RequestInfo|URL,_init?:RequestInit)=>{
      const path=new URL(String(input)).pathname
      if(path==='/internal/v1/access/tokens')return success({accessToken:'server_token'})
      if(path==='/api/v1/me')return success({principal:{id:'usr_self',type:'user'}})
      if(path.endsWith('/members'))return success([{userId:'usr_self',personId:'per_self'}])
      if(path.endsWith('/rec_self'))return success({id:'rec_self',subjectPersonId:'per_self'})
      return Response.json({error:'unexpected'},{status:404})
    })
    expect((await handleHealthApi(make(p,'PATCH',{attention:'invalid'}),
      {...env,HEALTH_PRESENTATION:namespace},f)).status).toBe(422)
    expect(stub.fetch).not.toHaveBeenCalled()
    const res=await handleHealthApi(make(p,'PATCH',{attention:'watch'}),
      {...env,HEALTH_PRESENTATION:namespace},f)
    expect(res.status).toBe(200)
    const passed=JSON.parse(await stub.fetch.mock.calls[0]![0].clone().text())
    expect(passed).toEqual({spaceId:'spc_test',personId:'per_self',
      concernId:'rec_self',patch:{attention:'watch'}})
  })
  it('does not bypass a denied LifeSpace Core model read',async()=>{
    const p='https://health.example.com/health/api/v1/spaces/spc_test/presentation/concerns'
    const namespace={idFromName:vi.fn(),get:vi.fn()}
    const f=vi.fn(async(input:RequestInfo|URL,_init?:RequestInit)=>{
      const path=new URL(String(input)).pathname
      if(path==='/internal/v1/access/tokens')return success({accessToken:'server_token'})
      if(path==='/api/v1/me')return success({principal:{id:'usr_self',type:'user'}})
      if(path.endsWith('/members'))return success([{userId:'usr_self',personId:'per_self'}])
      return Response.json({error:'model_forbidden'},{status:403})
    })
    const res=await handleHealthApi(make(p),{...env,HEALTH_PRESENTATION:namespace as any},f)
    expect(res.status).toBe(403)
    expect(namespace.get).not.toHaveBeenCalled()
  })
  it('fails closed if DO fails instead of returning stale or pretend state',async()=>{
    const p='https://health.example.com/health/api/v1/spaces/spc_test/presentation/concerns'
    const namespace={idFromName:vi.fn(()=> 'id'),get:vi.fn(()=>({
      fetch:async()=>Response.json({data:{error:'sqlite_error'}},{status:503}),
    }))}
    const f=vi.fn(async(input:RequestInfo|URL,_init?:RequestInit)=>{
      const path=new URL(String(input)).pathname
      if(path==='/internal/v1/access/tokens')return success({accessToken:'server_token'})
      if(path==='/api/v1/me')return success({principal:{id:'usr_self',type:'user'}})
      if(path.endsWith('/members'))return success([{userId:'usr_self',personId:'per_self'}])
      if(path.endsWith('/models/health_concern/records'))return success({items:[],nextCursor:null})
      return Response.json({error:'unexpected'},{status:404})
    })
    const r=await handleHealthApi(make(p),{...env,HEALTH_PRESENTATION:namespace},f)
    expect(r.status).toBe(503)
    expect(await r.json()).toEqual({error:'presentation_storage_unavailable'})
  })

})
