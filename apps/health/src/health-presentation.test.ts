import { describe, expect, it, vi } from 'vitest'
import { BODY_MAP_ASSET_IDS, sourceToNormalized } from './body-map'
import {
  listConcernPresentations, parsePresentationPatch, removeConcernPresentation,
  setConcernPresentation, type PresentationDatabase, type PresentationScope,
} from './health-presentation'

const scope:PresentationScope={spaceId:'spc_test',userId:'usr_test',personId:'per_test'}
const point=sourceToNormalized({x:512,y:195})
const placement={concernId:'rec_test',view:'front' as const,
  assetId:BODY_MAP_ASSET_IDS.front,point}
function mockD1() {
  const rows=new Map<string,any>()
  const key=(a:unknown[])=>a.slice(0,4).join('/')
  const prepare=vi.fn((sql:string)=>({
    bind:(...args:any[])=>({
      async all() {
        return {results:[...rows.values()].filter(row=>
          row.space_id===args[0]&&row.user_id===args[1]&&row.person_id===args[2])}
      },
      async first() {
        return rows.get(key(args))??null
      },
      async run() {
        if(sql.startsWith('DELETE ')) rows.delete(key(args))
        else {
          const [space_id,user_id,person_id,concern_id,attention,view,asset_id,x,y,
            hasAttention,hasPlacement]=args
          const old=rows.get(key(args))
          rows.set(key(args),{
            concern_id,space_id,user_id,person_id,
            attention:!old||hasAttention?attention:old.attention,
            view:!old||hasPlacement?view:old.view,
            asset_id:!old||hasPlacement?asset_id:old.asset_id,
            x:!old||hasPlacement?x:old.x,
            y:!old||hasPlacement?y:old.y,
          })
        }
        return {success:true}
      },
    }),
  }))
  return {db:{prepare} as unknown as PresentationDatabase,rows,prepare}
}

describe('Health presentation / ALOHA-owned D1 storage',()=>{
  it('validates normalized body placement, matching artwork and attention values',()=>{
    expect(parsePresentationPatch({placement},'rec_test')).toEqual({placement})
    expect(parsePresentationPatch({attention:'watch'},'rec_test')).toEqual({attention:'watch'})
    expect(parsePresentationPatch({placement:null},'rec_test')).toEqual({placement:null})
    for(const invalid of [
      {},{attention:'urgent'},{attention:'watch',subjectPersonId:'per_other'},
      {placement:{...placement,assetId:BODY_MAP_ASSET_IDS.back}},
      {placement:{...placement,point:{x:1.1,y:0.4}}},
      {placement:{...placement,point:{x:0.9,y:0.1}}},
      {placement:{...placement,point:{x:Infinity,y:0.2}}},
    ]) expect(()=>parsePresentationPatch(invalid,'rec_test')).toThrow()
  })
  it('round-trips and merges attention/point independently without overwriting the other',async()=>{
    const {db}=mockD1()
    let row=await setConcernPresentation(db,scope,'rec_test',{attention:'priority'})
    expect(row).toMatchObject({attention:'priority',placement:null})
    row=await setConcernPresentation(db,scope,'rec_test',{placement})
    expect(row).toMatchObject({attention:'priority',placement})
    row=await setConcernPresentation(db,scope,'rec_test',{attention:'routine'})
    expect(row).toMatchObject({attention:'routine',placement})
    row=await setConcernPresentation(db,scope,'rec_test',{placement:null})
    expect(row).toMatchObject({attention:'routine',placement:null})
  })
  it('isolates User, Space and Person, and removes only the selected Concern',async()=>{
    const {db,rows,prepare}=mockD1()
    await setConcernPresentation(db,scope,'rec_test',{placement,attention:'watch'})
    await setConcernPresentation(db,{...scope,userId:'usr_other'},'rec_test',{attention:'priority'})
    await setConcernPresentation(db,scope,'rec_second',{attention:'routine'})
    expect(await listConcernPresentations(db,scope)).toHaveLength(2)
    expect(await listConcernPresentations(db,{...scope,spaceId:'spc_other'})).toEqual([])
    expect(await listConcernPresentations(db,{...scope,personId:'per_other'})).toEqual([])
    expect(await listConcernPresentations(db,{...scope,userId:'usr_other'})).toHaveLength(1)
    await removeConcernPresentation(db,scope,'rec_test')
    expect(await listConcernPresentations(db,scope)).toMatchObject([{concernId:'rec_second'}])
    expect(rows.size).toBe(2)
    expect(prepare.mock.calls.some(call=>call[0].includes('ON CONFLICT'))).toBe(true)
  })
})
