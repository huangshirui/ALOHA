/**
 * ALOHA Health same-origin BFF. The browser never receives LifeSpace credentials.
 * Identity verifies the raw Access assertion; Core owns Space/Model/Grant authorization.
 */
import { parsePresentationPatch, type PresentationScope } from './health-presentation'
export { HealthPresentationState } from './health-presentation-do'

export interface HealthPresentationNamespace {
  idFromName(name:string):unknown
  get(id:unknown):{fetch(request:Request):Promise<Response>}
}

export interface HealthEnv {
  HEALTH_PRESENTATION?: HealthPresentationNamespace
  ASSETS?: { fetch(request: Request): Promise<Response> }
  LIFESPACE_IDENTITY_BASE_URL?: string
  LIFESPACE_CORE_BASE_URL?: string
  LIFESPACE_APPLICATION_CREDENTIAL?: string
}
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
type JsonObject = Record<string, unknown>
const modelKeys = new Set([
  'health_concern', 'health_metric', 'health_observation', 'health_event',
  'health_document', 'health_assessment', 'health_regimen',
])
const spacePattern = /^spc_[A-Za-z0-9_-]+$/
const recordPattern = /^[A-Za-z][A-Za-z0-9_-]{2,127}$/
const assertionPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
const json = (error: string, status: number) =>
  Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
const object = (value: unknown): value is JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

function configuredOrigin(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password &&
      url.pathname === '/' && !url.search && !url.hash ? url.origin : null
  } catch { return null }
}
type Route = { path: string; modelKey?: string; spaceId?: string; recordId?: string }
function routeFor(url: URL, method: string): Route | null {
  const p = url.pathname
  if (p === '/health/api/v1/spaces' && method === 'GET') return { path: '/api/v1/me/spaces' }
  const ownPerson = /^\/health\/api\/v1\/spaces\/(spc_[A-Za-z0-9_-]+)\/own-person$/.exec(p)
  if (ownPerson && method === 'GET')
    return { spaceId: ownPerson[1], path: '@own-person' }
  const presentationList = /^\/health\/api\/v1\/spaces\/(spc_[A-Za-z0-9_-]+)\/presentation\/concerns$/.exec(p)
  if (presentationList && method === 'GET')
    return { spaceId:presentationList[1],path:'@presentation-list' }
  const presentationDetail = /^\/health\/api\/v1\/spaces\/(spc_[A-Za-z0-9_-]+)\/presentation\/concerns\/([A-Za-z0-9_-]+)$/.exec(p)
  if(presentationDetail && recordPattern.test(presentationDetail[2]!) &&
    ['PATCH','DELETE'].includes(method))
    return { spaceId:presentationDetail[1],recordId:presentationDetail[2],path:'@presentation-detail' }
  const record = /^\/health\/api\/v1\/spaces\/(spc_[A-Za-z0-9_-]+)\/models\/([a-z_]+)\/records(?:\/([A-Za-z0-9_-]+))?$/.exec(p)
  if (!record || !spacePattern.test(record[1]!) || !modelKeys.has(record[2]!)) return null
  const [, spaceId, modelKey, recordId] = record
  if (recordId ? (!recordPattern.test(recordId) || !['GET','PATCH','DELETE'].includes(method))
               : !['GET','POST'].includes(method)) return null
  return {
    spaceId, modelKey, recordId,
    path: `/api/v1/spaces/${spaceId}/models/${modelKey}/records` +
      (recordId ? `/${recordId}` : ''),
  }
}
async function send(fetchImpl: Fetcher, url: string, init: RequestInit): Promise<Response> {
  try {
    // Cloudflare Workers does not implement redirect: 'error' (it throws TypeError).
    // 'manual' also prevents forwarding server-only Authorization to another origin.
    const response = await fetchImpl(new URL(url), { ...init, redirect: 'manual' })
    if (response.status >= 300 && response.status < 400)
      return json('backend_redirect_blocked', 502)
    return response
  } catch (error) {
    // Never log request URLs, response bodies, assertions, tokens or credentials.
    console.warn('[Health BFF] upstream fetch failed', error instanceof Error ? error.name : 'unknown')
    return json('backend_unavailable', 503)
  }
}
function tokenOf(value: unknown): string | null {
  if (!object(value) || !object(value.data)) return null
  return typeof value.data.accessToken === 'string' ? value.data.accessToken : null
}
async function exchange(
  fetchImpl: Fetcher, identity: string, credential: string, assertion: string,
): Promise<string | Response> {
  const response = await send(fetchImpl, identity + '/internal/v1/access/tokens', {
    method: 'POST',
    headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accessAssertion: assertion,
      requestedScopes: ['profile:read', 'spaces:read', 'resources:read', 'resources:write'],
    }),
  })
  if (!response.ok) {
    if (response.status === 401) return json('not_authenticated', 401)
    if ([403, 409, 422].includes(response.status))
      return json('access_not_linked_or_forbidden', 403)

    // Safe, bounded diagnostics only: never forward Identity response bodies,
    // Access assertions, application credentials, upstream URLs or request IDs.
    const payload: unknown = await response.json().catch(() => null)
    const upstreamCode = object(payload) && object(payload.error)
      ? payload.error.code : object(payload) ? payload.error : null
    if (upstreamCode === 'backend_unavailable')
      return json('identity_transport_unavailable', 503)
    if (upstreamCode === 'ACCESS_VERIFIER_UNAVAILABLE')
      return json('identity_access_verifier_unavailable', 503)
    if (upstreamCode === 'ACCESS_NOT_CONFIGURED')
      return json('identity_access_not_configured', 503)
    if (upstreamCode === 'IDENTITY_NOT_CONFIGURED')
      return json('identity_not_configured', 503)
    if (upstreamCode === 'INTERNAL_ERROR')
      return json('identity_internal_error', 503)
    if (response.status === 404) return json('identity_route_not_found', 503)
    // The HTTP status is non-sensitive; do not expose opaque upstream content.
    return json('identity_upstream_http_' + response.status, 503)
  }
  const value = await response.json().catch(() => null)
  return tokenOf(value) ?? json('identity_invalid_response', 502)
}
function proxyResponse(response: Response): Response {
  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
async function getRecord(
  fetchImpl: Fetcher, core: string, bearer: string, path: string,
): Promise<JsonObject | Response> {
  const response = await send(fetchImpl, core + path, {
    method: 'GET', headers: { Authorization: `Bearer ${bearer}`, Accept: 'application/json' },
  })
  if (!response.ok) return proxyResponse(response)
  const result = await response.json().catch(() => null)
  if (!object(result) || !object(result.data)) return json('invalid_core_response', 502)
  return result.data
}
// Resolve authority only from the verified current User, never browser-provided IDs.
async function resolveOwnIdentity(
  fetchImpl:Fetcher,core:string,bearer:string,spaceId:string,
):Promise<PresentationScope|Response> {
  const headers={Authorization:`Bearer ${bearer}`,Accept:'application/json'}
  const [profile,members]=await Promise.all([
    send(fetchImpl,core+'/api/v1/me',{method:'GET',headers}),
    send(fetchImpl,core+'/api/v1/spaces/'+spaceId+'/members',{method:'GET',headers}),
  ])
  if(!profile.ok) return proxyResponse(profile)
  if(!members.ok) return proxyResponse(members)
  const profileData:unknown=await profile.json().catch(()=>null)
  const membersData:unknown=await members.json().catch(()=>null)
  const principal=object(profileData)&&object(profileData.data)&&object(profileData.data.principal)
    ?profileData.data.principal:null
  const list=object(membersData)&&Array.isArray(membersData.data)?membersData.data:null
  if(!principal || principal.type!=='user' || typeof principal.id!=='string' || !list)
    return json('invalid_identity_response',502)
  const member=list.find((m:unknown)=>object(m)&&m.userId===principal.id)
  if(!object(member)||typeof member.personId!=='string'||!/^per_[A-Za-z0-9_-]+$/.test(member.personId))
    return json('own_person_not_linked',409)
  return {spaceId,userId:principal.id,personId:member.personId}
}

/** ALOHA-only Durable Object call; instance ID is derived from Core-verified Principal. */
async function callPresentationState(
  env:HealthEnv,scope:PresentationScope,operation:'list'|'patch'|'delete',
  concernId?:string,patch?:unknown,
):Promise<Response> {
  if(!env.HEALTH_PRESENTATION) return json('presentation_storage_not_configured',503)
  try {
    const userObject=env.HEALTH_PRESENTATION.get(
      env.HEALTH_PRESENTATION.idFromName('user:'+scope.userId),
    )
    const response=await userObject.fetch(new Request('https://presentation.internal/'+operation,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({spaceId:scope.spaceId,personId:scope.personId,concernId,patch}),
    }))
    if(!response.ok) return json('presentation_storage_unavailable',503)
    return proxyResponse(response)
  } catch {return json('presentation_storage_unavailable',503)}
}
async function handlePresentation(
  request:Request,env:HealthEnv,fetchImpl:Fetcher,core:string,bearer:string,route:Route,
):Promise<Response> {
  if(!env.HEALTH_PRESENTATION) return json('presentation_storage_not_configured',503)
  const scope=await resolveOwnIdentity(fetchImpl,core,bearer,route.spaceId!)
  if(scope instanceof Response) return scope
  const corePath='/api/v1/spaces/'+scope.spaceId+'/models/health_concern/records'
  if(route.path==='@presentation-list' || request.method==='DELETE') {
    // Current LifeSpace Core read authorization is required for application-owned data.
    const authorization=await send(fetchImpl,core+corePath+'?limit=1',{
      method:'GET',headers:{Authorization:`Bearer ${bearer}`,Accept:'application/json'},
    })
    if(!authorization.ok) return proxyResponse(authorization)
  } else {
    const concern=await getRecord(fetchImpl,core,bearer,corePath+'/'+route.recordId)
    if(concern instanceof Response) return concern
    if(concern.subjectPersonId!==scope.personId) return json('concern_not_owned',403)
  }
  if(route.path==='@presentation-list')return callPresentationState(env,scope,'list')
  if(request.method==='DELETE')
    return callPresentationState(env,scope,'delete',route.recordId!)
  if(!request.headers.get('Content-Type')?.includes('application/json'))return json('json_required',415)
  if(Number(request.headers.get('Content-Length')??0)>8192)return json('payload_too_large',413)
  const body=await request.text()
  if(body.length>8192)return json('payload_too_large',413)
  let payload:unknown
  try {payload=JSON.parse(body)}catch{return json('invalid_json',400)}
  let patch
  try{patch=parsePresentationPatch(payload,route.recordId!)}
  catch{return json('presentation_invalid',422)}
  return callPresentationState(env,scope,'patch',route.recordId!,patch)
}
async function ownPerson(fetchImpl:Fetcher,core:string,bearer:string,spaceId:string):Promise<Response> {
  const scope=await resolveOwnIdentity(fetchImpl,core,bearer,spaceId)
  if(scope instanceof Response) return scope
  return Response.json({data:{personId:scope.personId}},{headers:{'Cache-Control':'no-store'}})
}
const filled = (v: unknown) => v !== null && v !== undefined && v !== ''
function validBounds(v: JsonObject): boolean {
  for (const key of ['referenceLow','referenceHigh']) {
    if (filled(v[key]) && (typeof v[key] !== 'number' || !Number.isFinite(v[key]))) return false
  }
  const lo = v.referenceLow, hi = v.referenceHigh
  return !filled(lo) || !filled(hi) || (lo as number) <= (hi as number)
}
async function validateMutation(
  fetchImpl: Fetcher, core: string, bearer: string,
  route: Route, method: string, payload: JsonObject,
): Promise<Response | null> {
  if (route.modelKey === 'health_metric' && !validBounds(payload))
    return json('reference_bounds_invalid', 422)
  if (route.modelKey !== 'health_observation') return null
  let next = payload
  if (method === 'PATCH' && route.recordId) {
    const previous = await getRecord(fetchImpl, core, bearer, route.path)
    if (previous instanceof Response) return previous
    next = { ...previous, ...payload }
  }
  const values = ['valueNumber','valueText','valueBoolean'].filter(k => filled(next[k]))
  if (values.length !== 1 || !validBounds(next)) return json('observation_value_invalid', 422)
  const metricId = next.metricId
  if (typeof metricId !== 'string' || !recordPattern.test(metricId) || !route.spaceId)
    return json('observation_metric_invalid', 422)
  const metric = await getRecord(
    fetchImpl, core, bearer,
    `/api/v1/spaces/${route.spaceId}/models/health_metric/records/${metricId}`,
  )
  if (metric instanceof Response) return metric
  const field = metric.valueType === 'number' ? 'valueNumber'
    : metric.valueType === 'text' ? 'valueText'
    : metric.valueType === 'boolean' ? 'valueBoolean' : null
  if (values[0] !== field) return json('observation_metric_type_mismatch', 422)
  if (field === 'valueNumber' && (typeof next.valueNumber !== 'number' || !Number.isFinite(next.valueNumber)))
    return json('observation_value_invalid', 422)
  if (field === 'valueText' && (typeof next.valueText !== 'string' || !next.valueText.trim()))
    return json('observation_value_invalid', 422)
  if (field === 'valueBoolean' && typeof next.valueBoolean !== 'boolean')
    return json('observation_value_invalid', 422)
  return null
}
export async function handleHealthApi(
  request: Request, env: HealthEnv, fetchImpl: Fetcher = fetch,
): Promise<Response> {
  const url = new URL(request.url)
  const route = routeFor(url, request.method)
  if (!route) return json('not_found', 404)
  const identity = configuredOrigin(env.LIFESPACE_IDENTITY_BASE_URL)
  const core = configuredOrigin(env.LIFESPACE_CORE_BASE_URL)
  const credential = env.LIFESPACE_APPLICATION_CREDENTIAL
  if (!identity || !core || !credential) return json('backend_not_configured', 503)
  const origin = request.headers.get('Origin')
  if (request.method !== 'GET' && origin !== url.origin) return json('origin_forbidden', 403)
  const assertion = request.headers.get('Cf-Access-Jwt-Assertion') ?? ''
  if (assertion.length > 32768 || !assertionPattern.test(assertion))
    return json('access_assertion_required', 401)
  const bearer = await exchange(fetchImpl, identity, credential, assertion)
  if (bearer instanceof Response) return bearer
  if(route.path==='@own-person') return ownPerson(fetchImpl,core,bearer,route.spaceId!)
  if(route.path.startsWith('@presentation-'))
    return handlePresentation(request,env,fetchImpl,core,bearer,route)
  let body: string | undefined
  let parsed: JsonObject | undefined
  if (request.method === 'POST' || request.method === 'PATCH' || request.method === 'DELETE') {
    if (!request.headers.get('Content-Type')?.includes('application/json')) return json('json_required', 415)
    if (Number(request.headers.get('Content-Length') ?? 0) > 65536) return json('payload_too_large', 413)
    body = await request.text()
    if (body.length > 65536) return json('payload_too_large', 413)
    try { const value: unknown = JSON.parse(body); if (object(value)) parsed = value } catch { /* invalid */ }
    if (!parsed) return json('invalid_json', 400)
    if ((request.method === 'PATCH' || request.method === 'DELETE') &&
        (!Number.isInteger(parsed.version) || (parsed.version as number) <= 0))
      return json('version_required', 400)
    if (request.method === 'POST' || request.method === 'PATCH') {
      const error = await validateMutation(fetchImpl, core, bearer, route, request.method, parsed)
      if (error) return error
    }
  }
  const outbound = new URL(route.path, core)
  if (request.method === 'GET') outbound.search = url.search
  const response = await send(fetchImpl, outbound.toString(), {
    method: request.method,
    headers: {
      Authorization: `Bearer ${bearer}`,
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body }),
  })
  return proxyResponse(response)
}
export default {
  fetch(request: Request, env: HealthEnv): Promise<Response> {
    if (new URL(request.url).pathname.startsWith('/health/api/'))
      return handleHealthApi(request, env)
    return env.ASSETS?.fetch(request) ?? Promise.resolve(json('assets_not_configured', 503))
  },
}
