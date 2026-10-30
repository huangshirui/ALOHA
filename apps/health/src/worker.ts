/**
 * ALOHA Health same-origin BFF. The browser never receives LifeSpace credentials.
 * Identity verifies the raw Access assertion; Core owns Space/Model/Grant authorization.
 */
import { parsePresentationPatch, type PresentationScope } from './health-presentation'
import { uploadHealthDocument, downloadHealthDocument } from './health-files'
import { readHealthSession, makeHealthSessionCookie, signedTokenSubject, clearHealthSessionCookie } from './health-session'
import { healthSnapshotQuery, snapshotModelKeys, type SnapshotModelKey } from './health-snapshot-query'
import { concernRelationInput, concernTargetModels, isConcernRelation, isConcernTargetKind } from './health-concern-relations'
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
type Route = { path: string; modelKey?: string; spaceId?: string; recordId?: string; relationId?: string }
function routeFor(url: URL, method: string): Route | null {
  const p = url.pathname
  if (p === '/health/api/v1/spaces' && method === 'GET') return { path: '/api/v1/me/spaces' }
  const upload = /^\/health\/api\/v1\/spaces\/(spc_[A-Za-z0-9_-]+)\/documents\/upload$/.exec(p)
  if (upload && method === 'POST') return {spaceId:upload[1],path:'@document-upload'}
  const download = /^\/health\/api\/v1\/spaces\/(spc_[A-Za-z0-9_-]+)\/documents\/([A-Za-z][A-Za-z0-9_-]{2,127})\/download$/.exec(p)
  if (download && method === 'GET') return {spaceId:download[1],recordId:download[2],path:'@document-download'}
  const snapshot = /^\/health\/api\/v1\/spaces\/(spc_[A-Za-z0-9_-]+)\/snapshot$/.exec(p)
  if (snapshot && method === 'GET')
    return {spaceId:snapshot[1],path:'@snapshot'}
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
  const links = /^\/health\/api\/v1\/spaces\/(spc_[A-Za-z0-9_-]+)\/concerns\/([A-Za-z][A-Za-z0-9_-]{2,127})\/relations(?:\/(rel_[A-Za-z0-9_-]+))?$/.exec(p)
  if(links && (links[3] ? method==='DELETE' : ['GET','POST'].includes(method)))
    return {spaceId:links[1],recordId:links[2],relationId:links[3],path:'@concern-relations'}
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
type ExchangedToken={accessToken:string;expiresIn:number}
function tokenOf(value: unknown): ExchangedToken | null {
  if (!object(value) || !object(value.data) || typeof value.data.accessToken !== 'string')return null
  return {accessToken:value.data.accessToken,
    expiresIn:typeof value.data.expiresIn==='number'?value.data.expiresIn:0}
}
async function exchange(
  fetchImpl: Fetcher, identity: string, credential: string, assertion: string,
): Promise<ExchangedToken | Response> {
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
function withSessionCookie(response:Response,cookie:string|null):Response {
  if(!cookie)return response
  const headers=new Headers(response.headers)
  headers.append('Set-Cookie',cookie)
  headers.set('Cache-Control','private, no-store')
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers})
}
async function ensureLifeSpaceSession(
  request:Request,fetchImpl:Fetcher,identity:string,credential:string,assertion:string,
):Promise<{bearer:string;cookie:string|null;userId:string|null}|Response>{
  const cached=await readHealthSession(request,credential,assertion)
  if(cached){
    const checked=await send(fetchImpl,identity+'/internal/v1/access/session-check',{
      method:'POST',
      headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json'},
      body:JSON.stringify({accessAssertion:assertion}),
    })
    if(!checked.ok){
      if(checked.status===401)return withSessionCookie(json('not_authenticated',401),clearHealthSessionCookie())
      if([403,409,422].includes(checked.status))return withSessionCookie(json('access_not_linked_or_forbidden',403),clearHealthSessionCookie())
      return json('identity_session_check_unavailable',503)
    }
    const verified:unknown=await checked.json().catch(()=>null)
    if(!object(verified)||!object(verified.data)||
       verified.data.userId!==cached.userId)return withSessionCookie(json('identity_session_mismatch',401),clearHealthSessionCookie())
    return {bearer:cached.accessToken,cookie:null,userId:cached.userId}
  }
  const exchanged=await exchange(fetchImpl,identity,credential,assertion)
  if(exchanged instanceof Response)return exchanged
  const userId=signedTokenSubject(exchanged.accessToken)
  let cookie:string|null=null
  if(userId && exchanged.expiresIn>15) {
    try {
      cookie=await makeHealthSessionCookie(
        credential,assertion,exchanged.accessToken,exchanged.expiresIn,userId)
    }catch{ /* Never fail authenticated API calls merely because a cookie cannot be set. */ }
  }
  return {bearer:exchanged.accessToken,cookie,userId}
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
  fetchImpl:Fetcher,core:string,bearer:string,spaceId:string,verifiedUserId:string|null=null,
):Promise<PresentationScope|Response> {
  const headers={Authorization:`Bearer ${bearer}`,Accept:'application/json'}
  // Identity verified this usr_* on token exchange or current session-check.
  // Core membership remains authoritative on every request.
  const [profile,members]=await Promise.all([
    verifiedUserId ? Promise.resolve(null)
      : send(fetchImpl,core+'/api/v1/me',{method:'GET',headers}),
    send(fetchImpl,core+'/api/v1/spaces/'+spaceId+'/members',{method:'GET',headers}),
  ])
  if(profile && !profile.ok)return proxyResponse(profile)
  if(!members.ok)return proxyResponse(members)
  const profileData:unknown=profile?await profile.json().catch(()=>null):null
  const membersData:unknown=await members.json().catch(()=>null)
  const principal=object(profileData)&&object(profileData.data)&&object(profileData.data.principal)
    ?profileData.data.principal:null
  const userId=verifiedUserId??(principal?.type==='user' && typeof principal.id==='string'
    ?principal.id:null)
  const list=object(membersData)&&Array.isArray(membersData.data)?membersData.data:null
  if(!userId||!/^usr_[A-Za-z0-9_-]+$/.test(userId)||!list)
    return json('invalid_identity_response',502)
  const member=list.find((m:unknown)=>object(m)&&m.userId===userId)
  if(!object(member)||typeof member.personId!=='string'||!/^per_[A-Za-z0-9_-]+$/.test(member.personId))
    return json('own_person_not_linked',409)
  return {spaceId,userId,personId:member.personId}
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
  verifiedUserId:string|null=null,
):Promise<Response> {
  if(!env.HEALTH_PRESENTATION) return json('presentation_storage_not_configured',503)
  const corePath='/api/v1/spaces/'+route.spaceId+'/models/health_concern/records'
  // Membership verification and independent Core concern authorization are
  // read-only. Run them concurrently; DO mutation is still blocked until both
  // checks succeed and the concern owner matches the verified Space Person.
  const scopePromise=resolveOwnIdentity(fetchImpl,core,bearer,route.spaceId!,verifiedUserId)
  const listOrDelete=route.path==='@presentation-list'||request.method==='DELETE'
  const corePromise=listOrDelete
    ?send(fetchImpl,core+corePath+'?limit=1',{
      method:'GET',headers:{Authorization:`Bearer ${bearer}`,Accept:'application/json'},
    })
    :getRecord(fetchImpl,core,bearer,corePath+'/'+route.recordId)
  const [scope,checked]=await Promise.all([scopePromise,corePromise])
  if(scope instanceof Response)return scope
  if(checked instanceof Response){
    if(!checked.ok)return proxyResponse(checked)
  }else if(checked.subjectPersonId!==scope.personId)return json('concern_not_owned',403)
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
async function ownPerson(fetchImpl:Fetcher,core:string,bearer:string,spaceId:string,verifiedUserId:string|null):Promise<Response> {
  const scope=await resolveOwnIdentity(fetchImpl,core,bearer,spaceId,verifiedUserId)
  if(scope instanceof Response) return scope
  return Response.json({data:{personId:scope.personId}},{headers:{'Cache-Control':'no-store'}})
}

/** One Access proof, one Identity exchange, seven concurrent Core model reads.
 * No persistent caching of health records or Identity tokens. Every Core request
 * continues to independently enforce LifeSpace access and model policies.
 */
async function handleSnapshot(
  env:HealthEnv,fetchImpl:Fetcher,core:string,bearer:string,spaceId:string,identityMs:number,
  requested:URLSearchParams,verifiedUserId:string|null,
):Promise<Response> {
  const rawModels=requested.get('models')
  // Explicit allowlist. Never permit arbitrary LifeSpace route/model expansion.
  const chosen=rawModels?rawModels.split(','):[...snapshotModelKeys]
  if(!chosen.length||chosen.length>snapshotModelKeys.length||
     new Set(chosen).size!==chosen.length||
     chosen.some(model=>!snapshotModelKeys.some(allowed=>allowed===model)) ||
     [...requested.keys()].some(k=>k!=='models'))return json('snapshot_models_invalid',422)
  const includesConcern=chosen.includes('health_concern')
  const started=performance.now()
  type Page={items:JsonObject[];nextCursor:string|null}
  async function pageThrough(model:SnapshotModelKey,personId:string):Promise<JsonObject[]|Response> {
    const records:JsonObject[]=[]
    let cursor:string|null=null
    // Preserve the previous 2,000-record safety ceiling while halving the
    // maximum number of Core page round trips (10 x 200 instead of 20 x 100).
    for(let index=0;index<10;index++){
      const query=healthSnapshotQuery(model,personId,cursor)
      const response=await send(fetchImpl,core+'/api/v1/spaces/'+spaceId+
        '/models/'+model+'/records/query',{method:'POST',
        headers:{Authorization:'Bearer '+bearer,Accept:'application/json',
          'Content-Type':'application/json'},body:JSON.stringify(query)})
      if(!response.ok)return proxyResponse(response)
      const payload:unknown=await response.json().catch(()=>null)
      if(!object(payload)||!object(payload.data)||
        !Array.isArray(payload.data.items)||
        !(payload.data.nextCursor===null||typeof payload.data.nextCursor==='string')||
        !payload.data.items.every(object))return json('invalid_core_response',502)
      const page=payload.data as Page
      records.push(...page.items)
      cursor=page.nextCursor
      if(!cursor)return records
    }
    return json('snapshot_page_limit',413)
  }
  // Determine the current Space Person from Core before constructing a scoped
  // Query. Never accept a browser-selected Person as a filter/authority.
  const scopeStarted=performance.now()
  const scope=await resolveOwnIdentity(fetchImpl,core,bearer,spaceId,verifiedUserId)
  if(scope instanceof Response)return scope
  const scopeMs=performance.now()-scopeStarted
  const queryStarted=performance.now()
  const collections=await Promise.all(chosen.map(model=>
    pageThrough(model as SnapshotModelKey,scope.personId)))
  const queryMs=performance.now()-queryStarted
  const error=collections.find(item=>item instanceof Response)
  if(error instanceof Response)return error
  const coreMs=performance.now()-started
  let presentationData:JsonObject={items:[]}
  if(includesConcern){
    // HealthConcern access was already independently verified by Core.
    const presentation=await callPresentationState(env,scope,'list')
    if(!presentation.ok)return proxyResponse(presentation)
    const payload:unknown=await presentation.json().catch(()=>null)
    if(!object(payload)||!object(payload.data)||
       !Array.isArray(payload.data.items))return json('invalid_presentation_response',502)
    presentationData=payload.data
  }
  const filtered:Record<string,JsonObject[]>={}
  chosen.forEach((model,index)=>{
    const items=collections[index] as JsonObject[]
    // The Core query enforces the Person predicate. Keep a response-boundary
    // check as defense in depth against a broken upstream query projection.
    filtered[model]=model==='health_metric' ? items :
      items.filter(record=>record.subjectPersonId===scope.personId)
  })
  const totalMs=performance.now()-started
  const duration=(n:number)=>Math.round(Math.max(0,n))
  return Response.json({data:{
    personId:scope.personId,models:filtered,presentation:presentationData,
  }},{headers:{
    'Cache-Control':'private, no-store','Server-Timing':
      'identity;dur='+duration(identityMs)+', core;dur='+duration(coreMs)+
      ', person;dur='+duration(scopeMs)+', query;dur='+duration(queryMs)+
      ', presentation;dur='+duration(totalMs-coreMs)+
      ', total;dur='+duration(identityMs+totalMs),
  }})
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
  // UI PATCH contains the full observation value triad and metric identity.
  // Only fetch previous state when a partial PATCH needs merging; Core still
  // enforces optimistic version, model policy and record ownership on write.
  const complete = ['metricId','valueNumber','valueText','valueBoolean',
    'referenceLow','referenceHigh'].every(key => Object.hasOwn(payload,key))
  if (method === 'PATCH' && route.recordId && !complete) {
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
/** HealthConcern is the only source of this narrow UI API.
 * Current membership, concern ownership, target ownership and Core's
 * model/predicate authorization remain independently enforced.
 */
async function handleConcernRelations(
  request:Request,fetchImpl:Fetcher,core:string,bearer:string,
  route:Route,userId:string|null,
):Promise<Response>{
  const {spaceId,recordId:concernId}=route
  const base='/api/v1/spaces/'+spaceId
  const [scope,concern]=await Promise.all([
    resolveOwnIdentity(fetchImpl,core,bearer,spaceId!,userId),
    getRecord(fetchImpl,core,bearer,base+'/models/health_concern/records/'+concernId),
  ])
  if(scope instanceof Response)return scope
  if(concern instanceof Response)return concern
  if(concern.subjectPersonId!==scope.personId)return json('concern_not_owned',403)
  const relationPath=base+'/semantic-relations'
  const headers={Authorization:'Bearer '+bearer,Accept:'application/json'}
  if(request.method==='GET'){
    if(new URL(request.url).search)return json('relation_query_invalid',422)
    const items:unknown[]=[]
    let cursor:string|null=null
    for(let page=0;page<10;page++){
      const query=new URLSearchParams({
        sourceModelKey:'health_concern',sourceRecordId:concernId!,limit:'100',
      })
      if(cursor)query.set('cursor',cursor)
      const response=await send(fetchImpl,core+relationPath+'?'+query,{method:'GET',headers})
      if(!response.ok)return proxyResponse(response)
      const payload:unknown=await response.json().catch(()=>null)
      if(!object(payload)||!object(payload.data)||
        !Array.isArray(payload.data.items)||
        !(payload.data.nextCursor===null||typeof payload.data.nextCursor==='string'))
        return json('invalid_relation_response',502)
      // Any unexpected edge is an upstream contract error, not data to render.
      if(!payload.data.items.every(edge=>isConcernRelation(edge,concernId!)))
        return json('unexpected_relation_type',502)
      items.push(...payload.data.items)
      cursor=payload.data.nextCursor
      if(!cursor)return Response.json({data:{items}},{headers:{'Cache-Control':'private, no-store'}})
    }
    return json('relation_page_limit',413)
  }
  if(request.method==='POST'){
    if(!request.headers.get('Content-Type')?.includes('application/json')||
       Number(request.headers.get('Content-Length')??0)>4096)return json('invalid_relation_request',415)
    const raw=await request.text()
    if(raw.length>4096)return json('payload_too_large',413)
    let body:unknown
    try{body=JSON.parse(raw)}catch{return json('invalid_json',400)}
    if(!object(body)||Object.keys(body).some(key=>!['kind','targetId'].includes(key))||
       !isConcernTargetKind(body.kind)||typeof body.targetId!=='string'||
       !recordPattern.test(body.targetId))return json('invalid_relation_target',422)
    const target=await getRecord(fetchImpl,core,bearer,
      base+'/models/'+concernTargetModels[body.kind]+'/records/'+body.targetId)
    if(target instanceof Response)return target
    if(body.kind!=='metric'&&target.subjectPersonId!==scope.personId)
      return json('relation_target_not_owned',403)
    const input=concernRelationInput(concernId!,body.kind,body.targetId)
    const response=await send(fetchImpl,core+relationPath,{
      method:'POST',headers:{...headers,'Content-Type':'application/json'},
      body:JSON.stringify(input),
    })
    if(!response.ok)return proxyResponse(response)
    const payload:unknown=await response.json().catch(()=>null)
    if(!object(payload)||!isConcernRelation(payload.data,concernId!))
      return json('invalid_relation_response',502)
    return Response.json({data:payload.data},{headers:{'Cache-Control':'private, no-store'}})
  }
  const detail=await send(fetchImpl,core+relationPath+'/'+route.relationId,{
    method:'GET',headers,
  })
  if(!detail.ok)return proxyResponse(detail)
  const payload:unknown=await detail.json().catch(()=>null)
  if(!object(payload)||!isConcernRelation(payload.data,concernId!))
    return json('relation_not_in_concern',404)
  const removed=await send(fetchImpl,core+relationPath+'/'+route.relationId,{
    method:'DELETE',headers,
  })
  if(!removed.ok)return proxyResponse(removed)
  return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}})
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
  const identityStarted=performance.now()
  const session=await ensureLifeSpaceSession(request,fetchImpl,identity,credential,assertion)
  if(session instanceof Response)return session
  const {bearer,userId}=session
  const identityMs=performance.now()-identityStarted
  if(route.path==='@concern-relations')return withSessionCookie(
    await handleConcernRelations(request,fetchImpl,core,bearer,route,userId),session.cookie)
  if(route.path==='@snapshot')return withSessionCookie(
    await handleSnapshot(env,fetchImpl,core,bearer,route.spaceId!,identityMs,url.searchParams,userId),session.cookie)
  if(route.path==='@own-person')return withSessionCookie(
    await ownPerson(fetchImpl,core,bearer,route.spaceId!,userId),session.cookie)
  if(route.path==='@document-upload') {
    const scopeStarted=performance.now()
    const scope=await resolveOwnIdentity(fetchImpl,core,bearer,route.spaceId!,userId)
    const scopeMs=Math.round(performance.now()-scopeStarted)
    if(scope instanceof Response)return withSessionCookie(scope,session.cookie)
    const uploaded=await uploadHealthDocument(request,fetchImpl,core,bearer,scope.spaceId,scope.personId)
    const headers=new Headers(uploaded.headers)
    headers.append('Server-Timing',
      'identity;dur='+Math.round(identityMs)+', own_person;dur='+scopeMs)
    return withSessionCookie(new Response(uploaded.body,{
      status:uploaded.status,statusText:uploaded.statusText,headers,
    }),session.cookie)
  }
  if(route.path==='@document-download') {
    const scope=await resolveOwnIdentity(fetchImpl,core,bearer,route.spaceId!,userId)
    if(scope instanceof Response)return withSessionCookie(scope,session.cookie)
    const doc=await getRecord(fetchImpl,core,bearer,
      '/api/v1/spaces/'+scope.spaceId+'/models/health_document/records/'+route.recordId)
    if(doc instanceof Response)return withSessionCookie(doc,session.cookie)
    if(doc.subjectPersonId!==scope.personId)return withSessionCookie(json('document_not_owned',403),session.cookie)
    return withSessionCookie(await downloadHealthDocument(fetchImpl,core,bearer,scope.spaceId,route.recordId!,String(doc.artifactRef??'')),session.cookie)
  }
  if(route.path.startsWith('@presentation-')) {
    const started=performance.now()
    const response=await handlePresentation(request,env,fetchImpl,core,bearer,route,userId)
    const presentationMs=Math.round(performance.now()-started)
    const headers=new Headers(response.headers)
    headers.set('Server-Timing','identity;dur='+Math.round(identityMs)+
      ', presentation;dur='+presentationMs)
    if(request.method!=='GET')console.log(JSON.stringify({
      event:'health_mutation_timing',kind:'presentation',
      method:request.method,identity_ms:Math.round(identityMs),
      presentation_ms:presentationMs,
    }))
    return withSessionCookie(new Response(response.body,{
      status:response.status,statusText:response.statusText,headers,
    }),session.cookie)
  }
  const validationStarted=performance.now()
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
  const validationMs=performance.now()-validationStarted
  const outbound = new URL(route.path, core)
  if (request.method === 'GET') outbound.search = url.search
  const coreStarted=performance.now()
  const response = await send(fetchImpl, outbound.toString(), {
    method: request.method,
    headers: {
      Authorization: `Bearer ${bearer}`,
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body }),
  })
  const coreMs=performance.now()-coreStarted
  const proxied=proxyResponse(response)
  // Numeric latency segments, never URLs, tokens, identities or response bodies.
  proxied.headers.set('Server-Timing','identity;dur='+Math.round(identityMs)+
    ', validation;dur='+Math.round(validationMs)+
    ', core;dur='+Math.round(coreMs)+
    ', total;dur='+Math.round(identityMs+validationMs+coreMs))
  if(request.method!=='GET')console.log(JSON.stringify({
    event:'health_mutation_timing',kind:route.modelKey??'model',
    method:request.method,identity_ms:Math.round(identityMs),
    validation_ms:Math.round(validationMs),core_ms:Math.round(coreMs),
  }))
  return withSessionCookie(proxied,session.cookie)
}
export default {
  fetch(request: Request, env: HealthEnv): Promise<Response> {
    if (new URL(request.url).pathname.startsWith('/health/api/'))
      return handleHealthApi(request, env)
    return env.ASSETS?.fetch(request) ?? Promise.resolve(json('assets_not_configured', 503))
  },
}
