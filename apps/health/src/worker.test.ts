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
  it('does not collapse identity denial to a success', async () => {
    const f=vi.fn(async () => Response.json({error:'forbidden'},{status:403}))
    const r=await handleHealthApi(make(url),env,f)
    expect(r.status).toBe(403)
    expect(f).toHaveBeenCalledTimes(1)
  })
})
