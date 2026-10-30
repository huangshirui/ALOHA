import {describe,it,expect} from 'vitest'
import {newestFirst,pageOf,pageCount,recentMetricIds,searchMetrics} from './health-concern-view'

describe('Concern section presentation and metric history',()=>{
  it('sorts newest first without mutating the source',()=>{
    const items=[{id:'b',date:'2026-01-01'},{id:'a',date:'2026-10-30'},{id:'c',date:''}]
    expect(newestFirst(items,x=>x.date).map(x=>x.id)).toEqual(['a','b','c'])
    expect(items.map(x=>x.id)).toEqual(['b','a','c'])
  })
  it('bounds each card to 3 records and uses a deterministic page count',()=>{
    expect(pageOf([1,2,3,4,5,6,7],0)).toEqual([1,2,3])
    expect(pageOf([1,2,3,4,5,6,7],1)).toEqual([4,5,6])
    expect(pageOf([1,2,3,4,5,6,7],2)).toEqual([7])
    expect(pageCount(0)).toBe(1)
    expect(pageCount(7)).toBe(3)
  })
  it('searches metrics in the inline chooser without mutating the catalog',()=>{
    const metrics=[{name:'Blood Pressure'},{name:'心率'},{name:'体重'}]
    expect(searchMetrics(metrics,'  PRESS  ')).toEqual([{name:'Blood Pressure'}])
    expect(searchMetrics(metrics,'心')).toEqual([{name:'心率'}])
    expect(metrics).toHaveLength(3)
  })
  it('finds five actually-used Metrics in observation date order, ignoring obsolete references',()=>{
    const metrics=Array.from({length:8},(_,i)=>({id:'m'+i}))
    const history=[...metrics].map((m,i)=>({metricId:m.id,observedDate:'2026-10-'+String(i+1).padStart(2,'0')}))
    history.push({metricId:'m7',observedDate:'2026-10-30'})
    history.push({metricId:'removed',observedDate:'2026-10-31'})
    expect(recentMetricIds(history,metrics)).toEqual(['m7','m6','m5','m4','m3'])
  })
})
