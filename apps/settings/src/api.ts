export interface UserProfile {displayName:string;avatarUrl:string|null}
export interface Space {id:string;name:string}

/** The Settings origin has its own Access admission. A 401 means that this
 * origin lacks a valid assertion, not necessarily that another ALOHA app is logged out. */
export class SettingsApiError extends Error {
  constructor(public readonly status:number,public readonly code:string){
    super(status===401?'Settings 当前站点没有有效的 Access 登录凭证':
      status===403?'当前账号没有访问 Settings 的权限':
      status>=500?'Settings 服务暂时不可用':'设置数据读取失败')
    this.name='SettingsApiError'
  }
}
async function fetchData<T>(path:string):Promise<T>{
  const response=await fetch('/settings/api/v1/'+path,{credentials:'same-origin',headers:{Accept:'application/json'}})
  if(!response.ok){
    const payload:unknown=await response.json().catch(()=>null)
    const code=payload&&typeof payload==='object'&&'error' in payload&&typeof payload.error==='string'?payload.error:'http_'+response.status
    throw new SettingsApiError(response.status,code)
  }
  const result:unknown=await response.json()
  if(!result||typeof result!=='object'||!('data' in result))throw new Error('Settings 数据格式不正确')
  return (result as {data:T}).data
}
export const getProfile=()=>fetchData<UserProfile>('me')
export const getSpaces=()=>fetchData<Space[]>('spaces')
/** A Space ID stored here is a per-origin browser preference, never a grant. */
export function selectedSpace(spaces:Space[],storage:Pick<Storage,'getItem'>):string{
  const stored=storage.getItem('aloha.space')||storage.getItem('aloha.health.space')||''
  return spaces.some(s=>s.id===stored)?stored:''
}
const destinations={
  health:import.meta.env.VITE_ALOHA_HEALTH_URL||'/health/',
  assistant:import.meta.env.VITE_ALOHA_ASSISTANT_URL||'/assistant/',
  finance:'/finance/',
  things:'/things/',
}
export const safeReturn=(from:string|null)=>
  from==='assistant'?destinations.assistant:from==='finance'?destinations.finance:
  from==='things'?destinations.things:destinations.health
