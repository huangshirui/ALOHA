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
    const message = response.status === 401 ? '请先通过 Access 登录' : response.status === 403 ? '当前用户没有该空间或模型的访问权限' : response.status === 404 ? '健康模型尚未发布，或记录不存在' : response.status === 409 ? '记录已被更新，请刷新后重试' : response.status === 503 ? '后台尚未配置或暂不可用' : '请求失败'
    throw new Error('Health API ' + response.status + ': ' + message)
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
// Person is resolved by the trusted BFF from current verified Principal + membership.
export const getOwnSpacePerson = (spaceId:string) =>
  api<{personId:string}>(`/spaces/${encodeURIComponent(spaceId)}/own-person`)
/** One bounded response; Core authorization is checked independently for all 7 models. */
export interface HealthSnapshot {
  personId:string
  models:Partial<Record<HealthModelKey,HealthRecord[]>>
  presentation:{items:import('./health-presentation').ConcernPresentation[]}
}
export const getHealthSnapshot = (spaceId:string,models:HealthModelKey[]) =>{
  const params=new URLSearchParams({models:models.join(',')})
  return api<HealthSnapshot>(`/spaces/${encodeURIComponent(spaceId)}/snapshot?${params}`)
}
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

/** ALOHA-owned UI projection, not canonical LifeSpace model fields. */
import type { ConcernPresentation } from './health-presentation'
const presentationPath = (spaceId:string) =>
  `/spaces/${encodeURIComponent(spaceId)}/presentation/concerns`
export const listConcernPresentation = (spaceId:string) =>
  api<{items:ConcernPresentation[]}>(presentationPath(spaceId))
export const patchConcernPresentation = (
  spaceId:string,concernId:string,patch:{
    attention?:ConcernPresentation['attention']
    placement?:ConcernPresentation['placement']
  },
) => api<ConcernPresentation>(presentationPath(spaceId)+'/'+encodeURIComponent(concernId),
  {method:'PATCH',body:JSON.stringify(patch)})
export const deleteConcernPresentation = (spaceId:string,concernId:string) =>
  api<void>(presentationPath(spaceId)+'/'+encodeURIComponent(concernId),{method:'DELETE',body:'{}'})

/** Bytes travel only to the same-origin BFF. Browser progress measures this
 * hop exactly; the BFF->R2/finalization phase is shown as 'processing', never
 * as a fabricated 100%-complete saved document.
 */
export type FileUploadProgress =
  | {phase:'uploading';percent:number|null}
  | {phase:'processing';percent:100}
export function uploadHealthDocument(
  spaceId:string,file:File,fields:Record<string,unknown>,
  onProgress:(progress:FileUploadProgress)=>void=()=>{},
):Promise<HealthRecord> {
  const form=new FormData()
  form.append('file',file,file.name)
  for(const key of ['title','documentType','issuedDate','issuerName','eventId','notes'])
    form.append(key,typeof fields[key]==='string'?String(fields[key]):'')
  return new Promise<HealthRecord>((resolve,reject)=>{
    const xhr=new XMLHttpRequest()
    xhr.open('POST',base+'/spaces/'+encodeURIComponent(spaceId)+'/documents/upload')
    xhr.withCredentials=true
    xhr.timeout=180000
    let transferred=false
    onProgress({phase:'uploading',percent:0})
    xhr.upload.onprogress=(event:ProgressEvent)=>{
      if(transferred)return
      const percent=event.lengthComputable && event.total>0
        ?Math.min(99,Math.max(0,Math.round(event.loaded/event.total*100)))
        :null
      onProgress({phase:'uploading',percent})
    }
    xhr.upload.onload=()=>{
      transferred=true
      onProgress({phase:'processing',percent:100})
    }
    xhr.onerror=()=>reject(new Error('文件上传连接失败，请重试'))
    xhr.ontimeout=()=>reject(new Error('上传超时，请检查网络后重试'))
    xhr.onabort=()=>reject(new Error('上传已取消'))
    xhr.onload=()=>{
      if(xhr.status<200||xhr.status>=300){
        const detail=xhr.status===413?'文件大小超过 15 MB 限制':
          xhr.status===415?'请上传有效的 PDF、PNG、JPEG 或 WebP 文件':
          xhr.status===403?'没有上传该资料的权限':
          xhr.status===503?'文件服务暂不可用，请稍后重试':
          xhr.status===422?'请检查资料类型和日期':
          '上传失败（HTTP '+xhr.status+'），请重试'
        reject(new Error(detail));return
      }
      try {
        const payload:unknown=JSON.parse(xhr.responseText)
        if(!payload||typeof payload!=='object'||!('data' in payload))
          throw new Error('文件上传响应无效')
        resolve((payload as {data:HealthRecord}).data)
      }catch{reject(new Error('文件上传响应无效'))}
    }
    xhr.send(form)
  })
}
export async function downloadHealthDocument(spaceId:string,recordId:string):Promise<void>{
  const url=base+'/spaces/'+encodeURIComponent(spaceId)+'/documents/'+encodeURIComponent(recordId)+'/download'
  const response=await fetch(url,{credentials:'same-origin'})
  if(!response.ok)throw new Error('文件下载失败（HTTP '+response.status+'）')
  const header=response.headers.get('Content-Disposition')??''
  const encoded=/filename\*=UTF-8''([^;]+)/i.exec(header)?.[1]
  let name='健康资料'
  if(encoded)try{name=decodeURIComponent(encoded)}catch{/* Use safe fallback. */}
  const objectUrl=URL.createObjectURL(await response.blob())
  try {
    const link=document.createElement('a')
    link.href=objectUrl;link.download=name
    document.body.append(link);link.click();link.remove()
  } finally {URL.revokeObjectURL(objectUrl)}
}
