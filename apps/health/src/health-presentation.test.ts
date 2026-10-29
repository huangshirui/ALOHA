import { describe, expect, it } from 'vitest'
import { BODY_MAP_ASSET_IDS, sourceToNormalized } from './body-map'
import { parsePresentationPatch, presentationFromRow } from './health-presentation'

const point=sourceToNormalized({x:512,y:195})
const placement={concernId:'rec_test',view:'front' as const,assetId:BODY_MAP_ASSET_IDS.front,point}
describe('Health presentation model / ALOHA-owned data',()=>{
  it('validates normalized points, matching artwork and attention',()=>{
    expect(parsePresentationPatch({placement},'rec_test')).toEqual({placement})
    expect(parsePresentationPatch({attention:'watch'},'rec_test')).toEqual({attention:'watch'})
    expect(parsePresentationPatch({placement:null},'rec_test')).toEqual({placement:null})
    for(const invalid of [
      {},{attention:'urgent'},{attention:'watch',subjectPersonId:'per_other'},
      {placement:{...placement,assetId:BODY_MAP_ASSET_IDS.back}},
      {placement:{...placement,concernId:'rec_other'}},
      {placement:{...placement,point:{x:1.1,y:0.4}}},
      {placement:{...placement,point:{x:0.9,y:0.1}}},
      {placement:{...placement,point:{x:Infinity,y:0.2}}},
    ]) expect(()=>parsePresentationPatch(invalid,'rec_test')).toThrow()
  })
  it('projects persisted rows and ignores stale artwork assets',()=>{
    const row={concern_id:'rec_test',attention:'priority',view:'front',
      asset_id:BODY_MAP_ASSET_IDS.front,x:point.x,y:point.y}
    expect(presentationFromRow(row)).toEqual({concernId:'rec_test',attention:'priority',placement})
    expect(presentationFromRow({...row,asset_id:'obsolete'}).placement).toBeNull()
    expect(presentationFromRow({...row,attention:'unknown'}).attention).toBe('unset')
  })
})
