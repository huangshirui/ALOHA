/** Browser-only, same-origin client. Never accepts or stores LifeSpace tokens. */
export type HealthModelKey =
  | 'health_concern' | 'health_metric' | 'health_observation' | 'health_event'
  | 'health_document' | 'health_assessment' | 'health_regimen'
export interface HealthRecord {
  id: string
  spaceId: string
  modelKey: HealthModelKey
  version: number
  [field: string]: unknown
}
export interface HealthPage<T extends HealthRecord> {
  items: T[]
  nextCursor: string | null
}
const base = '/health/api/v1'
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(base + path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(init?.body === undefined ? {} : {'Content-Type':'application/json'}),
    },
  })
  if (!response.ok) {
    throw new Error(`Health API ${response.status}: ${response.status === 503 ? '后台尚未配置' : '请求失败'}`)
  }
  if (response.status === 204) return undefined as T
  const payload: unknown = await response.json()
  if (!payload || typeof payload !== 'object' || !('data' in payload))
    throw new Error('Health API 响应格式无效')
  return (payload as {data:T}).data
}
// Personal Space selection is an explicit one-time product decision, NOT a trust claim.
// Core still verifies every requested Space against the authenticated LifeSpace user.
export const listAuthorizedSpaces = () =>
  api<Array<{id:string,name:string,role:string,timezone?:string}>>('/spaces')
export const listSpacePeople = (spaceId:string) =>
  api<{items:Array<{id:string,displayName:string}>,nextCursor:string|null}>(
    `/spaces/${encodeURIComponent(spaceId)}/people`)
const recordsPath = (spaceId:string, model:HealthModelKey) =>
  `/spaces/${encodeURIComponent(spaceId)}/models/${model}/records`
export const listHealthRecords = <T extends HealthRecord>(
  spaceId:string, model:HealthModelKey, params:URLSearchParams=new URLSearchParams(),
) => api<HealthPage<T>>(recordsPath(spaceId,model)+(params.size ? `?${params}` : ''))
export const getHealthRecord = <T extends HealthRecord>(spaceId:string,model:HealthModelKey,id:string) =>
  api<T>(recordsPath(spaceId,model)+'/'+encodeURIComponent(id))
export const createHealthRecord = <T extends HealthRecord>(spaceId:string,model:HealthModelKey,fields:Record<string,unknown>) =>
  api<T>(recordsPath(spaceId,model),{method:'POST',body:JSON.stringify(fields)})
export const updateHealthRecord = <T extends HealthRecord>(
  spaceId:string,model:HealthModelKey,id:string,version:number,fields:Record<string,unknown>,
) => api<T>(recordsPath(spaceId,model)+'/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({...fields,version})})
export const deleteHealthRecord = (spaceId:string,model:HealthModelKey,id:string,version:number) =>
  api<void>(recordsPath(spaceId,model)+'/'+encodeURIComponent(id),{method:'DELETE',body:JSON.stringify({version})})
