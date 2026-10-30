import {describe,it,expect,vi,afterEach} from 'vitest'
import {getProfile,getSpaces,SettingsApiError} from './api'
afterEach(()=>vi.unstubAllGlobals())
describe('Settings current-origin authentication errors',()=>{
  it('describes a 401 as no Access assertion, not an account-wide logout',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>Response.json(
      {error:'access_required'},{status:401})))
    await expect(getProfile()).rejects.toMatchObject({
      name:'SettingsApiError',status:401,code:'access_required',
    })
    try{await getSpaces()}catch(e){
      expect((e as SettingsApiError).message).toContain('缺少有效的 Cloudflare Access')
      expect((e as SettingsApiError).message).not.toContain('请先登录 ALOHA')
    }
  })
  it('does not mistake Core 403 for missing Access authentication',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(
      JSON.stringify({error:'access_denied'}),{status:403,headers:{'Content-Type':'application/json'}})))
    await expect(getSpaces()).rejects.toMatchObject({
      name:'SettingsApiError',status:403,code:'access_denied',
    })
  })
  it('shows the registered-AUD error rather than treating it as an expired browser login',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json(
      {error:'audience_not_registered'},{status:403})))
    try { await getProfile(); throw new Error('Expected denial') }
    catch(e) {
      expect(e).toMatchObject({status:403,code:'audience_not_registered'})
      expect((e as Error).message).toContain('Access Audience')
      expect((e as Error).message).not.toContain('登录凭证')
    }
  })
  it('distinguishes an invalid backend application credential from missing Access proof',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json(
      {error:'identity_application_unauthorized'},{status:503})))
    try { await getProfile(); throw new Error('Expected denial') }
    catch(e) {
      expect(e).toMatchObject({status:503,code:'identity_application_unauthorized'})
      expect((e as Error).message).toContain('应用凭据')
      expect((e as Error).message).not.toContain('登录凭证')
    }
  })
  it('loads profile independently from spaces if Core fails',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(input:string)=>{
      if(input.endsWith('/me'))return Response.json({data:{displayName:'Synthetic Account',avatarUrl:null}})
      return Response.json({error:'spaces_unavailable'},{status:503})
    }))
    const result=await Promise.allSettled([getProfile(),getSpaces()])
    expect(result[0]).toEqual({status:'fulfilled',value:{displayName:'Synthetic Account',avatarUrl:null}})
    expect(result[1].status).toBe('rejected')
  })
})
