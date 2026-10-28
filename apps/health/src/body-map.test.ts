import { describe, expect, it } from 'vitest'
import { seedDemo } from './demo-model'
import {
 BODY_MAP_ASSET_ID, BODY_MAP_ASSET_IDS, BODY_MAP_CROP, countForView, isPointOnBody, normalizedPoint,
 normalizedToSource, removeConcernPoint, seedBodyBindings, setConcernPoint,
 sourceToNormalized, unmappedConcerns, visibleHotspots,
} from './body-map'

describe('per-Concern body coordinates / 正背面', () => {
 const concerns=seedDemo().concerns
 it('shows back-facing concern count before switching from front',()=>{
   const bindings=seedBodyBindings()
   expect(countForView(concerns,bindings,'front')).toBe(1)
   expect(countForView(concerns,bindings,'back')).toBe(1)
   expect(visibleHotspots(concerns,bindings,'front').map(h=>h.concern.id)).toEqual(['c-1'])
   expect(visibleHotspots(concerns,bindings,'back').map(h=>h.concern.id)).toEqual(['c-2'])
   expect(bindings.find(b=>b.view==='front')?.assetId).toBe(BODY_MAP_ASSET_ID)
   expect(bindings.find(b=>b.view==='back')?.assetId).toBe(BODY_MAP_ASSET_IDS.back)
   expect(BODY_MAP_ASSET_IDS.back).not.toBe(BODY_MAP_ASSET_IDS.front)
 })
 it('has one dot per concern even for identical coordinates',()=>{
   const one=seedBodyBindings()[0]!
   const both=setConcernPoint(seedBodyBindings(),'c-2','front',one.point)
   const hotspots=visibleHotspots(concerns,both,'front')
   expect(hotspots).toHaveLength(2)
   expect(hotspots.map(h=>h.concern.id)).toEqual(['c-1','c-2'])
 })
 it('preserves exact image coordinate conversion',()=>{
   expect(BODY_MAP_CROP).toEqual({x:390,y:40,width:244,height:475})
   const src={x:512,y:88}
   const p=sourceToNormalized(src)
   expect(normalizedToSource(p)).toEqual(src)
   expect(normalizedPoint(-1,3)).toEqual({x:0,y:1})
 })
 it('changes a concern point without altering the canonical concern record',()=>{
   const original=structuredClone(concerns)
   const point=sourceToNormalized({x:511,y:180})
   const b=setConcernPoint(seedBodyBindings(),'c-1','back',point)
   expect(b.find(x=>x.concernId==='c-1')).toEqual({concernId:'c-1',view:'back',assetId:BODY_MAP_ASSET_IDS.back,point})
   expect(countForView(concerns,b,'front')).toBe(0)
   expect(countForView(concerns,b,'back')).toBe(2)
   expect(concerns).toEqual(original)
 })
 it('rejects invalid and background taps, retaining existing placement',()=>{
   const bindings=seedBodyBindings()
   expect(isPointOnBody(sourceToNormalized({x:610,y:70}))).toBe(false)
   expect(()=>setConcernPoint(bindings,'c-1','front',sourceToNormalized({x:610,y:70}))).toThrow()
   expect(()=>setConcernPoint(bindings,'c-1','back',{x:2,y:0})).toThrow()
   expect(bindings).toHaveLength(2)
 })
 it('preserves unplaced concerns and can remove a position without deleting the concern',()=>{
   const newConcern={...concerns[0]!,id:'c-3'}
   expect(unmappedConcerns([...concerns,newConcern],seedBodyBindings()).map(x=>x.id)).toContain('c-3')
   const without=removeConcernPoint(seedBodyBindings(),'c-1')
   expect(unmappedConcerns(concerns,without).map(x=>x.id)).toContain('c-1')
 })
})
