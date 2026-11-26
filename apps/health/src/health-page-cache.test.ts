import {describe,it,expect} from 'vitest'
import {HealthPageCache} from './health-page-cache'
const page={page:{personId:'per_self',items:[],nextCursor:null}}
describe('session-only first page cache',()=>{
  it('binds space, person, section and search; rejects cross-person results',()=>{
    const cache=new HealthPageCache()
    cache.set('spc_a','per_self','metrics','a',page,0)
    expect(cache.get('spc_a','per_self','metrics','a',1)).toBe(page)
    expect(cache.get('spc_b','per_self','metrics','a',1)).toBeUndefined()
    expect(cache.get('spc_a','per_other','metrics','a',1)).toBeUndefined()
    expect(cache.get('spc_a','per_self','metrics','b',1)).toBeUndefined()
    cache.set('spc_a','per_other','metrics','a',page,0)
    expect(cache.get('spc_a','per_other','metrics','a',1)).toBeUndefined()
    cache.clear()
    expect(cache.get('spc_a','per_self','metrics','a',1)).toBeUndefined()
  })
  it('expires metric summaries faster and bounds memory',()=>{
    const cache=new HealthPageCache(2)
    cache.set('spc_a','per_self','metrics','a',page,0)
    cache.set('spc_a','per_self','documents','a',page,0)
    expect(cache.get('spc_a','per_self','metrics','a',60_000)).toBeUndefined()
    expect(cache.get('spc_a','per_self','documents','a',60_000)).toBe(page)
    cache.set('spc_a','per_self','regimens','a',page,0)
    cache.set('spc_a','per_self','documents','b',page,0)
    expect(cache.get('spc_a','per_self','documents','a',60_001)).toBeUndefined()
  })
})
