/** Read-only common ALOHA settings BFF.
 * Cloudflare Access verified by LifeSpace Identity at exchange; no browser bearer.
 * Distinct from LifeSpace account editing (account.aisr.online) and Core auth.
 */
export interface SettingsEnv {
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
  const known=['/settings/api/v1/me','/settings/api/v1/spaces','/settings/api/v1/avatar']
  if(!known.includes(route))return denied('not_found',404)
  if(request.method!=='GET')return denied('method_not_allowed',405)
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
    body:JSON.stringify({accessAssertion:assertion,requestedScopes:['profile:read','spaces:read']}),
  })
  if(!exchanged.ok)return denied(exchanged.status===401?'access_required':'access_denied',
    exchanged.status===401?401:403)
  const session=await data(exchanged)
  const bearer=session?.accessToken
  if(typeof bearer!=='string'||!bearer)return denied('invalid_exchange_response',502)
  const auth={Authorization:'Bearer '+bearer,Accept:'application/json'}
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
