import {describe,expect,it} from 'vitest'
import {readHealthSession,makeHealthSessionCookie} from '../src/health-session'
import {handleHealthApi} from '../src/worker'

const assertion='eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.fake'
const credential='lsa_synthetic_worker_test_only'
const user='usr_synthetic'
const token='header.'+btoa(JSON.stringify({sub:user})).replace(/=/g,'')+'.signature'
const env={
  LIFESPACE_IDENTITY_BASE_URL:'https://identity.example.com',
  LIFESPACE_CORE_BASE_URL:'https://core.example.com',
  LIFESPACE_APPLICATION_CREDENTIAL:credential,
}
describe('Health sessions in actual workerd',()=>{
  it('HKDF/AES-GCM can encrypt, decrypt and reject tampering in Workers',async()=>{
    const cookie=await makeHealthSessionCookie(credential,assertion,token,600,user)
    expect(cookie).toContain('HttpOnly')
    const request=new Request('https://health.example.com/health/api/v1/spaces',{
      headers:{cookie:cookie!.split(';')[0]!},
    })
    expect(await readHealthSession(request,credential,assertion)).toMatchObject({userId:user,accessToken:token})
    expect(await readHealthSession(request,credential,assertion+'other')).toBeNull()
  })
  it('reuses a verified token without repeating the Identity exchange',async()=>{
    const fetched:string[]=[]
    const upstream=async(input:RequestInfo|URL)=>{
      const p=new URL(String(input)).pathname
      fetched.push(p)
      if(p==='/internal/v1/access/tokens')return Response.json({data:{accessToken:token,expiresIn:600}})
      if(p==='/internal/v1/access/session-check')return Response.json({data:{userId:user}})
      if(p==='/api/v1/me/spaces')return Response.json({data:[{id:'spc_synthetic'}]})
      throw new Error('Unexpected synthetic request '+p)
    }
    const url='https://health.example.com/health/api/v1/spaces'
    const first=await handleHealthApi(new Request(url,{headers:{'Cf-Access-Jwt-Assertion':assertion}}),env,upstream)
    expect(first.status).toBe(200)
    const cookie=first.headers.get('set-cookie')!.split(';')[0]!
    const second=await handleHealthApi(new Request(url,{
      headers:{'Cf-Access-Jwt-Assertion':assertion,Cookie:cookie},
    }),env,upstream)
    expect(second.status).toBe(200)
    expect(fetched.filter(p=>p==='/internal/v1/access/tokens')).toHaveLength(1)
    expect(fetched.filter(p=>p==='/internal/v1/access/session-check')).toHaveLength(1)
  })
})
