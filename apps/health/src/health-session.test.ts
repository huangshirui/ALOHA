import { describe,expect,it } from 'vitest'
import {
  HEALTH_SESSION_COOKIE,readHealthSession,makeHealthSessionCookie,
  signedTokenSubject,clearHealthSessionCookie,
} from './health-session'
const assertion='eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.fake'
const bearer='synthetic.header.signature'
const secret='lsa_synthetic_cookie_only_test'
const user='usr_synthetic'
const req=(value:string)=>new Request('https://health.example.com/health/api/v1/spaces',{
  headers:{Cookie:value.split(';')[0]!},
})
describe('Health encrypted session',()=>{
  it('encrypts a short-lived token and binds it to the original Access proof',async()=>{
    const cookie=await makeHealthSessionCookie(secret,assertion,bearer,600,user)
    expect(cookie).toContain(HEALTH_SESSION_COOKIE+'=')
    expect(cookie).toContain('Secure; HttpOnly; SameSite=Lax')
    expect(cookie).not.toContain(bearer)
    expect(cookie).not.toContain(user)
    expect(cookie).not.toContain(secret)
    const s=await readHealthSession(req(cookie!),secret,assertion)
    expect(s).toMatchObject({accessToken:bearer,userId:user})
    expect(await readHealthSession(req(cookie!),secret,assertion+'new')).toBeNull()
    expect(await readHealthSession(req(cookie!),'lsa_different',assertion)).toBeNull()
  })
  it('fails closed on tampering, expiry, and key rotation',async()=>{
    const now=Date.UTC(2026,9,29,15)
    const cookie=await makeHealthSessionCookie(secret,assertion,bearer,60,user,now)
    expect(cookie).toBeTruthy()
    const raw=cookie!.split(';')[0]!
    expect(await readHealthSession(req(cookie!),secret,assertion,now+70000)).toBeNull()
    const tampered=raw.slice(0,-1)+(raw.at(-1)==='A'?'B':'A')
    expect(await readHealthSession(req(tampered),secret,assertion,now)).toBeNull()
    expect(await readHealthSession(req(cookie!),secret,assertion,now)).toMatchObject({userId:user})
    expect(clearHealthSessionCookie()).toContain('Max-Age=0')
  })
  it('accepts only an explicit usr_* JWT subject from a previously issued token',()=>{
    const encoded=btoa(JSON.stringify({sub:user})).replace(/=/g,'')
    expect(signedTokenSubject('header.'+encoded+'.sig')).toBe(user)
    expect(signedTokenSubject('invalid')).toBeNull()
    expect(signedTokenSubject('header.'+btoa(JSON.stringify({sub:'other'}))+'.sig')).toBeNull()
  })
})
