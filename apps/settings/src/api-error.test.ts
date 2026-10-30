import {describe,it,expect,vi,afterEach} from 'vitest'
import {getProfile,getSpaces,SettingsApiError} from './api'
afterEach(()=>vi.unstubAllGlobals())
describe('Settings current-origin authentication errors',()=>{
  it('describes a 401 as no Access assertion, not an account-wide logout',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(
      JSON.stringify({error:'access_required'}),{status:401,headers:{'Content-Type':'application/json'}})))
    await expect(getProfile()).rejects.toMatchObject({
      name:'SettingsApiError',status:401,code:'access_required',
    })
    try{await getSpaces()}catch(e){
      expect((e as SettingsApiError).message).toContain('当前站点没有有效的 Access')
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
