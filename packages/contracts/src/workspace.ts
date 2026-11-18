/** ALOHA product selection, not Space authority. */
export interface WorkspaceSpace {id:string;name:string;role:'owner'|'admin'|'editor'|'viewer'}
export interface WorkspaceBinding {revision:number;status:'unbound'|'bound'|'creating'|'uncertain';spaceId:string|null}
export interface WorkspaceView {status:'unbound'|'bound'|'reselect'|'creating'|'uncertain';space:WorkspaceSpace|null;spaces:WorkspaceSpace[]}
export interface WorkspaceService {fetch(request:Request):Promise<Response>}
export const workspaceUserId=/^usr_[A-Za-z0-9_-]{1,128}$/
export const workspaceSpaceId=/^spc_[A-Za-z0-9_-]{1,128}$/
const roles=new Set(['owner','admin','editor','viewer'])
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
export function parseWorkspaceSpaces(payload:unknown):WorkspaceSpace[]|null{
  if(!obj(payload)||!Array.isArray(payload.data))return null
  const result:WorkspaceSpace[]=[]
  for(const row of payload.data){
    if(!obj(row)||typeof row.id!=='string'||!workspaceSpaceId.test(row.id)
      ||typeof row.name!=='string'||!row.name.trim()||row.name.length>160
      ||typeof row.role!=='string'||!roles.has(row.role))return null
    result.push({id:row.id,name:row.name,role:row.role as WorkspaceSpace['role']})
  }
  if(new Set(result.map(s=>s.id)).size!==result.length)return null
  return result
}
export function workspaceView(binding:WorkspaceBinding,spaces:WorkspaceSpace[]):WorkspaceView{
  const space=binding.status==='bound'?spaces.find(s=>s.id===binding.spaceId)??null:null
  return {status:binding.status==='bound'?(space?'bound':'reselect'):binding.status,space,spaces}
}
export async function workspaceState(
  service:WorkspaceService|undefined,userId:string,action:'read'|'bind'|'reserve'|'finish',
  input:Record<string,unknown>={},
):Promise<WorkspaceBinding|Response>{
  const fail=()=>Response.json({error:'workspace_storage_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})
  if(!service||!workspaceUserId.test(userId))return fail()
  try{
    const result=await service.fetch(new Request('https://workspace.internal/'+action,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,userId}),
    }))
    if(!result.ok)return result.status===409?Response.json({error:'workspace_conflict'},{status:409,headers:{'Cache-Control':'no-store'}}):fail()
    const payload:unknown=await result.json()
    if(!obj(payload)||!obj(payload.data))return fail()
    const b=payload.data
    if(!Number.isSafeInteger(b.revision)||Number(b.revision)<0||
      (typeof b.status!=='string'||!['unbound','bound','creating','uncertain'].includes(b.status))||
      !(b.spaceId===null||(typeof b.spaceId==='string'&&workspaceSpaceId.test(b.spaceId)))||
      (b.status==='bound')!==(typeof b.spaceId==='string'))return fail()
    return b as unknown as WorkspaceBinding
  }catch{return fail()}
}

/** Preview HTTP transport has no caller-supplied user ID; Settings verifies the
 * forwarded original user assertion and returns the bound user's identity. */
export const workspacePreviewReadPath='/settings/api/v1/workspace/preview-read'
export const workspacePreviewUserHeader='X-ALOHA-User-Assertion'
export const workspacePreviewMode='preview'
