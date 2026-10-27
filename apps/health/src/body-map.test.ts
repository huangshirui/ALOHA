import { describe, expect, it } from 'vitest'
import { seedDemo } from './demo-model'
import {
  BODY_MAP_ASSET_ID, bodyRegions, concernHotspots, concernsForRegion, normalizedPoint,
  resolvePoint, seedBodyBindings, setConcernPoint, setConcernRegion, unmappedConcerns,
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
  it('stores a stable normalized point anchored to an explicit SVG asset version', () => {
    const point=normalizedPoint(.66, .77)
    const updated=setConcernPoint(seedBodyBindings(),'c-1',point)
    const binding=updated.find(b=>b.concernId==='c-1')!
    expect(binding.assetId).toBe(BODY_MAP_ASSET_ID)
    expect(binding.point).toEqual(point)
    expect(resolvePoint(binding)).toEqual(point)
    expect(normalizedPoint(-.5,1.6)).toEqual({x:0,y:1})
  })
  it('groups several concerns in one region as one visual dot, not a giant badge', () => {
    const withTwo=setConcernRegion(seedBodyBindings(),'c-2','chest')
    const hotspots=concernHotspots(concerns,withTwo)
    expect(hotspots).toHaveLength(1)
    expect(hotspots[0]!.regionId).toBe('chest')
    expect(hotspots[0]!.count).toBe(2)
  })
  it('does not infer spots for unlinked or inactive concerns', () => {
    const hotspots=concernHotspots(concerns,seedBodyBindings())
    expect(hotspots.map(h=>h.regionId).sort()).toEqual(['chest','legs'])
    expect(concernHotspots(concerns,[])).toEqual([])
  })
  it('shows multiple concerns in the same region as individual results', () => {
    const both=setConcernRegion(seedBodyBindings(),'c-2','chest')
    expect(concernsForRegion(concerns,both,'chest').map(x=>x.id)).toEqual(['c-1','c-2'])
  })
})
