import { describe, expect, it } from 'vitest'
import { seedDemo } from './demo-model'
import {
  bodyRegions, concernsForRegion, seedBodyBindings, setConcernRegion, unmappedConcerns,
} from './body-map'

describe('ALOHA body map — application-only projection', () => {
  const concerns=seedDemo().concerns
  it('uses plain, neutral body regions and maps concerns, not measurements', () => {
    expect(bodyRegions.map(r=>r.id)).toEqual(['head','chest','abdomen','arms','legs'])
    const bindings=seedBodyBindings()
    expect(concernsForRegion(concerns,bindings,'chest').map(x=>x.id)).toEqual(['c-1'])
    expect(concernsForRegion(concerns,bindings,'legs').map(x=>x.id)).toEqual(['c-2'])
    expect(concernsForRegion(concerns,bindings,'head')).toEqual([])
  })
  it('keeps unmatched concerns accessible without fabricating a medical location', () => {
    const more=[...concerns,{id:'new',name:'关注事项',summary:'尚未指定部位',status:'active',concernIds:[],onsetDate:'',resolvedDate:'',notes:''}]
    expect(unmappedConcerns(more,seedBodyBindings()).map(x=>x.id)).toEqual(['new'])
  })
  it('rebinding or clearing an association does not change the concern model', () => {
    const original=structuredClone(concerns)
    const moved=setConcernRegion(seedBodyBindings(),'c-1','arms')
    expect(concernsForRegion(concerns,moved,'arms').map(x=>x.id)).toEqual(['c-1'])
    expect(concernsForRegion(concerns,moved,'chest')).toEqual([])
    const cleared=setConcernRegion(moved,'c-1','')
    expect(unmappedConcerns(concerns,cleared).map(x=>x.id)).toEqual(['c-1'])
    expect(concerns).toEqual(original)
  })
  it('shows multiple concerns in the same region as individual results', () => {
    const both=setConcernRegion(seedBodyBindings(),'c-2','chest')
    expect(concernsForRegion(concerns,both,'chest').map(x=>x.id)).toEqual(['c-1','c-2'])
  })
})
