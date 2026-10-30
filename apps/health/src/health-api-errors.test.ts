import {afterEach,describe,expect,it,vi} from 'vitest'
import {getHealthSnapshot,HealthApiError,listAuthorizedSpaces} from './health-api'

afterEach(()=>vi.unstubAllGlobals())

function mockResponse(status:number,payload:unknown){
  const fetcher=vi.fn(async()=>Response.json(payload,{status}))
  vi.stubGlobal('fetch',fetcher)
  return fetcher
}
describe('Health API failure classification',()=>{
  it('distinguishes missing published model from missing record',async()=>{
    mockResponse(404,{error:{code:'MODEL_NOT_FOUND',message:'synthetic private details'}})
    await expect(getHealthSnapshot('spc_synthetic',['health_concern'])).rejects.toMatchObject({
      status:404,code:'MODEL_NOT_FOUND',
    })
    await expect(getHealthSnapshot('spc_synthetic',['health_concern']))
      .rejects.toThrow('尚未发布健康模型')
  })
  it('does not leak an arbitrary upstream error body into the user interface',async()=>{
    mockResponse(404,{error:{code:'SYNTHETIC_PRIVATE_CODE',message:'sensitive synthetic private details'}})
    try{
      await getHealthSnapshot('spc_synthetic',['health_concern'])
      throw new Error('unexpected success')
    }catch(e){
      expect(e).toBeInstanceOf(HealthApiError)
      const err=e as HealthApiError
      expect(err.message).toContain('空间、记录或服务不存在')
      expect(err.message).not.toContain('synthetic private')
      expect(err.code).toBeNull()
    }
  })
  it('never mistakes a missing Space selection for a model error',async()=>{
    const fetcher=mockResponse(200,{data:[]})
    expect(await listAuthorizedSpaces()).toEqual([])
    expect(fetcher).toHaveBeenCalledOnce()
  })
  it('explains missing linked Person separately from a model registry failure',async()=>{
    mockResponse(409,{error:'own_person_not_linked'})
    await expect(getHealthSnapshot('spc_synthetic',['health_concern']))
      .rejects.toThrow('尚未关联你的人员档案')
  })
})
