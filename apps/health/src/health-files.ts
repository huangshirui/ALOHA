/** Bounded HealthDocument transfer. Bytes transit the trusted BFF, never an arbitrary client URL.
 * LifeSpace Core owns File identity, R2 signing, completion, attachment and permissions.
 */
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
const error = (code:string,status:number) =>
  Response.json({error:code},{status,headers:{'Cache-Control':'no-store'}})
const filePath = (spaceId:string) => '/api/v1/spaces/'+spaceId
const allowMime:Record<string,string> = {
  '.pdf':'application/pdf','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp',
}
export const MAX_HEALTH_DOCUMENT_BYTES = 15 * 1024 * 1024
const pattern = /^fil_[0-9a-f]{32}$/
const responseData = async (response:Response):Promise<Record<string,unknown>|null> => {
  const body:unknown=await response.json().catch(()=>null)
  return body && typeof body==='object' && 'data' in body
    && body.data && typeof body.data==='object' && !Array.isArray(body.data)
    ? body.data as Record<string,unknown> : null
}
async function fromCore(fetcher:Fetcher,url:string,bearer:string,method:'POST'|'DELETE',data?:object):Promise<Response> {
  return fetcher(new URL(url),{
    method,redirect:'manual',
    headers:{Authorization:'Bearer '+bearer,Accept:'application/json',
      ...(data===undefined?{}:{'Content-Type':'application/json'})},
    ...(data===undefined?{}:{body:JSON.stringify(data)}),
  })
}
const bounded=(input:FormData,key:string,max:number,required=false):string|null=>{
  const value=input.get(key)
  if(value===null || value==='')return required?null:null
  if(typeof value!=='string'||value.trim().length>max||/[\u0000-\u001f]/u.test(value))return null
  return value.trim()
}
export function safeSignedR2Url(value:unknown):value is string {
  if(typeof value!=='string')return false
  try {
    const u=new URL(value)
    return u.protocol==='https:' && /^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(u.hostname)
      && !u.username&&!u.password && u.pathname.length>3 && !u.hash
  }catch{return false}
}
function contentType(file:File):string|null {
  const suffix=/\.[a-z0-9]+$/i.exec(file.name)?.[0].toLowerCase()
  const mime=suffix?allowMime[suffix]:undefined
  return mime && (!file.type || file.type.toLowerCase()===mime)?mime:null
}
async function validMagic(file:File,mime:string):Promise<boolean> {
  const b=new Uint8Array(await file.slice(0,16).arrayBuffer())
  if(mime==='application/pdf')return String.fromCharCode(...b.slice(0,5))==='%PDF-'
  if(mime==='image/png')return [137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v)
  if(mime==='image/jpeg')return b[0]===255 && b[1]===216 && b[2]===255
  if(mime==='image/webp')return String.fromCharCode(...b.slice(0,4))==='RIFF' && String.fromCharCode(...b.slice(8,12))==='WEBP'
  return false
}
export async function uploadHealthDocument(
  request:Request,fetcher:Fetcher,core:string,bearer:string,spaceId:string,personId:string,
):Promise<Response> {
  if(Number(request.headers.get('Content-Length')??0)>MAX_HEALTH_DOCUMENT_BYTES+65536)
    return error('file_too_large',413)
  let form:FormData
  try {form=await request.formData()}catch{return error('invalid_upload_form',400)}
  if([...form.keys()].some(k=>!['file','title','documentType','issuedDate','issuerName','eventId','notes'].includes(k)))
    return error('invalid_upload_form',400)
  const file=form.get('file')
  if(!(file instanceof File)||!file.name||file.name.length>200||/[\u0000-\u001f]/u.test(file.name))
    return error('file_required',400)
  if(file.size<1||file.size>MAX_HEALTH_DOCUMENT_BYTES)return error('file_too_large',413)
  const mime=contentType(file)
  if(!mime || !await validMagic(file,mime))return error('file_type_unsupported',415)
  const title=bounded(form,'title',200,true)
  const documentType=bounded(form,'documentType',50,true)
  const issuedDate=bounded(form,'issuedDate',10)
  const issuerName=bounded(form,'issuerName',200)
  const eventId=bounded(form,'eventId',128)
  const notes=bounded(form,'notes',4000)
  if(!title || !documentType ||
    !['lab_report','imaging_report','physical_exam','prescription','visit_note','discharge_summary','rehabilitation_plan','other'].includes(documentType) ||
    (form.get('issuedDate') && (!issuedDate || !/^\d{4}-\d{2}-\d{2}$/.test(issuedDate))) ||
    (form.get('eventId') && (!eventId||!/^rec_[A-Za-z0-9_-]+$/.test(eventId))) ||
    (form.get('issuerName') && issuerName===null) || (form.get('notes') && notes===null))
    return error('document_invalid',422)
  const root=core+filePath(spaceId)
  const timing:Record<string,number>={}
  const measure=async<T>(name:string,operation:()=>Promise<T>):Promise<T>=>{
    const started=performance.now()
    try{return await operation()}finally{timing[name]=Math.round(performance.now()-started)}
  }
  let createdFileId:string|null=null
  try {
    const init=await measure('upload_init',()=>fromCore(fetcher,root+'/file-uploads',bearer,'POST',{
      modelKey:'health_document',fieldKey:'artifactRef',
      name:file.name,contentType:mime,size:file.size,
    }))
    if(!init.ok)return error('file_upload_not_available',init.status>=400&&init.status<500?init.status:502)
    const session=await responseData(init)
    const upload=session?.upload
    if(typeof session?.id!=='string'||!/^upl_[0-9a-f]{32}$/.test(session.id) ||
        !upload||typeof upload!=='object'||Array.isArray(upload))
      return error('invalid_file_session',502)
    const transfer=upload as Record<string,unknown>
    const signedUploadUrl=transfer.url
    if(transfer.method!=='PUT'||!safeSignedR2Url(signedUploadUrl))return error('invalid_file_session',502)
    const put=await measure('r2_put',()=>fetcher(new URL(signedUploadUrl),{
      method:'PUT',redirect:'manual',headers:{'Content-Type':mime},body:file,
    }))
    if(!put.ok)return error('file_transfer_failed',502)
    const completed=await measure('file_complete',()=>fromCore(fetcher,root+'/file-uploads/'+session.id+'/complete',bearer,'POST'))
    if(!completed.ok)return error('file_finalize_failed',502)
    const result=await responseData(completed)
    if(typeof result?.id!=='string'||!pattern.test(result.id))return error('invalid_file_reference',502)
    createdFileId=result.id
    const saved=await measure('record_create',()=>fromCore(fetcher,root+'/models/health_document/records',bearer,'POST',{
      subjectPersonId:personId,title,documentType,issuedDate:issuedDate||null,
      issuerName:issuerName||null,eventId:eventId||null,notes:notes||null,artifactRef:createdFileId,
    }))
    if(!saved.ok)return error('document_create_failed',saved.status>=400&&saved.status<500?saved.status:502)
    const document=await responseData(saved)
    if(!document || typeof document.id!=='string')return error('document_invalid_response',502)
    createdFileId=null
    // Numbers only: never expose R2 signed URL, File IDs, health data or credentials.
    const report=Object.entries(timing).map(([key,ms])=>key+';dur='+ms).join(', ')
    console.log(JSON.stringify({event:'health_document_upload_timing',durations_ms:timing}))
    return Response.json({data:document},{status:201,headers:{
      'Cache-Control':'no-store','Server-Timing':report,
    }})
  }catch{
    return error('file_upload_unavailable',503)
  }finally{
    // A completed File is not yet linked if record creation fails. Best-effort cleanup.
    if(createdFileId)await fromCore(fetcher,root+'/files/'+createdFileId,bearer,'DELETE').catch(()=>{})
  }
}
export async function downloadHealthDocument(
  fetcher:Fetcher,core:string,bearer:string,spaceId:string,recordId:string,fileId:string,
):Promise<Response> {
  if(!pattern.test(fileId))return error('document_file_missing',404)
  try {
    const start=await fromCore(fetcher,core+filePath(spaceId)+'/file-downloads',bearer,'POST',{
      modelKey:'health_document',recordId,fieldKey:'artifactRef',fileId,
    })
    if(!start.ok)return error('document_file_unavailable',start.status>=400&&start.status<500?start.status:502)
    const signed=await responseData(start)
    if(!safeSignedR2Url(signed?.url))return error('invalid_file_download',502)
    const file=await fetcher(new URL(signed.url),{method:'GET',redirect:'manual'})
    if(!file.ok||!file.body)return error('file_download_failed',502)
    const name=typeof signed.name==='string'&&signed.name.length<200?signed.name:'health-document'
    const mime=typeof signed.contentType==='string'&&Object.values(allowMime).includes(signed.contentType)
      ?signed.contentType:'application/octet-stream'
    return new Response(file.body,{status:200,headers:{
      'Content-Type':mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
      'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(name),
    }})
  }catch{return error('file_download_unavailable',503)}
}
