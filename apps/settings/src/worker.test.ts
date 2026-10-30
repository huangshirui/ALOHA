import {describe,expect,it,vi} from 'vitest'
import {handleSettingsApi,type SettingsEnv} from './worker'
const env:SettingsEnv={
  LIFESPACE_IDENTITY_BASE_URL:'https://identity.example.com',
  LIFESPACE_CORE_BASE_URL:'https://core.example.com',
  LIFESPACE_APPLICATION_CREDENTIAL:'lsa_synthetic',
}
const base='https://settings.example.com/settings/api/v1/'
const jwt='eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJmb28ifQ.synthetic'
const request=(path:string,headers:Record<string,string>={})=>
  new Request(base+path,{headers:{'Cf-Access-Jwt-Assertion':jwt,...headers}})
const success=(data:unknown)=>Response.json({data})
function fetcher(overrides:{avatarType?:string;spaceId?:string;name?:string}={}){
  const seen:{path:string;init?:RequestInit}[]=[]
  const run=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const path=new URL(String(input)).pathname
    seen.push({path,init})
    if(path==='/internal/v1/access/tokens')return success({accessToken:'synthetic_jwt'})
    if(path==='/api/v1/me')return success({
      id:'usr_synthetic',displayName:overrides.name??'Synthetic User',
      avatarUrl:'https://identity.example.com/assets/users/usr_synthetic/avatar',
    })
    if(path==='/api/v1/me/spaces')return success([
      {id:overrides.spaceId??'spc_synthetic',name:'Synthetic Space',role:'owner'},
    ])
    if(path==='/assets/users/usr_synthetic/avatar')return new Response('synthetic bytes',{
      headers:{'Content-Type':overrides.avatarType??'image/png'},
    })
    throw new Error('Unexpected '+path)
  })
  return {run,seen}
}
describe('ALOHA common Settings authenticated BFF',()=>{
  it('exposes the verified Identity profile and bounded same-origin image path',async()=>{
    const f=fetcher()
    const r=await handleSettingsApi(request('me'),env,f.run)
    expect(r.status).toBe(200)
    expect((await r.json()).data).toEqual({
      displayName:'Synthetic User',avatarUrl:'/settings/api/v1/avatar',
    })
    expect(r.headers.get('Cache-Control')).toContain('no-store')
    const image=await handleSettingsApi(request('avatar'),env,f.run)
    expect(image.status).toBe(200)
    expect(image.headers.get('Content-Type')).toBe('image/png')
    expect(f.seen.some(s=>s.path.includes('users/usr_synthetic/avatar'))).toBe(true)
    expect(f.seen[0]!.init?.body).toContain('profile:read')
    expect(f.seen[0]!.init?.body).toContain('spaces:read')
  })
  it('shows only Core-authorized Spaces and strips roles from the settings response',async()=>{
    const f=fetcher()
    const r=await handleSettingsApi(request('spaces'),env,f.run)
    expect(r.status).toBe(200)
    expect((await r.json()).data).toEqual([{id:'spc_synthetic',name:'Synthetic Space'}])
  })
  it('fails closed without Access proof and never calls Identity',async()=>{
    const f=fetcher()
    const r=await handleSettingsApi(new Request(base+'me'),env,f.run)
    expect(r.status).toBe(401)
    expect(f.run).not.toHaveBeenCalled()
    const invalid=await handleSettingsApi(request('me',{'Cf-Access-Jwt-Assertion':'untrusted'}),env,f.run)
    expect(invalid.status).toBe(401)
  })
  it('rejects arbitrary routes and HTTP mutation attempts',async()=>{
    const f=fetcher()
    const noRoute=await handleSettingsApi(request('user/usr_victim'),env,f.run)
    expect(noRoute.status).toBe(404)
    const mutation=await handleSettingsApi(new Request(base+'me',{
      method:'POST',headers:{'Cf-Access-Jwt-Assertion':jwt},
    }),env,f.run)
    expect(mutation.status).toBe(405)
    expect(f.run).not.toHaveBeenCalled()
  })
  it('denies wrong image MIME and malformed Identity profiles',async()=>{
    const f=fetcher({avatarType:'text/html'})
    expect((await handleSettingsApi(request('avatar'),env,f.run)).status).toBe(502)
    const invalid=fetcher({name:''})
    expect((await handleSettingsApi(request('me'),env,invalid.run)).status).toBe(502)
  })
  it('rejects unauthorized/nonexistent Spaces from upstream',async()=>{
    const f=fetcher({spaceId:'other_prefix'})
    expect((await handleSettingsApi(request('spaces'),env,f.run)).status).toBe(502)
  })
  it('never follows upstream redirects with credentials',async()=>{
    const f=vi.fn(async()=>new Response(null,{status:302,headers:{Location:'https://evil.example/'}}))
    const r=await handleSettingsApi(request('me'),env,f)
    expect(r.status).toBe(403)
    expect(f.mock.calls[0]?.[1]?.redirect).toBe('manual')
  })
})
