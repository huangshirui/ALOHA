import {describe,it,expect,vi} from 'vitest'
import {handleSettingsApi,type SettingsEnv} from './worker'
import {dispatchWorkspaceState,WorkspaceState} from './workspace-state'
import settingsWorker from './worker'
import {handleHealthApi} from '../../health/src/worker'
const base='https://settings.example.com/settings/api/v1/workspace'
const previewSettings='https://staging-aloha-app-settings.synthetic.workers.dev'
const previewHealth='https://staging-aloha-app-health.synthetic.workers.dev'
const token='header.'+btoa(JSON.stringify({sub:'usr_synthetic'})).replace(/=/g,'')+'.signature'
const assertion='header.payload.signature'
const initial={id:'spc_existing',name:'Synthetic',role:'owner'}
function fixture(){
  const objects=new Map<string,WorkspaceState>()
  const storageEnv={WORKSPACE_STATE:{
    idFromName:(name:string)=>name,
    get:(key:unknown)=>{
      const name=String(key)
      if(!objects.has(name)){
        const storage=new Map<string,unknown>()
        let tail=Promise.resolve<unknown>(undefined)
        objects.set(name,new WorkspaceState({
          storage:{get:async<T>(k:string)=>storage.get(k) as T|undefined,put:async<T>(k:string,v:T)=>{storage.set(k,v)}},
          blockConcurrencyWhile<T>(fn:()=>Promise<T>){const p=tail.then(fn);tail=p.catch(()=>undefined);return p},
        }))
      }
      return objects.get(name)!
    },
  }}
  const env:SettingsEnv={
    LIFESPACE_IDENTITY_BASE_URL:'https://identity.example.com',
    LIFESPACE_CORE_BASE_URL:'https://core.example.com',
    LIFESPACE_APPLICATION_CREDENTIAL:'lsa_synthetic',
    ...storageEnv,
  }
  let spaces=[initial],creates=0,failList=false,failCreate=false
  const calls:{path:string;body?:Record<string,unknown>}[]=[]
  const upstream=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const path=new URL(String(input)).pathname
    const body=init?.body?JSON.parse(String(init.body)):undefined
    calls.push({path,body})
    if(path==='/internal/v1/access/tokens')return Response.json({data:{accessToken:token,expiresIn:600}})
    if(path==='/api/v1/me')return Response.json({data:{id:'usr_synthetic',displayName:'Synthetic',avatarUrl:null}})
    if(path==='/api/v1/me/spaces')return failList?new Response(null,{status:503}):Response.json({data:spaces})
    if(path==='/api/v1/spaces'){
      creates++
      const newSpace={id:'spc_created_'+creates,name:body.name,role:'owner'}
      spaces=[...spaces,newSpace]
      return failCreate?new Response(null,{status:503}):Response.json({data:newSpace},{status:201})
    }
    throw Error('Unexpected synthetic path')
  })
  const get=()=>handleSettingsApi(new Request(base,{headers:{'Cf-Access-Jwt-Assertion':assertion}}),env,upstream)
  const post=(payload:unknown,headers:Record<string,string>={})=>handleSettingsApi(new Request(base,{
    method:'POST',headers:{'Cf-Access-Jwt-Assertion':assertion,Origin:'https://settings.example.com','Sec-Fetch-Site':'same-origin','X-ALOHA-Intent':'configure-workspace','Content-Type':'application/json',...headers},
    body:JSON.stringify(payload),
  }),env,upstream)
  const health=()=>handleHealthApi(new Request('https://health.example.com/health/api/v1/workspace',{
    headers:{'Cf-Access-Jwt-Assertion':assertion},
  }),{...env,ALOHA_WORKSPACE:{fetch:request=>dispatchWorkspaceState(request,storageEnv,true)}},upstream)
  const previewEnv={...env,ALOHA_WORKSPACE_MODE:'preview'}
  const previewRead=(headers:Record<string,string>={},method='GET',mode='preview')=>handleSettingsApi(new Request(previewSettings+'/settings/api/v1/workspace/preview-read',{method,headers}),{...env,ALOHA_WORKSPACE_MODE:mode},upstream)
  const previewCalls:Request[]=[]
  const healthPreview=(overrides:Record<string,unknown>={},host=previewHealth,wrongUser=false)=>handleHealthApi(new Request(host+'/health/api/v1/workspace',{headers:{'Cf-Access-Jwt-Assertion':assertion}}),{...env,ALOHA_WORKSPACE_MODE:'preview',ALOHA_SETTINGS_PREVIEW_URL:previewSettings+'/settings/',ALOHA_SETTINGS_ACCESS_CLIENT_ID:'synthetic-id',ALOHA_SETTINGS_ACCESS_CLIENT_SECRET:'synthetic-secret',...overrides},async(input,init)=>{
    if(String(input).startsWith(previewSettings)){
      const req=new Request(input,init);previewCalls.push(req)
      if(wrongUser)return Response.json({data:{revision:0,status:'unbound',spaceId:null},userId:'usr_other'})
      return handleSettingsApi(req,previewEnv,upstream)
    }
    return upstream(input,init)
  })
  const reader=(path:string,payload:unknown)=>dispatchWorkspaceState(new Request('https://workspace.internal/'+path,{method:'POST',body:JSON.stringify(payload)}),storageEnv,true)
  return {get,post,health,reader,previewRead,healthPreview,previewCalls,env,upstream,calls,get creates(){return creates},setSpaces:(next:typeof spaces)=>{spaces=next},failList:()=>{failList=true},failCreate:()=>{failCreate=true}}
}
const bind={intent:'bind',spaceId:'spc_existing'}
const create={intent:'create',name:'Synthetic workspace',timezone:'UTC',acknowledgeUncertain:false}
describe('trusted cloud onboarding and Health cross-surface read',()=>{
  it('reads the same preview binding over authenticated HTTPS and verifies the original user',async()=>{
    const t=fixture();await t.post(bind)
    const r=await t.healthPreview();expect(r.status).toBe(200)
    expect((await r.json() as {data:import('@aloha/contracts').WorkspaceView}).data.space?.id).toBe('spc_existing')
    expect(t.previewCalls).toHaveLength(1)
    expect(t.previewCalls[0]?.headers.get('CF-Access-Client-Id')).toBe('synthetic-id')
    expect(t.previewCalls[0]?.headers.get('X-ALOHA-User-Assertion')).toBe(assertion)
    expect(t.previewCalls[0]?.redirect).toBe('manual')
    expect((await t.previewRead({'Cf-Access-Jwt-Assertion':assertion})).status).toBe(401)
    expect((await t.previewRead({'X-ALOHA-User-Assertion':assertion},'POST')).status).toBe(405)
    expect((await t.previewRead({'X-ALOHA-User-Assertion':assertion},'GET','production')).status).toBe(404)
    expect((await t.healthPreview({},previewHealth,true)).status).toBe(503)
  })
  it('fails closed on missing Preview config, wrong origin, or injected production binding',async()=>{
    const t=fixture()
    for(const overrides of [{ALOHA_SETTINGS_PREVIEW_URL:'https://production.example.com'},{ALOHA_SETTINGS_PREVIEW_URL:'https://staging-aloha-app-settings.other.workers.dev'},{ALOHA_SETTINGS_ACCESS_CLIENT_SECRET:''},{ALOHA_WORKSPACE:{fetch:()=>{throw Error('never call production')}}}]){
      expect((await t.healthPreview(overrides)).status).toBe(503)
    }
    expect((await t.healthPreview({},'https://health.example.com')).status).toBe(503)
    expect(t.previewCalls).toHaveLength(0)
  })
  it('does not expose raw binding operations on the public Settings handler or read-only entrypoint',async()=>{
    const t=fixture()
    expect((await settingsWorker.fetch(new Request('https://workspace.internal/read',{method:'POST',body:JSON.stringify({userId:'usr_synthetic'})}),t.env)).status).toBe(404)
    for(const path of ['bind','reserve','finish'])expect((await t.reader(path,{userId:'usr_synthetic',expectedRevision:0,spaceId:'spc_other'})).status).toBe(404)
    expect((await t.reader('read',{userId:'usr_synthetic'})).status).toBe(200)
  })
  it('binds an existing member Space only explicitly, persists across browser origins, and does not allow switching valid binding',async()=>{
    const t=fixture()
    expect((await (await t.get()).json() as {data:import('@aloha/contracts').WorkspaceView}).data.status).toBe('unbound')
    expect((await t.post({...bind,spaceId:'spc_other'})).status).toBe(403)
    expect((await t.post({...bind,userId:'usr_other'})).status).toBe(400)
    expect((await t.post(bind,{Origin:'https://evil.example'})).status).toBe(403)
    expect((await t.post(bind,{'X-ALOHA-Intent':''})).status).toBe(403)
    const configured=await t.post(bind);expect(configured.status).toBe(200)
    expect((await configured.json() as {data:import('@aloha/contracts').WorkspaceView}).data.space?.id).toBe('spc_existing')
    expect((await (await t.health()).json() as {data:import('@aloha/contracts').WorkspaceView}).data.space?.id).toBe('spc_existing')
    expect((await t.post(bind)).status).toBe(200)
    expect((await t.post(create)).status).toBe(409)
    expect(t.creates).toBe(0)
  })
  it('serializes competing create requests; requests write scope only for explicit create',async()=>{
    const t=fixture()
    await t.get()
    expect(t.calls[0]?.body?.requestedScopes).toEqual(['profile:read','spaces:read'])
    const results=await Promise.all([t.post(create),t.post(create)])
    expect(results.some(r=>r.status===200)).toBe(true)
    expect(t.creates).toBe(1)
    expect(t.calls.filter(c=>c.path==='/internal/v1/access/tokens').some(c=>JSON.stringify(c.body?.requestedScopes).includes('spaces:write'))).toBe(true)
    expect((await (await t.get()).json() as {data:import('@aloha/contracts').WorkspaceView}).data.space?.id).toBe('spc_created_1')
  })
  it('does not infer revocation from transient Core failure, but reopens setup after confirmed absence',async()=>{
    const t=fixture()
    await t.post(bind);t.setSpaces([])
    expect((await (await t.get()).json() as {data:import('@aloha/contracts').WorkspaceView}).data.status).toBe('reselect')
    expect((await t.post(create)).status).toBe(200)
    t.failList()
    expect((await t.get()).status).toBe(503)
    expect((await t.post(create)).status).toBe(503)
    expect(t.creates).toBe(1)
  })
  it('keeps ambiguous creation uncertain and allows explicit bind of the recovered Space',async()=>{
    const t=fixture();t.failCreate()
    expect((await t.post(create)).status).toBe(503)
    expect((await (await t.get()).json() as {data:import('@aloha/contracts').WorkspaceView}).data.status).toBe('uncertain')
    expect((await t.post(create)).status).toBe(409)
    expect(t.creates).toBe(1)
    expect((await t.post({intent:'bind',spaceId:'spc_created_1'})).status).toBe(200)
    expect((await (await t.health()).json() as {data:import('@aloha/contracts').WorkspaceView}).data.space?.id).toBe('spc_created_1')
  })
})
