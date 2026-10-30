import {describe,expect,it} from 'vitest'
import {
  concernRelationInput,concernTargetKinds,concernTargetModels,
  concernTargetHasRelation,isConcernRelation,isConcernTargetKind,
} from './health-concern-relations'

describe('LifeSpace HealthConcern Semantic Relation projection',()=>{
  it('selects monitors only for a HealthMetric, relates_to for other facts',()=>{
    for(const kind of concernTargetKinds){
      const edge=concernRelationInput('rec_syntheticConcern',kind,'rec_syntheticTarget')
      expect(edge).toEqual({
        source:{kind:'record',modelKey:'health_concern',recordId:'rec_syntheticConcern'},
        predicate:kind==='metric'?'monitors':'relates_to',
        target:{kind:'record',modelKey:concernTargetModels[kind],recordId:'rec_syntheticTarget'},
      })
      expect(isConcernRelation({id:'rel_synthetic',spaceId:'spc_synthetic',
        createdAt:'2026-10-01T00:00:00Z',...edge},'rec_syntheticConcern')).toBe(true)
    }
  })
  it('cannot represent a different concern, unregistered model or wrong predicate',()=>{
    const edge=concernRelationInput('rec_syntheticConcern','metric','rec_metric')
    const saved={id:'rel_synthetic',spaceId:'spc_synthetic',createdAt:'x',...edge}
    expect(isConcernRelation(saved,'rec_someoneElse')).toBe(false)
    expect(isConcernRelation({...saved,predicate:'relates_to'},'rec_syntheticConcern')).toBe(false)
    expect(isConcernRelation({...saved,target:{kind:'record',modelKey:'user',recordId:'rec_other'}},'rec_syntheticConcern')).toBe(false)
    expect(isConcernTargetKind('__proto__')).toBe(false)
    expect(isConcernTargetKind('concern')).toBe(false)
    expect(()=>concernRelationInput('usr_notARecord','metric','rec_metric')).toThrow()
  })
  it('identifies already-linked records without requiring a LifeSpace model field',()=>{
    const edge={...concernRelationInput('rec_c','observation','rec_a'),id:'rel_a',
      spaceId:'spc_x',createdAt:'now'}
    expect(concernTargetHasRelation([edge],'observation','rec_a')).toBe(true)
    expect(concernTargetHasRelation([edge],'document','rec_a')).toBe(false)
  })
})
