export interface UserProfile {displayName:string;avatarUrl:string|null}
export interface Space {id:string;name:string}

/** The Settings origin has its own Access admission. A 401 means that this
 * origin lacks a valid assertion, not necessarily that another ALOHA app is logged out. */
export class SettingsApiError extends Error {
  constructor(public readonly status:number,public readonly code:string){
    const reason:Record<string,string>={
      access_required:'Settings Preview 缺少有效的 Cloudflare Access 登录断言，请重新通过受保护的入口访问',
      access_assertion_invalid:'Settings 的 Access 登录凭证无效或已过期，请重新完成 Cloudflare Access 登录',
      audience_not_registered:'Settings 的 Access Audience 尚未注册到 LifeSpace Staging 的 ALOHA Application',
      identity_application_unauthorized:'Settings 连接 LifeSpace Identity 的应用凭据未通过校验，请检查 Staging 绑定',
      account_link_required:'此 Access 账号尚未关联 LifeSpace 用户，需要完成账号关联',
      application_scope_forbidden:'ALOHA Application 尚未允许 Settings 请求的权限范围',
      identity_exchange_forbidden:'LifeSpace Identity 拒绝了本次认证，请检查 Application 和 Access 配置',
      identity_service_unavailable:'LifeSpace Identity 当前无法验证登录请求',
    }
    super(reason[code]??(status===403?'当前账号没有访问 Settings 的权限':
      status>=500?'Settings 服务暂时不可用':'设置数据读取失败'))
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
/** Settings is hosted on a different preview origin from Health. A relative
 * /health/ return path points back to Settings and is broken in Preview.
 * Derive a same-account sibling Preview URL only for our known Worker hostname
 * shape; no user-controlled host, query, or arbitrary redirect is accepted.
 * Configured deployment URLs take precedence.
 */
export const safeReturn=(from:string|null)=>{
  const host=typeof window==='undefined'?'':window.location.hostname
  const match=/^staging-aloha-app-settings\\.([a-z0-9-]+\\.workers\\.dev)$/.exec(host)
  const health=import.meta.env.VITE_ALOHA_HEALTH_URL||
    (match?`https://staging-aloha-app-health.${match[1]}/health/`:'/health/')
  const assistant=import.meta.env.VITE_ALOHA_ASSISTANT_URL||
    (match?'https://aloha.aisr.online/':'/assistant/')
  return from==='assistant'?assistant:from==='finance'?'/finance/':
    from==='things'?'/things/':health
}
