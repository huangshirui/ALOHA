/** Shared ALOHA staging ingress. Cloudflare Access protects the public hostname.
 * Each surface remains an independent Worker Preview with its own data and credentials.
 */
interface AccessContext { access?: { aud?: string } }
export interface PreviewIngressEnv {
  ACCESS_AUDIENCE?: string
  HEALTH_PREVIEW_URL?: string
  UPSTREAM_ACCESS_CLIENT_ID?: string
  UPSTREAM_ACCESS_CLIENT_SECRET?: string
}
type Fetcher = (request: Request) => Promise<Response>
const proofPattern=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
function error(code:string,status:number):Response {
  return Response.json({error:code},{status,headers:{'Cache-Control':'no-store'}})
}
function upstream(value:string|undefined):URL|null {
  if(!value)return null
  try {
    const u=new URL(value)
    if(u.protocol!=='https:'||u.username||u.password||u.port||
       u.pathname!=='/'||u.search||u.hash||
       !u.hostname.endsWith('.workers.dev'))return null
    return u
  } catch {return null}
}

export async function handlePreviewIngress(
  request:Request, env:PreviewIngressEnv, context:AccessContext,
  fetcher:Fetcher=(input)=>fetch(input),
):Promise<Response> {
  const url=new URL(request.url)
  // The entrypoint never proxies arbitrary URLs or switches between backends.
  if(url.pathname!=='/health'&&!url.pathname.startsWith('/health/'))
    return error('not_found',404)
  if(!['GET','HEAD','POST','PATCH','PUT','DELETE'].includes(request.method))
    return error('method_not_allowed',405)
  if(!env.ACCESS_AUDIENCE||context.access?.aud!==env.ACCESS_AUDIENCE)
    return error('access_required',403)
  const assertion=request.headers.get('Cf-Access-Jwt-Assertion')||''
  if(assertion.length>8192||!proofPattern.test(assertion))
    return error('access_assertion_required',401)
  const targetBase=upstream(env.HEALTH_PREVIEW_URL)
  if(!targetBase||!env.UPSTREAM_ACCESS_CLIENT_ID||!env.UPSTREAM_ACCESS_CLIENT_SECRET)
    return error('upstream_not_configured',503)

  const unsafe=!['GET','HEAD'].includes(request.method)
  if(unsafe&&request.headers.get('Origin')!==url.origin)
    return error('origin_forbidden',403)

  const target=new URL(url.pathname+url.search,targetBase)
  const outgoing=new Request(target,request)
  // Incoming cookies/client headers must never authorize the Preview upstream.
  for(const header of [
    'Cookie','Authorization','Cf-Access-Jwt-Assertion',
    'CF-Access-Client-Id','CF-Access-Client-Secret',
    'X-Aloha-Access-Assertion',
  ]) outgoing.headers.delete(header)
  outgoing.headers.set('CF-Access-Client-Id',env.UPSTREAM_ACCESS_CLIENT_ID)
  outgoing.headers.set('CF-Access-Client-Secret',env.UPSTREAM_ACCESS_CLIENT_SECRET)
  if(url.pathname.startsWith('/health/api/')) {
    // Original user proof survives the second, service-authenticated Access boundary.
    // LifeSpace Identity validates the signed user assertion before issuing a token.
    outgoing.headers.set('X-Aloha-Access-Assertion',assertion)
  }
  if(unsafe) outgoing.headers.set('Origin',target.origin)

  let response:Response
  try{response=await fetcher(outgoing)}catch{return error('upstream_unavailable',502)}
  if(response.status>=300&&response.status<400)
    return error('upstream_redirect_forbidden',502)
  const headers=new Headers(response.headers)
  headers.delete('Set-Cookie')
  if(url.pathname.startsWith('/health/api/')) headers.set('Cache-Control','no-store')
  return new Response(response.body,{status:response.status,headers})
}
export default {
  fetch(request:Request,env:PreviewIngressEnv,ctx:AccessContext):Promise<Response>{
    return handlePreviewIngress(request,env,ctx)
  },
}
