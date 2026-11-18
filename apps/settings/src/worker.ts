/** Common ALOHA settings BFF.
 * Cloudflare Access verified by LifeSpace Identity at exchange; no browser bearer.
 * Distinct from LifeSpace account editing (account.aisr.online) and Core auth.
 */
import {parseWorkspaceSpaces,workspaceState,workspaceView,workspaceSpaceId,workspaceUserId,type WorkspaceService} from '@aloha/contracts'
import {dispatchWorkspaceState,type WorkspaceStorageEnv} from './workspace-state'
export interface SettingsEnv extends WorkspaceStorageEnv {
  LIFESPACE_IDENTITY_BASE_URL?:string
  LIFESPACE_CORE_BASE_URL?:string
  LIFESPACE_APPLICATION_CREDENTIAL?:string
  ASSETS?:{fetch:(request:Request)=>Promise<Response>}
}
type Fetcher=(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>
type Dict=Record<string,unknown>
const object=(v:unknown):v is Dict=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const jwt=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
const denied=(code:string,status:number)=>Response.json({error:code},{status,headers:{'Cache-Control':'no-store'}})
const origin=(raw?:string)=>{
  try{
    if(!raw)return null
    const u=new URL(raw)
    if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)return null
    return u.origin
  }catch{return null}
}
async function upstream(fetcher:Fetcher,url:string,init:RequestInit){
  try{
    const r=await fetcher(new URL(url),{...init,redirect:'manual'})
    return r.status>=300&&r.status<400?denied('backend_redirect_forbidden',502):r
  }catch{return denied('backend_unavailable',503)}
}
async function data(response:Response):Promise<Dict|null>{
  const value:unknown=await response.json().catch(()=>null)
  return object(value)&&object(value.data)?value.data:null
}
export async function handleSettingsApi(request:Request,env:SettingsEnv,fetcher:Fetcher=fetch):Promise<Response>{
  const route=new URL(request.url).pathname
  const known=['/settings/api/v1/me','/settings/api/v1/spaces','/settings/api/v1/avatar','/settings/api/v1/workspace']
  if(!known.includes(route))return denied('not_found',404)
  const workspace=route==='/settings/api/v1/workspace'
  const mutation=workspace&&request.method==='POST'
  if(request.method!=='GET'&&!mutation)return denied('method_not_allowed',405)
  if(new URL(request.url).search)return denied('invalid_request',400)
  let input:Dict|null=null
  if(mutation){
    if(request.headers.get('Origin')!==new URL(request.url).origin||
      request.headers.get('Sec-Fetch-Site')!=='same-origin'||
      request.headers.get('X-ALOHA-Intent')!=='configure-workspace'||
      !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')??''))return denied('origin_forbidden',403)
    const raw=await request.text()
    if(raw.length>2048)return denied('invalid_request',400)
    let parsed:unknown
    try{parsed=JSON.parse(raw)}catch{return denied('invalid_request',400)}
    if(!object(parsed))return denied('invalid_request',400)
    const keys=Object.keys(parsed).sort().join(',')
    if(parsed.intent==='bind'){
      if(keys!=='intent,spaceId'||typeof parsed.spaceId!=='string'||!workspaceSpaceId.test(parsed.spaceId))return denied('invalid_request',400)
    }else if(parsed.intent==='create'){
      if(keys!=='acknowledgeUncertain,intent,name,timezone'||typeof parsed.name!=='string'||!parsed.name.trim()||parsed.name.trim().length>100||
        typeof parsed.timezone!=='string'||!parsed.timezone||parsed.timezone.length>100||typeof parsed.acknowledgeUncertain!=='boolean')return denied('invalid_request',400)
      try{new Intl.DateTimeFormat('en',{timeZone:parsed.timezone})}catch{return denied('invalid_request',400)}
    }else return denied('invalid_request',400)
    input=parsed
  }
  if(workspace&&!env.WORKSPACE_STATE)return denied('workspace_storage_unavailable',503)
  const storage:WorkspaceService={fetch:request=>dispatchWorkspaceState(request,env)}
  const identity=origin(env.LIFESPACE_IDENTITY_BASE_URL)
  const core=origin(env.LIFESPACE_CORE_BASE_URL)
  const credential=env.LIFESPACE_APPLICATION_CREDENTIAL
  if(!identity||!core||!credential)return denied('not_configured',503)
  const assertion=request.headers.get('Cf-Access-Jwt-Assertion')||''
  if(assertion.length>32768||!jwt.test(assertion))return denied('access_required',401)
  const exchanged=await upstream(fetcher,identity+'/internal/v1/access/tokens',{
    method:'POST',headers:{
      Authorization:'Bearer '+credential,
      'Content-Type':'application/json',
    },
    body:JSON.stringify({accessAssertion:assertion,requestedScopes:['profile:read','spaces:read',...(input?.intent==='create'?['spaces:write']:[])]}),
  })
  if(!exchanged.ok){
    // Do not confuse a missing Access header with an Identity exchange failure.
    // Only LifeSpace's bounded machine-readable code is interpreted; never
    // expose upstream bodies, assertions, access tokens or credentials.
    const failure:unknown=await exchanged.json().catch(()=>null)
    const code=object(failure)&&object(failure.error)&&typeof failure.error.code==='string'
      ?failure.error.code:null
    if(exchanged.status===401){
      return denied(code==='INVALID_ACCESS_ASSERTION'?'access_assertion_invalid':'identity_application_unauthorized',
        code==='INVALID_ACCESS_ASSERTION'?401:503)
    }
    if(code==='ACCESS_AUDIENCE_MISMATCH')return denied('audience_not_registered',403)
    if(code==='ACCESS_PRINCIPAL_UNLINKED')return denied('account_link_required',409)
    if(code==='FORBIDDEN')return denied('application_scope_forbidden',403)
    if(exchanged.status===503||exchanged.status>=500)return denied('identity_service_unavailable',503)
    if(exchanged.status===403)return denied('identity_exchange_forbidden',403)
    return denied('identity_exchange_unavailable',503)
  }
  const session=await data(exchanged)
  const bearer=session?.accessToken
  if(typeof bearer!=='string'||!bearer)return denied('invalid_exchange_response',502)
  const auth={Authorization:'Bearer '+bearer,Accept:'application/json'}
  if(workspace){
    const profileResponse=await upstream(fetcher,identity+'/api/v1/me',{method:'GET',headers:auth})
    if(!profileResponse.ok)return denied('profile_unavailable',profileResponse.status)
    const profile=await data(profileResponse)
    if(!profile||typeof profile.id!=='string'||!workspaceUserId.test(profile.id)||
      typeof profile.displayName!=='string'||!profile.displayName.trim())return denied('invalid_profile_response',502)
    const userId=profile.id
    const binding=await workspaceState(storage,userId,'read')
    if(binding instanceof Response)return binding
    const listed=await upstream(fetcher,core+'/api/v1/me/spaces',{method:'GET',headers:auth})
    if(!listed.ok)return denied('spaces_unavailable',listed.status)
    const spaces=parseWorkspaceSpaces(await listed.json().catch(()=>null))
    if(!spaces)return denied('invalid_spaces_response',502)
    const view=workspaceView(binding,spaces)
    const ok=(value:unknown)=>Response.json({data:value},{headers:{'Cache-Control':'private, no-store'}})
    if(!input)return ok(view)
    if(view.status==='bound'){
      if(input.intent==='bind'&&input.spaceId===view.space?.id)return ok(view)
      return denied('workspace_already_bound',409)
    }
    if(view.status==='creating')return denied('workspace_creation_in_progress',409)
    if(input.intent==='bind'){
      const selected=spaces.find(s=>s.id===input.spaceId)
      if(!selected)return denied('workspace_not_member',403)
      const saved=await workspaceState(storage,userId,'bind',{expectedRevision:binding.revision,spaceId:selected.id})
      if(saved instanceof Response)return saved
      return ok(workspaceView(saved,spaces))
    }
    if(view.status==='uncertain'&&input.acknowledgeUncertain!==true)return denied('workspace_creation_uncertain',409)
    const reservation=await workspaceState(storage,userId,'reserve',{
      expectedRevision:binding.revision,acknowledgeUncertain:input.acknowledgeUncertain,
    })
    if(reservation instanceof Response)return reservation
    // Durable reservation precedes Core. Never retry an ambiguous create.
    const created=await upstream(fetcher,core+'/api/v1/spaces',{
      method:'POST',headers:{...auth,'Content-Type':'application/json'},
      body:JSON.stringify({name:String(input.name).trim(),timezone:input.timezone,ownerDisplayName:profile.displayName}),
    })
    const item=created.status===201?await data(created):null
    const space=item&&typeof item.id==='string'&&workspaceSpaceId.test(item.id)&&typeof item.name==='string'&&item.name.trim()&&item.role==='owner'
      ?{id:item.id,name:item.name,role:'owner' as const}:null
    const outcome=space?'bound':([400,401,403,422].includes(created.status)?'unbound':'uncertain')
    const finished=await workspaceState(storage,userId,'finish',{
      expectedRevision:reservation.revision,outcome,...(space?{spaceId:space.id}:{})
    })
    if(finished instanceof Response)return finished
    if(!space)return denied(outcome==='uncertain'?'workspace_creation_uncertain':'workspace_create_denied',outcome==='uncertain'?503:created.status)
    return ok(workspaceView(finished,[...spaces.filter(s=>s.id!==space.id),space]))
  }
  if(route==='/settings/api/v1/spaces'){
    const response=await upstream(fetcher,core+'/api/v1/me/spaces',{method:'GET',headers:auth})
    if(!response.ok)return denied('spaces_unavailable',response.status)
    const payload:unknown=await response.json().catch(()=>null)
    if(!object(payload)||!Array.isArray(payload.data))return denied('invalid_spaces_response',502)
    const spaces:unknown[]=payload.data
    if(spaces.some(s=>!object(s)||typeof s.id!=='string'||!/^spc_[A-Za-z0-9_-]+$/.test(s.id)||
      typeof s.name!=='string'))return denied('invalid_spaces_response',502)
    return Response.json({data:spaces.map(s=>({id:(s as Dict).id,name:(s as Dict).name}))},
      {headers:{'Cache-Control':'private, no-store'}})
  }
  const response=await upstream(fetcher,identity+'/api/v1/me',{method:'GET',headers:auth})
  if(!response.ok)return denied('profile_unavailable',response.status)
  const profile=await data(response)
  if(!profile||typeof profile.id!=='string'||!/^usr_[A-Za-z0-9_-]+$/.test(profile.id)||
     typeof profile.displayName!=='string'||!profile.displayName.trim()||
     !(profile.avatarUrl===null||typeof profile.avatarUrl==='string'))
    return denied('invalid_profile_response',502)
  if(route==='/settings/api/v1/me')
    return Response.json({data:{
      displayName:profile.displayName,
      avatarUrl:profile.avatarUrl?'/settings/api/v1/avatar':null,
    }},{headers:{'Cache-Control':'private, no-store'}})
  if(!profile.avatarUrl)return denied('no_avatar',404)
  // Stable path derived from the *authenticated* Identity response, never user input.
  const image=await upstream(fetcher,identity+'/assets/users/'+encodeURIComponent(profile.id)+'/avatar',{
    method:'GET',headers:{Accept:'image/png,image/jpeg,image/webp'},
  })
  if(!image.ok)return denied('avatar_unavailable',image.status)
  const contentType=((image.headers.get('content-type')||'').split(';')[0]??'').trim().toLowerCase()
  if(!['image/png','image/jpeg','image/webp'].includes(contentType))return denied('invalid_avatar_content_type',502)
  return new Response(image.body,{headers:{
    'Content-Type':contentType,'Cache-Control':'private, max-age=60',
    'X-Content-Type-Options':'nosniff',
  }})
}
export default {
  fetch(request:Request,env:SettingsEnv):Promise<Response>{
    const url=new URL(request.url)
    if(url.pathname==='/settings'&&request.method==='GET'){
      url.pathname='/settings/'
      return Promise.resolve(Response.redirect(url.toString(),308))
    }
    if(url.pathname.startsWith('/settings/api/'))return handleSettingsApi(request,env)
    if(!url.pathname.startsWith('/settings/'))
      return Promise.resolve(denied('not_found',404))
    return env.ASSETS?.fetch(request)??Promise.resolve(denied('assets_unavailable',503))
  },
}
