import {describe,it,expect} from 'vitest'
import {healthPageQuery,summaryMetricIds,metricSummaryQuery} from './health-page-query'
describe('Health bounded queries',()=>{
  it('binds own Person and opaque cursor',()=>{
    expect(healthPageQuery('health_document','per_self',new URLSearchParams({limit:'40',cursor:'opaque',search:'test'}))).toEqual({
      filter:{field:'subjectPersonId',op:'contains',value:'per_self'},search:{text:'test'},
      sort:[{field:'issuedDate',direction:'desc'},{field:'updatedAt',direction:'desc'}],page:{limit:40,cursor:'opaque'}
    })
  })
  it('scopes history to one metric',()=>{
    expect(healthPageQuery('health_observation','per_self',new URLSearchParams({metricId:'rec_metric'})).filter).toEqual({and:[
      {field:'subjectPersonId',op:'contains',value:'per_self'},{field:'metricId',op:'contains',value:'rec_metric'}
    ]})
    expect(()=>healthPageQuery('health_observation','per_self',new URLSearchParams())).toThrow()
  })
  it('rejects scope injection, duplicate parameters and oversized limits',()=>{
    for(const input of ['personId=per_other','filter=anything','limit=51','limit=0','limit=10&limit=20','search='+ 'x'.repeat(101)])
      expect(()=>healthPageQuery('health_document','per_self',new URLSearchParams(input))).toThrow()
  })
})
describe('visible metric summaries',()=>{
  it('bounds relation operands and keeps the verified Person predicate',()=>{
    const ids=Array.from({length:20},(_,i)=>'rec_metric'+i)
    expect(summaryMetricIds(new URLSearchParams({metricIds:ids.join(',')}))).toEqual(ids)
    expect(metricSummaryQuery('per_self',ids,'opaque').filter.and[0]).toEqual({field:'subjectPersonId',op:'contains',value:'per_self'})
    expect(()=>summaryMetricIds(new URLSearchParams({metricIds:[...ids,'rec_extra'].join(',')}))).toThrow()
    expect(()=>summaryMetricIds(new URLSearchParams({metricIds:'rec_one,rec_one'}))).toThrow()
    expect(()=>summaryMetricIds(new URLSearchParams({metricIds:'rec_one',personId:'per_other'}))).toThrow()
  })
})
describe('timeline and trend page queries',()=>{
  it('keeps observation collection views scoped to the verified Person',()=>{
    const q=healthPageQuery('health_observation','per_self',new URLSearchParams({view:'timeline',limit:'30'}))
    expect(q.filter).toEqual({field:'subjectPersonId',op:'contains',value:'per_self'})
    expect(q.sort[0]).toEqual({field:'observedDate',direction:'desc'})
    expect(()=>healthPageQuery('health_observation','per_self',new URLSearchParams({view:'timeline',metricId:'rec_a'}))).toThrow()
  })
  it('binds a real viewing timezone for temporal event order',()=>{
    expect(healthPageQuery('health_event','per_self',new URLSearchParams({timezone:'Asia/Shanghai'}))).toMatchObject({
      context:{viewingTimezone:'Asia/Shanghai'},sort:[{field:'when',direction:'desc'},{field:'updatedAt',direction:'desc'}],
    })
    expect(()=>healthPageQuery('health_event','per_self',new URLSearchParams({timezone:'Not/AZone'}))).toThrow()
  })
  it('restricts a trend to a validated inclusive date window',()=>{
    expect(healthPageQuery('health_observation','per_self',new URLSearchParams({metricId:'rec_a',from:'2025-01-01',to:'2025-12-31'})).filter).toMatchObject({and:[
      {field:'subjectPersonId',op:'contains',value:'per_self'},{field:'metricId',op:'contains',value:'rec_a'},
      {field:'observedDate',op:'gte',value:'2025-01-01'},{field:'observedDate',op:'lte',value:'2025-12-31'},
    ]})
    expect(()=>healthPageQuery('health_observation','per_self',new URLSearchParams({metricId:'rec_a',from:'2025-02-30'}))).toThrow()
  })
})
