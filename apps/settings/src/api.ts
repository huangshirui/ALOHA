export interface UserProfile {displayName:string;avatarUrl:string|null}
export interface Space {id:string;name:string}
async function fetchData<T>(path:string):Promise<T>{
  const response=await fetch('/settings/api/v1/'+path,{credentials:'same-origin',headers:{Accept:'application/json'}})
  if(!response.ok)throw new Error(response.status===401?'请先登录 ALOHA':response.status===403?'账号没有访问权限':'设置暂时无法读取（HTTP '+response.status+'）')
  const result:unknown=await response.json()
  if(!result||typeof result!=='object'||!('data' in result))throw new Error('设置服务响应无效')
  return (result as {data:T}).data
}
export const getProfile=()=>fetchData<UserProfile>('me')
export const getSpaces=()=>fetchData<Space[]>('spaces')
/** Storage is browser preference only; never an authorization or access claim. */
export function selectedSpace(spaces:Space[],storage:Pick<Storage,'getItem'>):string{
  const stored=storage.getItem('aloha.space')||storage.getItem('aloha.health.space')||''
  return spaces.some(s=>s.id===stored)?stored:''
}
export const safeReturn=(from:string|null)=>
  from==='assistant'?'/assistant/':from==='finance'?'/finance/':from==='things'?'/things/':'/health/'
