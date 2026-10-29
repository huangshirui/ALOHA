import { describe, expect, it, vi } from 'vitest'
import { downloadHealthDocument, safeSignedR2Url, uploadHealthDocument } from './health-files'
import { handleHealthApi } from './worker'

const space='spc_synthetic'
const doc='rec_synthetic_doc'
const fileId='fil_'+'a'.repeat(32)
const uploadId='upl_'+'b'.repeat(32)
const signature='https://'+'0'.repeat(32)+'.r2.cloudflarestorage.com/health-upload?X-Amz-Signature=example'
const header={'Cf-Access-Jwt-Assertion':'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.fake'}
const env={
  LIFESPACE_IDENTITY_BASE_URL:'https://identity.example.com',
  LIFESPACE_CORE_BASE_URL:'https://core.example.com',
  LIFESPACE_APPLICATION_CREDENTIAL:'lsa_synthetic_only',
}
const pdf=new File([new TextEncoder().encode('%PDF-1.7\nSynthetic test document')],'report.pdf',{type:'application/pdf'})
const form=()=> {
  const body=new FormData()
  body.append('file',pdf);body.append('title','Test report');body.append('documentType','lab_report')
  body.append('issuedDate','2026-10-01')
  return body
}
const data=(value:unknown,status=200)=>Response.json({data:value},{status})
const auth=(input:RequestInfo|URL):string=>new URL(String(input)).pathname
function createFetcher() {
  const visits:string[]=[]
  const f=vi.fn(async (input:RequestInfo|URL,init?:RequestInit):Promise<Response>=>{
    const url=new URL(String(input)),p=url.pathname
    visits.push(p)
    if(p==='/internal/v1/access/tokens')return data({accessToken:'bearer_synthetic'})
    if(p==='/api/v1/me')return data({principal:{type:'user',id:'usr_synthetic'}})
    if(p===`/api/v1/spaces/${space}/members`)return data([{userId:'usr_synthetic',personId:'per_synthetic'}])
    if(p.endsWith('/file-uploads')) {
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body))).toMatchObject({
        modelKey:'health_document',fieldKey:'artifactRef',name:'report.pdf',
        size:pdf.size,contentType:'application/pdf',
      })
      return data({id:uploadId,upload:{url:signature,method:'PUT'}},201)
    }
    if(p.endsWith('/health-upload')) {
      expect(init?.redirect).toBe('manual')
      expect(init?.method).toBe('PUT')
      expect(init?.body).toBeInstanceOf(File)
      expect((init?.body as File).size).toBe(pdf.size)
      return new Response(null,{status:200})
    }
    if(p.endsWith('/complete'))return data({id:fileId})
    if(p.endsWith('/models/health_document/records')&&init?.method==='POST') {
      expect(JSON.parse(String(init.body))).toMatchObject({
        subjectPersonId:'per_synthetic',artifactRef:fileId,title:'Test report',
      })
      return data({id:doc,version:1,artifactRef:fileId,title:'Test report'},201)
    }
    if(p.endsWith('/models/health_document/records/'+doc))return data({
      id:doc,subjectPersonId:'per_synthetic',artifactRef:fileId,
    })
    if(p.endsWith('/file-downloads'))return data({
      url:signature,name:'report.pdf',contentType:'application/pdf',
    })
    if(p.endsWith('/files/'+fileId))return new Response(null,{status:204})
    throw new Error('Unexpected synthetic route '+p)
  })
  return {f,visits}
}
describe('HealthDocument Core-backed file transfer',()=>{
  it('creates a file session, transfers real bytes, finalizes and attaches a fil_*',async()=>{
    const {f,visits}=createFetcher()
    const request=new Request('https://health.example.com/health/api/v1/spaces/'+space+'/documents/upload',{
      method:'POST',headers:{...header,Origin:'https://health.example.com'},body:form(),
    })
    const response=await handleHealthApi(request,env,f)
    expect(response.status).toBe(201)
    expect((await response.json()).data.artifactRef).toBe(fileId)
    expect(visits).toContain('/health-upload')
    expect(visits).toContain('/api/v1/spaces/'+space+'/file-uploads/'+uploadId+'/complete')
    expect(visits.at(-1)).toBe('/api/v1/spaces/'+space+'/models/health_document/records')
  })
  it('rejects files with unsupported MIME or forged bytes before creating a file session',async()=>{
    const {f}=createFetcher()
    const bad=new FormData()
    bad.append('file',new File(['fake'],'fake.pdf',{type:'application/pdf'}))
    bad.append('title','Fake');bad.append('documentType','lab_report')
    const r=await uploadHealthDocument(new Request('https://health.example.com',{method:'POST',body:bad}),
      f,env.LIFESPACE_CORE_BASE_URL,'bearer_synthetic',space,'per_synthetic')
    expect(r.status).toBe(415)
    expect(f).not.toHaveBeenCalled()
  })
  it('rejects unsigned or arbitrary destinations and cannot turn into SSRF',()=>{
    expect(safeSignedR2Url(signature)).toBe(true)
    expect(safeSignedR2Url('https://evil.example.com/u')).toBe(false)
    expect(safeSignedR2Url('http://'+'0'.repeat(32)+'.r2.cloudflarestorage.com/u')).toBe(false)
    expect(safeSignedR2Url('https://'+'0'.repeat(32)+'.r2.cloudflarestorage.com.evil.example/u')).toBe(false)
  })
  it('uses LifeSpace File download authority and emits no signed URL to the browser',async()=>{
    const fetcher=vi.fn(async(input:RequestInfo|URL)=>{
      if(auth(input).endsWith('/file-downloads')) return data({
        url:signature,name:'report.pdf',contentType:'application/pdf',
      })
      if(auth(input)==='/health-upload')return new Response(pdf,{status:200})
      throw new Error('Unexpected route')
    })
    const r=await downloadHealthDocument(fetcher,env.LIFESPACE_CORE_BASE_URL,'bearer_synthetic',space,doc,fileId)
    expect(r.status).toBe(200)
    expect(r.headers.get('content-disposition')).toContain('report.pdf')
    expect(r.headers.get('cache-control')).toContain('no-store')
    expect(await r.text()).toContain('%PDF-1.7')
    expect(r.headers.get('location')).toBeNull()
  })
  it('attempts cleanup of the unlinked fil_* if the final document write fails',async()=>{
    const calls:string[]=[]
    const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit):Promise<Response>=>{
      const p=auth(input)
      calls.push(p)
      if(p.endsWith('/file-uploads'))return data({id:uploadId,upload:{url:signature,method:'PUT'}},201)
      if(p==='/health-upload')return new Response(null,{status:200})
      if(p.endsWith('/complete'))return data({id:fileId})
      if(p.endsWith('/models/health_document/records')&&init?.method==='POST')
        return Response.json({error:{code:'FORBIDDEN'}},{status:403})
      if(p.endsWith('/files/'+fileId)&&init?.method==='DELETE')
        return new Response(null,{status:204})
      throw new Error('Unexpected synthetic path '+p)
    })
    const res=await uploadHealthDocument(
      new Request('https://health.example.com',{method:'POST',body:form()}),
      fetcher,env.LIFESPACE_CORE_BASE_URL,'bearer_synthetic',space,'per_synthetic')
    expect(res.status).toBe(403)
    expect(calls.at(-1)).toBe('/api/v1/spaces/'+space+'/files/'+fileId)
    expect(JSON.stringify(await res.json())).not.toContain(signature)
  })
  it('checks verified person before allowing document download',async()=>{
    const calls:string[]=[]
    const fetcher=vi.fn(async(input:RequestInfo|URL):Promise<Response>=>{
      const p=auth(input);calls.push(p)
      if(p==='/internal/v1/access/tokens')return data({accessToken:'bearer_synthetic'})
      if(p==='/api/v1/me')return data({principal:{type:'user',id:'usr_synthetic'}})
      if(p.endsWith('/members'))return data([{userId:'usr_synthetic',personId:'per_synthetic'}])
      if(p.endsWith('/models/health_document/records/'+doc))return data({
        id:doc,subjectPersonId:'per_another',artifactRef:fileId,
      })
      throw new Error('Unauthorized downstream request '+p)
    })
    const response=await handleHealthApi(new Request(
      'https://health.example.com/health/api/v1/spaces/'+space+'/documents/'+doc+'/download',
      {headers:header}),env,fetcher)
    expect(response.status).toBe(403)
    expect(calls).not.toContain('/api/v1/spaces/'+space+'/file-downloads')
  })
  it('denies requests without Access proof or same-origin mutation',async()=>{
    const {f}=createFetcher()
    const missing=new Request('https://health.example.com/health/api/v1/spaces/'+space+'/documents/upload',{
      method:'POST',body:form(),
    })
    expect((await handleHealthApi(missing,env,f)).status).toBe(403)
    const invalid=new Request('https://health.example.com/health/api/v1/spaces/'+space+'/documents/upload',{
      method:'POST',headers:{Origin:'https://health.example.com'},body:form(),
    })
    expect((await handleHealthApi(invalid,env,f)).status).toBe(401)
    expect(f).not.toHaveBeenCalled()
  })
})
