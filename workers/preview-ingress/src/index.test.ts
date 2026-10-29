import {describe,expect,it,vi} from 'vitest'
import {handlePreviewIngress,type PreviewIngressEnv} from './index'

const token='header.synthetic.signature'
const env:PreviewIngressEnv={
  ACCESS_AUDIENCE:'synthetic-product-audience',
  HEALTH_PREVIEW_URL:'https://staging-demo.example.workers.dev',
  UPSTREAM_ACCESS_CLIENT_ID:'synthetic-service-id',
  UPSTREAM_ACCESS_CLIENT_SECRET:'synthetic-service-secret',
}
const ctx={access:{aud:'synthetic-product-audience'}}
function request(path='/health/api/v1/spaces',options:RequestInit={}) {
  const headers=new Headers(options.headers)
  headers.set('Cf-Access-Jwt-Assertion',token)
  return new Request('https://preview.example.com'+path,{...options,headers})
}
describe('shared Preview ingress',()=>{
  it('denies missing or mismatched verified Access context and forged proofs',async()=>{
    const f=vi.fn(async()=>new Response('never'))
    expect((await handlePreviewIngress(request(),env,{},f)).status).toBe(403)
    expect((await handlePreviewIngress(request(),env,{access:{aud:'wrong'}},f)).status).toBe(403)
    const missing=request()
    missing.headers.delete('Cf-Access-Jwt-Assertion')
    expect((await handlePreviewIngress(missing,env,ctx,f)).status).toBe(401)
    expect(f).not.toHaveBeenCalled()
  })
  it('only exposes configured surface paths, never a generic HTTP proxy',async()=>{
    const f=vi.fn(async()=>new Response('never'))
    expect((await handlePreviewIngress(request('/admin'),env,ctx,f)).status).toBe(404)
    expect((await handlePreviewIngress(request('/assistant/'),env,ctx,f)).status).toBe(404)
    expect((await handlePreviewIngress(request('/health/',{method:'OPTIONS'}),env,ctx,f)).status).toBe(405)
    expect(f).not.toHaveBeenCalled()
  })
  it('fails closed if upstream access is unconfigured or URL is unsafe',async()=>{
    const f=vi.fn(async()=>new Response('never'))
    expect((await handlePreviewIngress(request(),{...env,HEALTH_PREVIEW_URL:undefined},ctx,f)).status).toBe(503)
    expect((await handlePreviewIngress(request(),{...env,HEALTH_PREVIEW_URL:'https://core.example.com'},ctx,f)).status).toBe(503)
    expect((await handlePreviewIngress(request(),{...env,HEALTH_PREVIEW_URL:'https://demo.example.workers.dev'},ctx,f)).status).toBe(503)
    expect((await handlePreviewIngress(request(),{...env,UPSTREAM_ACCESS_CLIENT_SECRET:undefined},ctx,f)).status).toBe(503)
    expect(f).not.toHaveBeenCalled()
  })
  it('passes original verified user JWT inside a service-authenticated upstream request',async()=>{
    const f=vi.fn(async(req:Request)=>{
      expect(req.url).toBe('https://staging-demo.example.workers.dev/health/api/v1/spaces?limit=2')
      expect(req.headers.get('X-Aloha-Access-Assertion')).toBe(token)
      expect(req.headers.get('CF-Access-Client-Id')).toBe(env.UPSTREAM_ACCESS_CLIENT_ID)
      expect(req.headers.get('CF-Access-Client-Secret')).toBe(env.UPSTREAM_ACCESS_CLIENT_SECRET)
      expect(req.headers.has('Cookie')).toBe(false)
      expect(req.headers.has('Authorization')).toBe(false)
      expect(req.headers.has('Cf-Access-Jwt-Assertion')).toBe(false)
      return Response.json({ok:true},{headers:{'Set-Cookie':'private=should-not-leak'}})
    })
    const req=request('/health/api/v1/spaces?limit=2',{headers:{cookie:'CF_Authorization=synthetic','authorization':'Bearer fake-user'}})
    const response=await handlePreviewIngress(req,env,ctx,f)
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(f).toHaveBeenCalledOnce()
  })
  it('rejects cross-origin writes and normalizes only same-origin mutation origin',async()=>{
    const f=vi.fn(async(req:Request)=>{
      expect(req.headers.get('origin')).toBe('https://staging-demo.example.workers.dev')
      expect(req.method).toBe('PATCH')
      return Response.json({ok:true})
    })
    const body=JSON.stringify({value:1})
    const forbidden=request('/health/api/v1/spaces',{method:'PATCH',body,headers:{origin:'https://evil.example.com'}})
    expect((await handlePreviewIngress(forbidden,env,ctx,f)).status).toBe(403)
    expect(f).not.toHaveBeenCalled()
    const allowed=request('/health/api/v1/spaces',{method:'PATCH',body,headers:{origin:'https://preview.example.com'}})
    expect((await handlePreviewIngress(allowed,env,ctx,f)).status).toBe(200)
    expect(f).toHaveBeenCalledOnce()
  })
  it('does not redirect browsers to upstream hostnames',async()=>{
    const response=await handlePreviewIngress(request('/health/'),env,ctx,async()=>Response.redirect('https://staging-demo.example.workers.dev/private',302))
    expect(response.status).toBe(502)
  })
})
