import {workspaceUserId,workspaceSpaceId,type WorkspaceBinding} from '@aloha/contracts'
type Stored=WorkspaceBinding & {startedAt?:number}
interface State {
  storage:{get<T>(key:string):Promise<T|undefined>;put<T>(key:string,value:T):Promise<void>}
  blockConcurrencyWhile<T>(callback:()=>Promise<T>):Promise<T>
}
export interface WorkspaceStorageEnv {WORKSPACE_STATE?:{idFromName(name:string):unknown;get(id:unknown):{fetch(request:Request):Promise<Response>}}}
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const reply=(data:unknown,status=200)=>Response.json({data},{status,headers:{'Cache-Control':'no-store'}})
const fail=(status:number)=>Response.json({error:'workspace_request_denied'},{status,headers:{'Cache-Control':'no-store'}})
const actions=new Set(['/read','/bind','/reserve','/finish'])
const initial:Stored={revision:0,status:'unbound',spaceId:null}
const pendingMs=120_000
/** Private product-state object. No network calls or credentials. */
export class WorkspaceState {
  constructor(private readonly state:State){}
  async fetch(request:Request):Promise<Response>{
    const path=new URL(request.url).pathname
    if(request.method!=='POST'||!actions.has(path))return fail(404)
    const raw=await request.text()
    if(raw.length>2048)return fail(413)
    let body:unknown
    try{body=JSON.parse(raw)}catch{return fail(400)}
    if(!obj(body))return fail(400)
    return this.state.blockConcurrencyWhile(async()=>{
      const stored=await this.state.storage.get<Stored>('binding')??initial
      const current:Stored=stored.status==='creating'&&Date.now()-(stored.startedAt??0)>pendingMs
        ?{revision:stored.revision,status:'uncertain',spaceId:null}:stored
      const view=({revision,status,spaceId}:Stored)=>({revision,status,spaceId})
      if(path==='/read')return reply(view(current))
      if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision!==current.revision)return fail(409)
      let next:Stored
      if(path==='/finish'){
        if(stored.status!=='creating'||body.expectedRevision!==stored.revision)return fail(409)
        if(body.outcome==='bound'&&typeof body.spaceId==='string'&&workspaceSpaceId.test(body.spaceId))
          next={revision:current.revision+1,status:'bound',spaceId:body.spaceId}
        else if(body.outcome==='uncertain'||body.outcome==='unbound')
          next={revision:current.revision+1,status:body.outcome,spaceId:null}
        else return fail(400)
      }else{
        if(current.status==='creating')return fail(409)
        if(path==='/bind'&&typeof body.spaceId==='string'&&workspaceSpaceId.test(body.spaceId))
          next={revision:current.revision+1,status:'bound',spaceId:body.spaceId}
        else if(path==='/reserve'&&(current.status!=='uncertain'||body.acknowledgeUncertain===true))
          next={revision:current.revision+1,status:'creating',spaceId:null,startedAt:Date.now()}
        else return fail(409)
      }
      await this.state.storage.put('binding',next)
      return reply(view(next))
    })
  }
}
export async function dispatchWorkspaceState(request:Request,env:WorkspaceStorageEnv,readOnly=false):Promise<Response>{
    // Only Settings BFF or the named read-only Service Binding entrypoint calls this.
    const url=new URL(request.url)
    if(url.origin!=='https://workspace.internal'||request.method!=='POST'||!actions.has(url.pathname))return fail(404)
    if(readOnly&&url.pathname!=='/read')return fail(404)
    if(!env.WORKSPACE_STATE)return fail(503)
    const raw=await request.text()
    if(raw.length>2048)return fail(413)
    let body:unknown
    try{body=JSON.parse(raw)}catch{return fail(400)}
    if(!obj(body)||typeof body.userId!=='string'||!workspaceUserId.test(body.userId))return fail(400)
    const {userId,...input}=body
    try{
      return await env.WORKSPACE_STATE.get(env.WORKSPACE_STATE.idFromName('user:'+userId)).fetch(
        new Request('https://workspace.internal'+url.pathname,{method:'POST',body:JSON.stringify(input)}))
    }catch{return fail(503)}
}
