/**
 * Health's short-lived encrypted first-party session, derived from the existing
 * server-only LifeSpace Application credential with HKDF domain separation.
 * Avoids a new deployment secret; rotating the app credential invalidates sessions.
 * No plaintext JWT/token or private health data is exposed to browser JavaScript.
 * Identity independently verifies the Cloudflare Access assertion on EACH request.
 */
export const HEALTH_SESSION_COOKIE = '__Host-aloha_health_session'
const VERSION=1
const encoder=new TextEncoder()
const decoder=new TextDecoder()
type CookiePayload={v:number;token:string;userId:string;exp:number;fingerprint:string}
const encode=(bytes:Uint8Array):string=>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
function decode(value:string):Uint8Array {
  const padded=value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4)
  return Uint8Array.from(atob(padded),x=>x.charCodeAt(0))
}
async function sessionKey(secret:string):Promise<CryptoKey>{
  const raw=await crypto.subtle.importKey('raw',encoder.encode(secret),'HKDF',false,['deriveKey'])
  return crypto.subtle.deriveKey({
    name:'HKDF',hash:'SHA-256',
    salt:encoder.encode('ALOHA Health first-party session v1'),
    info:encoder.encode('LifeSpace bearer cookie / distinct from application authentication'),
  },raw,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])
}
const fingerprint=async(assertion:string):Promise<string> =>
  encode(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(assertion))))
function cookie(request:Request):string|null{
  const field=request.headers.get('cookie')??''
  for(const part of field.split(';')){
    const split=part.indexOf('=')
    if(split<0)continue
    if(part.slice(0,split).trim()===HEALTH_SESSION_COOKIE)
      return part.slice(split+1).trim()
  }
  return null
}
export interface HealthSession {accessToken:string;userId:string;expiresAt:number}
export async function readHealthSession(
  request:Request,credential:string,assertion:string,now=Date.now(),
):Promise<HealthSession|null>{
  const value=cookie(request)
  if(!value||value.length>8192||!/^[-_A-Za-z0-9]+$/.test(value))return null
  try{
    const bytes=decode(value)
    if(bytes.length<29||bytes.length>6200)return null
    const iv=bytes.slice(0,12)
    const decrypted=await crypto.subtle.decrypt(
      {name:'AES-GCM',iv},await sessionKey(credential),bytes.slice(12),
    )
    const payload:unknown=JSON.parse(decoder.decode(decrypted))
    if(!payload||typeof payload!=='object')return null
    const session=payload as Partial<CookiePayload>
    if(session.v!==VERSION||typeof session.token!=='string'||
      typeof session.userId!=='string'||typeof session.exp!=='number'||
      typeof session.fingerprint!=='string'||!/^usr_[A-Za-z0-9_-]+$/.test(session.userId)||
      session.exp*1000<=now+15000)return null
    if(session.fingerprint!==await fingerprint(assertion))return null
    return {accessToken:session.token,userId:session.userId,expiresAt:session.exp*1000}
  }catch{return null}
}
export async function makeHealthSessionCookie(
  credential:string,assertion:string,token:string,expiresIn:number,
  userId:string,now=Date.now(),
):Promise<string|null>{
  if(!Number.isFinite(expiresIn)||expiresIn<=15||
    !/^usr_[A-Za-z0-9_-]+$/.test(userId)||!token)return null
  const ttl=Math.min(900,Math.max(1,Math.floor(expiresIn)-15))
  const exp=Math.floor(now/1000)+ttl
  const payload:CookiePayload={
    v:VERSION,token,userId,exp,fingerprint:await fingerprint(assertion),
  }
  const iv=crypto.getRandomValues(new Uint8Array(12))
  const encrypted=await crypto.subtle.encrypt(
    {name:'AES-GCM',iv},await sessionKey(credential),encoder.encode(JSON.stringify(payload)),
  )
  const bytes=new Uint8Array(iv.length+encrypted.byteLength)
  bytes.set(iv,0);bytes.set(new Uint8Array(encrypted),iv.length)
  return HEALTH_SESSION_COOKIE+'='+encode(bytes)+
    '; Path=/; Max-Age='+ttl+'; Secure; HttpOnly; SameSite=Lax'
}
export function clearHealthSessionCookie():string {
  return HEALTH_SESSION_COOKIE+'=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax'
}
export function signedTokenSubject(token:string):string|null{
  const segments=token.split('.')
  if(segments.length!==3||!segments[1]||segments[1].length>8192)return null
  try {
    const claims:unknown=JSON.parse(decoder.decode(decode(segments[1])))
    if(!claims||typeof claims!=='object'||!('sub' in claims))return null
    const subject=(claims as {sub:unknown}).sub
    return typeof subject==='string'&&/^usr_[A-Za-z0-9_-]+$/.test(subject)?subject:null
  }catch{return null}
}
