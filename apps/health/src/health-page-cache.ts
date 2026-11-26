import type {HealthRecord,ScopedHealthPage} from './health-api'
export type HealthCachedPage={page:ScopedHealthPage;summaries?:HealthRecord[]}
type Entry={value:HealthCachedPage;expiresAt:number}
/** Ephemeral UI projection only. Never persist to storage or use as authorization proof. */
export class HealthPageCache{
  private entries=new Map<string,Entry>()
  constructor(private maxEntries=12){}
  get(spaceId:string,personId:string,section:string,search:string,now=Date.now()):HealthCachedPage|undefined{
    if(!spaceId||!personId)return undefined
    const key=JSON.stringify([spaceId,personId,section,search])
    const entry=this.entries.get(key)
    if(!entry)return undefined
    this.entries.delete(key)
    if(entry.expiresAt<=now)return undefined
    this.entries.set(key,entry)
    return entry.value
  }
  set(spaceId:string,personId:string,section:string,search:string,value:HealthCachedPage,now=Date.now()){
    if(!spaceId||!personId||value.page.personId!==personId)return
    const key=JSON.stringify([spaceId,personId,section,search])
    this.entries.delete(key)
    this.entries.set(key,{value,expiresAt:now+(section==='metrics'?60_000:120_000)})
    while(this.entries.size>this.maxEntries)this.entries.delete(this.entries.keys().next().value!)
  }
  clear(){this.entries.clear()}
}
