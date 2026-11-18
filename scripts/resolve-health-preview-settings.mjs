import fs from 'node:fs'
import {pathToFileURL} from 'node:url'

/** Only deployed, same-account, named staging Preview URLs are eligible.
 * No account hostname is committed and no request-controlled URL is used.
 */
function stagingOrigin(items,surface){
  const candidates=Array.isArray(items)?items.filter(p=>p?.name==='staging'&&p?.deployed_on):[]
  if(candidates.length!==1)throw Error('Expected one deployed named staging Preview for '+surface)
  const pattern=new RegExp('^staging-aloha-app-'+surface+'\\.([a-z0-9-]+\\.workers\\.dev)$')
  const urls=Array.isArray(candidates[0].urls)?candidates[0].urls:[]
  const accepted=new Map()
  for(const raw of urls){
    let u
    try{u=new URL(raw)}catch{continue}
    const m=pattern.exec(u.hostname)
    if(u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/'&&m)
      accepted.set(u.origin,m[1])
  }
  if(accepted.size!==1)throw Error('Expected one canonical staging Preview origin for '+surface)
  const [origin,suffix]=[...accepted][0]
  return {origin,suffix}
}
export function resolveSettingsPreview(health,settings){
  const h=stagingOrigin(health,'health')
  const s=stagingOrigin(settings,'settings')
  if(h.suffix!==s.suffix)throw Error('Preview account suffix mismatch')
  return s.origin+'/settings/'
}
export function configureHealthPreview(config,url){
  if(config.name!=='aloha-app-health'||config.previews?.vars?.ALOHA_WORKSPACE_MODE!=='preview'||
    config.previews.services||config.previews.vars.ALOHA_SETTINGS_PREVIEW_URL!==undefined)
    throw Error('Unsafe Health Preview workspace transport')
  return {...config,previews:{...config.previews,vars:{...config.previews.vars,ALOHA_SETTINGS_PREVIEW_URL:url}}}
}
async function main(){
  const {CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:token,GITHUB_ENV:envFile}=process.env
  if(!account||!token||!envFile)throw Error('Missing Preview deployment configuration')
  async function read(surface){
    const url='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/workers/workers/aloha-app-'+surface+'/previews?name=staging'
    const response=await fetch(url,{headers:{Authorization:'Bearer '+token},redirect:'error'})
    const payload=await response.json()
    if(!response.ok||!payload.success)throw Error('Cannot resolve named Preview metadata for '+surface)
    return payload.result
  }
  const [health,settings]=await Promise.all([read('health'),read('settings')])
  const url=resolveSettingsPreview(health,settings)
  const path='apps/health/wrangler.jsonc'
  const config=configureHealthPreview(JSON.parse(fs.readFileSync(path,'utf8')),url)
  // Mask before adding the runtime-only URL to the build environment.
  console.log('::add-mask::'+url)
  console.log('::add-mask::'+new URL(url).origin)
  fs.writeFileSync(path,JSON.stringify(config,null,2)+'\n')
  fs.appendFileSync(envFile,'VITE_ALOHA_SETTINGS_URL='+url+'\n')
  console.log('Named staging Settings destination resolved and isolated (URL not logged).')
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(()=>{console.error('Cannot configure the existing same-account named Settings Preview; check deployment metadata and API permissions.');process.exitCode=1})
}
