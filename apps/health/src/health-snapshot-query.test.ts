import {describe,expect,it} from 'vitest'
import {healthSnapshotQuery,snapshotModelKeys} from './health-snapshot-query'

describe('Health Canonical Query contract',()=>{
  it('filters all Person-owned models by the Core-verified Space Person',()=>{
    for(const model of snapshotModelKeys.filter(k=>k!=='health_metric')){
      const query=healthSnapshotQuery(model,'per_synthetic',null)
      expect(query.filter).toEqual({field:'subjectPersonId',op:'contains',value:'per_synthetic'})
      expect(query.page).toEqual({limit:200,cursor:null})
      expect(query.sort).toEqual([{field:'updatedAt',direction:'desc'}])
    }
  })
  it('keeps the shared Metric catalog visible without inserting an invalid Person filter',()=>{
    expect(healthSnapshotQuery('health_metric','',null)).not.toHaveProperty('filter')
  })
  it('preserves Core cursor continuity, never synthesizing offsets',()=>{
    expect(healthSnapshotQuery('health_document','per_synthetic','cursor_synthetic').page.cursor).toBe('cursor_synthetic')
  })
  it('refuses Person-scoped queries without a verified Person ID',()=>{
    expect(()=>healthSnapshotQuery('health_concern','usr_synthetic',null)).toThrow()
    expect(()=>healthSnapshotQuery('health_observation','',null)).toThrow()
  })
})
