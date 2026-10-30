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
describe('ALOHA shared profile projection / 公共用户资料',()=>{
  const url='https://health.example.com/health/api/v1/profile'
  it('returns the Identity User name and a same-origin avatar path, never the upstream URL',async()=>{
    const visited:string[]=[]
    const f=vi.fn(async(input:RequestInfo|URL)=>{
      const p=new URL(String(input)).pathname;visited.push(p)
      if(p==='/internal/v1/access/tokens')
        return success({accessToken:'synthetic',expiresIn:600})
      if(p==='/api/v1/me')return success({
        id:'usr_synthetic',displayName:'Synthetic User',
        avatarUrl:'https://identity.example.com/assets/users/usr_synthetic/avatar',
      })
      if(p==='/assets/users/usr_synthetic/avatar')
        return new Response(new Uint8Array([137,80,78,71]),{
          headers:{'Content-Type':'image/png'},
        })
      throw new Error('unexpected endpoint '+p)
    })
    const response=await handleHealthApi(make(url),env,f)
    expect(response.status).toBe(200)
    expect((await response.json()).data).toEqual({
      displayName:'Synthetic User',avatarUrl:'/health/api/v1/profile/avatar',
    })
    expect(response.headers.get('cache-control')).toContain('no-store')
    const avatar=await handleHealthApi(make(url+'/avatar'),env,f)
    expect(avatar.status).toBe(200)
    expect(avatar.headers.get('content-type')).toBe('image/png')
    expect(visited.filter(x=>x==='/api/v1/me')).toHaveLength(2)
  })
  it('rejects an unexpected profile response and never proxies arbitrary avatar content',async()=>{
    const fetcher=vi.fn(async(input:RequestInfo|URL)=>{
      const p=new URL(String(input)).pathname
      if(p==='/internal/v1/access/tokens')return success({accessToken:'synthetic',expiresIn:600})
      if(p==='/api/v1/me')return success({id:'usr_synthetic',displayName:'Synthetic User',
        avatarUrl:'https://identity.example.com/assets/users/usr_synthetic/avatar'})
      if(p.endsWith('/avatar'))return new Response('malicious',{headers:{'Content-Type':'text/html'}})
      throw new Error('unexpected endpoint '+p)
    })
    expect((await handleHealthApi(make(url+'/avatar'),env,fetcher)).status).toBe(502)
    const invalid=vi.fn(async(input:RequestInfo|URL)=>{
      const p=new URL(String(input)).pathname
      if(p==='/internal/v1/access/tokens')return success({accessToken:'synthetic',expiresIn:600})
      if(p==='/api/v1/me')return success({id:'usr_synthetic',displayName:'',avatarUrl:null})
      throw new Error('unexpected endpoint '+p)
    })
    expect((await handleHealthApi(make(url),env,invalid)).status).toBe(502)
  })
  it('requires Access even for the public Hub-facing profile endpoint',async()=>{
    const response=await handleHealthApi(new Request(url),env,vi.fn())
    expect(response.status).toBe(401)
  })
})
describe('HealthConcern semantic relation BFF (synthetic)',()=>{
  const prefix='https://health.example.com/health/api/v1/spaces/spc_test/concerns/rec_concern/relations'
  const edge=(kind:'health_metric'|'health_document'='health_metric')=>({
    id:'rel_synthetic',spaceId:'spc_test',createdAt:'2026-10-30T00:00:00Z',
    source:{kind:'record',modelKey:'health_concern',recordId:'rec_concern'},
    predicate:kind==='health_metric'?'monitors':'relates_to',
    target:{kind:'record',modelKey:kind,recordId:'rec_target'},
  })
  function mock(overrides:{targetOwner?:string;relationConcern?:string}={}){
    const calls:{path:string;method:string;body?:unknown}[]=[]
    const f=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const path=new URL(String(input)).pathname,method=init?.method??'GET'
      const body=init?.body?JSON.parse(String(init.body)):undefined
      calls.push({path,method,body})
      if(path==='/internal/v1/access/tokens')return success({accessToken:'synthetic_token'})
      if(path==='/api/v1/me')return success({principal:{id:'usr_self',type:'user'}})
      if(path==='/api/v1/spaces/spc_test/members')
        return success([{userId:'usr_self',personId:'per_self'}])
      if(path.endsWith('/health_concern/records/rec_concern'))
        return success({id:'rec_concern',subjectPersonId:'per_self'})
      if(path.endsWith('/health_metric/records/rec_target'))
        return success({id:'rec_target',valueType:'number'})
      if(path.endsWith('/health_document/records/rec_target'))
        return success({id:'rec_target',subjectPersonId:overrides.targetOwner??'per_self'})
      if(path.endsWith('/semantic-relations')&&method==='GET')
        return success({items:[edge()],nextCursor:null})
      if(path.endsWith('/semantic-relations')&&method==='POST')
        return success({...edge(body.target.modelKey),target:body.target})
      if(path.endsWith('/semantic-relations/rel_synthetic')&&method==='GET')
        return success({...edge(),source:{kind:'record',modelKey:'health_concern',
          recordId:overrides.relationConcern??'rec_concern'}})
      if(path.endsWith('/semantic-relations/rel_synthetic')&&method==='DELETE')
        return new Response(null,{status:204})
      throw new Error('Unexpected synthetic request '+path+' '+method)
    })
    return {f,calls}
  }
  it('queries a single current-user-owned Concern via Core semantic-relation API',async()=>{
    const {f,calls}=mock()
    const res=await handleHealthApi(make(prefix),env,f)
    expect(res.status).toBe(200)
    expect((await res.json()).data.items).toEqual([edge()])
    const core=calls.find(c=>c.path.endsWith('/semantic-relations'))!
    expect(core.method).toBe('GET')
    const url=String(f.mock.calls.find(c=>new URL(String(c[0])).pathname.endsWith('/semantic-relations'))![0])
    expect(new URL(url).searchParams.get('sourceRecordId')).toBe('rec_concern')
    expect(new URL(url).searchParams.get('sourceModelKey')).toBe('health_concern')
  })
  it('chooses monitors for Metrics and refuses browser-selected predicates',async()=>{
    const {f,calls}=mock()
    const res=await handleHealthApi(make(prefix,'POST',{kind:'metric',targetId:'rec_target'}),env,f)
    expect(res.status).toBe(200)
    const core=calls.find(c=>c.path.endsWith('/semantic-relations')&&c.method==='POST')
    expect(core?.body).toEqual({
      source:{kind:'record',modelKey:'health_concern',recordId:'rec_concern'},
      predicate:'monitors',
      target:{kind:'record',modelKey:'health_metric',recordId:'rec_target'},
    })
    const denied=await handleHealthApi(make(prefix,'POST',{
      kind:'metric',targetId:'rec_target',predicate:'relates_to',
    }),env,f)
    expect(denied.status).toBe(422)
    expect(calls.filter(c=>c.path.endsWith('/semantic-relations')&&c.method==='POST')).toHaveLength(1)
  })
  it('never links a different Space Person even with model-read authority',async()=>{
    const {f,calls}=mock({targetOwner:'per_other'})
    const response=await handleHealthApi(make(prefix,'POST',{
      kind:'document',targetId:'rec_target',
    }),env,f)
    expect(response.status).toBe(403)
    expect(calls.some(c=>c.path.endsWith('/semantic-relations')&&c.method==='POST')).toBe(false)
  })
  it('only unlinks edges owned by the specified Concern and preserves original records',async()=>{
    const wrong=mock({relationConcern:'rec_other'})
    expect((await handleHealthApi(make(prefix+'/rel_synthetic','DELETE',{}),env,wrong.f)).status).toBe(404)
    expect(wrong.calls.some(c=>c.method==='DELETE'&&c.path.endsWith('rel_synthetic'))).toBe(false)
    const own=mock()
    expect((await handleHealthApi(make(prefix+'/rel_synthetic','DELETE',{}),env,own.f)).status).toBe(204)
    expect(own.calls.filter(c=>c.method==='DELETE').map(c=>c.path)).toEqual([
      '/api/v1/spaces/spc_test/semantic-relations/rel_synthetic',
    ])
  })
  it('rejects cross-origin and arbitrary user-provided relation sources before Core',async()=>{
    const {f}=mock()
    expect((await handleHealthApi(make(prefix,'POST',{kind:'metric',targetId:'rec_target'},
      {Origin:'https://evil.example.com'}),env,f)).status).toBe(403)
    expect((await handleHealthApi(make(prefix+'?sourceRecordId=rec_other'),env,f)).status).toBe(422)
  })
})
describe('Health trusted BFF', () => {
  it('rejects unconfigured requests without contacting a backend', async () => {
    const f=fetcher()
    const r=await handleHealthApi(make(url),{},f)
    expect(r.status).toBe(503)
    expect(f).not.toHaveBeenCalled()
  })
  it('distinguishes transport failures from safe Identity HTTP and verifier failures', async () => {
    const cases: Array<[string, () => Promise<Response>, string]> = [
      ['network exception', async () => { throw new Error('synthetic backend connection failure') },
        'identity_transport_unavailable'],
      ['verifier unavailable', async () => Response.json({
        error:{code:'ACCESS_VERIFIER_UNAVAILABLE',message:'synthetic private upstream detail'},
      },{status:503}), 'identity_access_verifier_unavailable'],
      ['identity internal error', async () => Response.json({
        error:{code:'INTERNAL_ERROR',message:'synthetic private upstream detail'},
      },{status:500}), 'identity_internal_error'],
      ['wrong route', async () => Response.json({
        error:{code:'NOT_FOUND',message:'synthetic private upstream detail'},
      },{status:404}), 'identity_route_not_found'],
      ['edge error HTML', async () => new Response('synthetic private edge body',
        {status:530,headers:{'Content-Type':'text/html'}}), 'identity_upstream_http_530'],
    ]
    for (const [name, handler, expected] of cases) {
      const fetcher = vi.fn(async () => handler())
      const response = await handleHealthApi(make(url), env, fetcher)
      expect(response.status, name).toBe(503)
      const serialized = JSON.stringify(await response.json())
      expect(serialized, name).toBe(JSON.stringify({error:expected}))
      expect(serialized, name).not.toContain('private')
      expect(fetcher, name).toHaveBeenCalledTimes(1)
    }
  })
  it('uses Workers-supported manual redirects for Identity and Core', async () => {
    const f = fetcher()
    const response = await handleHealthApi(make(url), env, f)
    expect(response.status).toBe(200)
    expect(f).toHaveBeenCalledTimes(2)
    expect((f.mock.calls[0]![1] as RequestInit).redirect).toBe('manual')
    expect((f.mock.calls[1]![1] as RequestInit).redirect).toBe('manual')
  })
  it('fails closed on upstream redirects without following authorization headers', async () => {
    const f = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, {
      status: 302, headers: { Location: 'https://another.example.com/' },
    }))
    const response = await handleHealthApi(make(url), env, f)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'identity_upstream_http_502' })
    expect(f).toHaveBeenCalledTimes(1)
    expect((f.mock.calls[0]![1] as RequestInit).redirect).toBe('manual')
  })
  it('does not log sensitive upstream exception contents', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const f = vi.fn(async (): Promise<Response> => {
        throw new Error('synthetic private URL, JWT and credential')
      })
      const response = await handleHealthApi(make(url), env, f)
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({ error: 'identity_transport_unavailable' })
      expect(warn).toHaveBeenCalledWith('[Health BFF] upstream fetch failed', 'Error')
      expect(JSON.stringify(warn.mock.calls)).not.toContain('synthetic private')
    } finally {
      warn.mockRestore()
    }
  })
  it('does not leak Identity denial details or application credentials', async () => {
    const fetcher = vi.fn(async () => Response.json({
      error:{code:'INVALID_ACCESS_ASSERTION',message:'synthetic private payload'},
    },{status:401}))
    const response = await handleHealthApi(make(url), env, fetcher)
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({error:'not_authenticated'})
    expect(fetcher).toHaveBeenCalledTimes(1)
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

  it('reuses an encrypted LifeSpace bearer only after fresh Identity session-check',async()=>{
    const encoded=btoa(JSON.stringify({sub:'usr_synthetic'}))
      .replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
    const signed='header.'+encoded+'.signature'
    let exchanges=0,checks=0,reads=0
    const f=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const p=new URL(String(input)).pathname
      if(p==='/internal/v1/access/tokens'){
        exchanges++
        return success({accessToken:signed,expiresIn:600})
      }
      if(p==='/internal/v1/access/session-check'){
        checks++
        expect(init?.method).toBe('POST')
        return success({userId:'usr_synthetic'})
      }
      if(p==='/api/v1/me/spaces'){
        reads++
        expect((init?.headers as Record<string,string>).Authorization).toBe('Bearer '+signed)
        return success([{id:'spc_synthetic'}])
      }
      throw new Error('unexpected synthetic route '+p)
    })
    const spaces='https://health.example.com/health/api/v1/spaces'
    const first=await handleHealthApi(make(spaces),env,f)
    expect(first.status).toBe(200)
    const cookie=first.headers.get('set-cookie')
    expect(cookie).toContain('__Host-aloha_health_session=')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).not.toContain(signed)
    const second=await handleHealthApi(make(spaces,'GET',undefined,{
      Cookie:cookie!.split(';')[0]!,
    }),env,f)
    expect(second.status).toBe(200)
    expect(second.headers.get('set-cookie')).toBeNull()
    expect(exchanges).toBe(1)
    expect(checks).toBe(1)
    expect(reads).toBe(2)
  })
  it('rejects a changed Access identity and never reuses the former bearer',async()=>{
    const encoded=btoa(JSON.stringify({sub:'usr_synthetic'})).replace(/=/g,'')
    const signed='header.'+encoded+'.signature'
    let checks=0,exchanges=0
    const f=vi.fn(async(input:RequestInfo|URL)=>{
      const p=new URL(String(input)).pathname
      if(p==='/internal/v1/access/tokens'){
        exchanges++;return success({accessToken:signed,expiresIn:600})
      }
      if(p==='/internal/v1/access/session-check'){
        checks++;return success({userId:'usr_other'})
      }
      if(p==='/api/v1/me/spaces')return success([])
      throw new Error('Unexpected synthetic route '+p)
    })
    const spaces='https://health.example.com/health/api/v1/spaces'
    const first=await handleHealthApi(make(spaces),env,f)
    const old=first.headers.get('set-cookie')!.split(';')[0]!
    const second=await handleHealthApi(make(spaces,'GET',undefined,{Cookie:old}),env,f)
    expect(second.status).toBe(401)
    expect(exchanges).toBe(1)
    expect(checks).toBe(1)
  })
  it('resolves the same current Space Person with one Core read for a verified JWT',async()=>{
    const jwt='header.'+btoa(JSON.stringify({sub:'usr_self'})).replace(/=/g,'')+'.signature'
    const calls:string[]=[]
    const f=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const p=new URL(String(input)).pathname
      calls.push(p)
      if(p==='/internal/v1/access/tokens')return success({accessToken:jwt,expiresIn:600})
      if(p.endsWith('/members'))return success([{userId:'usr_self',personId:'per_self'}])
      if(p.endsWith('/health_concern/records/query')){
        expect(init?.method).toBe('POST')
        expect(JSON.parse(String(init?.body)).filter).toEqual({
          field:'subjectPersonId',op:'contains',value:'per_self',
        })
        return success({items:[],nextCursor:null})
      }
      throw new Error('Unexpected request '+p)
    })
    const response=await handleHealthApi(make(
      'https://health.example.com/health/api/v1/spaces/spc_test/snapshot?models=health_concern'),
      {...env,HEALTH_PRESENTATION:{idFromName:()=>0,get:()=>({fetch:async()=>success({items:[]})})}},f)
    expect(response.status).toBe(200)
    expect((await response.json()).data.personId).toBe('per_self')
    expect(calls).toEqual([
      '/internal/v1/access/tokens','/api/v1/spaces/spc_test/members',
      '/api/v1/spaces/spc_test/models/health_concern/records/query',
    ])
  })
  it('overlaps independent membership and Concern checks before a presentation mutation',async()=>{
    const started=new Set<string>()
    let finish!:()=>void
    const both=new Promise<void>(resolve=>finish=resolve)
    const stub={fetch:vi.fn(async()=>success({concernId:'rec_self',attention:'watch',placement:null}))}
    const ns={idFromName:vi.fn((x:string)=>x),get:vi.fn(()=>stub)}
    const f=vi.fn(async(input:RequestInfo|URL)=>{
      const p=new URL(String(input)).pathname
      if(p==='/internal/v1/access/tokens')return success({accessToken:'server_token'})
      if(p==='/api/v1/me')return success({principal:{id:'usr_self',type:'user'}})
      if(p.endsWith('/members')||p.endsWith('/rec_self')){
        started.add(p.endsWith('/members')?'member':'concern')
        if(started.size===2)finish()
        await both
        return p.endsWith('/members')
          ?success([{userId:'usr_self',personId:'per_self'}])
          :success({id:'rec_self',subjectPersonId:'per_self'})
      }
      throw new Error('unexpected route '+p)
    })
    const url='https://health.example.com/health/api/v1/spaces/spc_test/presentation/concerns/rec_self'
    const result=await handleHealthApi(make(url,'PATCH',{attention:'watch'}),
      {...env,HEALTH_PRESENTATION:ns},f)
    expect(result.status).toBe(200)
    expect([...started].sort()).toEqual(['concern','member'])
    expect(stub.fetch).toHaveBeenCalledTimes(1)
  })
  it('reads only explicitly requested models from Core, not seven by default',async()=>{
    const stub={fetch:vi.fn(async()=>success({items:[]}))}
    const namespace={idFromName:vi.fn((x:string)=>x),get:vi.fn(()=>stub)}
    const seen:string[]=[]
    const f=vi.fn(async(input:RequestInfo|URL)=>{
      const p=new URL(String(input)).pathname;seen.push(p)
      if(p==='/internal/v1/access/tokens')return success({accessToken:'synthetic'})
      if(p==='/api/v1/me')return success({principal:{id:'usr_self',type:'user'}})
      if(p.endsWith('/members'))return success([{userId:'usr_self',personId:'per_self'}])
      if(p.endsWith('/records/query'))return success({items:[],nextCursor:null})
      throw new Error('unexpected route')
    })
    const path='https://health.example.com/health/api/v1/spaces/spc_test/snapshot?models=health_document'
    const response=await handleHealthApi(make(path),{...env,HEALTH_PRESENTATION:namespace},f)
    expect(response.status).toBe(200)
    const body=(await response.json()).data
    expect(Object.keys(body.models)).toEqual(['health_document'])
    expect(body.presentation).toEqual({items:[]})
    expect(seen.filter(x=>x.endsWith('/records/query'))).toHaveLength(1)
    expect(stub.fetch).not.toHaveBeenCalled()
    const injected=await handleHealthApi(make(path.replace('health_document','admin')),env,f)
    expect(injected.status).toBe(422)
  })
  it('preserves opaque Core query cursors and never returns another Person in any page',async()=>{
    const cursors:(string|null)[]=[]
    const f=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const p=new URL(String(input)).pathname
      if(p==='/internal/v1/access/tokens')return success({accessToken:'legacy_token'})
      if(p==='/api/v1/me')return success({principal:{id:'usr_self',type:'user'}})
      if(p.endsWith('/members'))return success([{userId:'usr_self',personId:'per_self'}])
      if(p.endsWith('/health_observation/records/query')){
        const query=JSON.parse(String(init?.body))
        cursors.push(query.page.cursor)
        expect(query.filter).toEqual({field:'subjectPersonId',op:'contains',value:'per_self'})
        return query.page.cursor
          ?success({items:[
            {id:'rec_second',subjectPersonId:'per_self'},
            {id:'rec_other',subjectPersonId:'per_other'},
          ],nextCursor:null})
          :success({items:[{id:'rec_first',subjectPersonId:'per_self'}],nextCursor:'opaque_cursor'})
      }
      throw new Error('unexpected Core request '+p)
    })
    const url='https://health.example.com/health/api/v1/spaces/spc_test/snapshot?models=health_observation'
    const res=await handleHealthApi(make(url),env,f)
    expect(res.status).toBe(200)
    const body=(await res.json()).data
    expect(body.models.health_observation.map((record:{id:string})=>record.id)).toEqual([
      'rec_first','rec_second',
    ])
    expect(cursors).toEqual([null,'opaque_cursor'])
  })
  it('loads all Health models using one Identity exchange, keeping current Person isolation', async()=>{
    // Use a real DO-shaped response, including a persisted synthetic presentation.
    const stub={fetch:vi.fn(async()=>success({items:[
      {concernId:'rec_own_concern',attention:'watch',placement:null},
    ]}))}
    const namespace={idFromName:vi.fn((name:string)=>name),get:vi.fn(()=>stub)}
    const f=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const p=new URL(String(input)).pathname
      if(p==='/internal/v1/access/tokens')return success({accessToken:'server_token'})
      if(p==='/api/v1/me')return success({principal:{id:'usr_self',type:'user'}})
      if(p.endsWith('/members'))return success([
        {userId:'usr_self',personId:'per_self'}, {userId:'usr_other',personId:'per_other'},
      ])
      if(p.endsWith('/records/query')) {
        const model=p.split('/')[6]
        expect(init?.method).toBe('POST')
        const query=JSON.parse(String(init?.body))
        expect(query.page).toEqual({limit:200,cursor:null})
        if(model==='health_metric')expect(query.filter).toBeUndefined()
        else expect(query.filter).toEqual({field:'subjectPersonId',op:'contains',value:'per_self'})
        if(model==='health_metric')return success({items:[{
          id:'rec_metric',name:'synthetic metric',version:1,
        }],nextCursor:null})
        if(model==='health_observation')return success({items:[
          {id:'rec_own',subjectPersonId:'per_self',valueNumber:42},
          {id:'rec_other',subjectPersonId:'per_other',valueNumber:99},
        ],nextCursor:null})
        return success({items:[],nextCursor:null})
      }
      throw new Error('Unexpected synthetic request '+p)
    })
    const snapshot='https://health.example.com/health/api/v1/spaces/spc_test/snapshot'
    const result=await handleHealthApi(make(snapshot),{...env,HEALTH_PRESENTATION:namespace},f)
    expect(result.status).toBe(200)
    const payload=(await result.json()).data
    expect(payload.personId).toBe('per_self')
    expect(payload.models.health_observation.map((x:{id:string})=>x.id)).toEqual(['rec_own'])
    expect(payload.models.health_metric).toHaveLength(1)
    expect(Object.keys(payload.models)).toHaveLength(7)
    expect(payload.presentation).toEqual({items:[
      {concernId:'rec_own_concern',attention:'watch',placement:null},
    ]})
    expect(result.headers.get('server-timing')).toContain('identity;dur=')
    expect(result.headers.get('cache-control')).toContain('no-store')
    expect(f.mock.calls.filter(c=>new URL(String(c[0])).pathname==='/internal/v1/access/tokens')).toHaveLength(1)
    expect(f).toHaveBeenCalledTimes(10)
    expect(stub.fetch).toHaveBeenCalledTimes(1)
  })
  it('fails closed when snapshot has no matching verified Person', async()=>{
    const stub={fetch:vi.fn(async()=>success({items:[]}))}
    const namespace={idFromName:vi.fn((x:string)=>x),get:vi.fn(()=>stub)}
    const f=vi.fn(async(input:RequestInfo|URL)=>{
      const p=new URL(String(input)).pathname
      if(p==='/internal/v1/access/tokens')return success({accessToken:'test'})
      if(p==='/api/v1/me')return success({principal:{id:'usr_self',type:'user'}})
      if(p.endsWith('/members'))return success([{userId:'usr_other',personId:'per_other'}])
      return success({items:[],nextCursor:null})
    })
    const snapshot='https://health.example.com/health/api/v1/spaces/spc_test/snapshot'
    const result=await handleHealthApi(make(snapshot),{...env,HEALTH_PRESENTATION:namespace},f)
    expect(result.status).toBe(409)
    expect(stub.fetch).not.toHaveBeenCalled()
  })
  it('validates complete Observation PATCH without refetching the old record',async()=>{
    const f=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const p=new URL(String(input)).pathname
      if(p==='/internal/v1/access/tokens')return success({accessToken:'token'})
      if(p.endsWith('/health_metric/records/rec_metric'))return success({
        id:'rec_metric',valueType:'number',
      })
      if(p.endsWith('/health_observation/records/rec_observation') && init?.method==='PATCH')
        return success({id:'rec_observation',version:4,valueNumber:41})
      throw new Error('Unexpected Core read '+p)
    })
    const observation=url.replace('health_metric','health_observation')+'/rec_observation'
    const response=await handleHealthApi(make(observation,'PATCH',{
      metricId:'rec_metric',observedDate:'2026-10-10',valueNumber:41,
      valueText:null,valueBoolean:null,referenceLow:null,referenceHigh:null,version:3,
    }),env,f)
    expect(response.status).toBe(200)
    expect(f).toHaveBeenCalledTimes(3)
    expect(f.mock.calls.filter(c=>new URL(String(c[0])).pathname.endsWith('/rec_observation')&&c[1]?.method==='GET')).toHaveLength(0)
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
