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
