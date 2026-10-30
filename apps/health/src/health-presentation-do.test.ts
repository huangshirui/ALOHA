import { describe, expect, it } from 'vitest'
import { BODY_MAP_ASSET_IDS, sourceToNormalized } from './body-map'
import { HealthPresentationState, type PresentationSql } from './health-presentation-do'

const point=sourceToNormalized({x:512,y:195})
const placement={concernId:'rec_test',view:'front',assetId:BODY_MAP_ASSET_IDS.front,point}
type Row={space_id:string;person_id:string;concern_id:string;attention:string;
  view:string|null;asset_id:string|null;x:number|null;y:number|null}
function memoryObject() {
  const map=new Map<string,Row>()
  const commands:string[]=[]
  const key=(space:string,person:string,concern:string)=>space+'/'+person+'/'+concern
  const sql:PresentationSql={
    exec<T extends object>(query:string,...args:(string|number|null)[]) {
      commands.push(query)
      const [space,person,concern]=args as string[]
      if(query.startsWith('INSERT ')){
        const [s,p,c,attention,view,asset,x,y,hasAttention,hasPlacement]=args
        const previous=map.get(key(String(s),String(p),String(c)))
        map.set(key(String(s),String(p),String(c)),{
          space_id:String(s),person_id:String(p),concern_id:String(c),
          attention:!previous||hasAttention===1?String(attention):previous.attention,
          view:!previous||hasPlacement===1?view as string|null:previous.view,
          asset_id:!previous||hasPlacement===1?asset as string|null:previous.asset_id,
          x:!previous||hasPlacement===1?x as number|null:previous.x,
          y:!previous||hasPlacement===1?y as number|null:previous.y,
        })
      }
      if(query.startsWith('DELETE '))map.delete(key(String(space),String(person),String(concern)))
      const rows=query.startsWith('SELECT ')
        ? [...map.values()].filter(row=>row.space_id===space&&row.person_id===person
           &&(args.length===2||row.concern_id===concern))
        : []
      return {toArray:()=>rows as T[]}
    },
  }
  return {state:new HealthPresentationState({storage:{sql}}),map,commands}
}
const send=(state:HealthPresentationState,method:string,values:Record<string,unknown>)=>
  state.fetch(new Request('https://do.internal/'+method,{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify(values)}))
const scope={spaceId:'spc_test',personId:'per_self'}
const otherSpace={spaceId:'spc_other',personId:'per_self'}
const otherPerson={spaceId:'spc_test',personId:'per_other'}
describe('SQLite-backed Health Presentation Durable Object',()=>{
  it('creates its own table and does not depend on LifeSpace D1',()=>{
    const {commands}=memoryObject()
    expect(commands[0]).toContain('CREATE TABLE IF NOT EXISTS health_concern_presentation')
    expect(commands[0]).toContain('PRIMARY KEY (space_id,person_id,concern_id)')
  })
  it('stores placement and attention in independent atomic patches; removes placement only',async()=>{
    const {state,commands}=memoryObject()
    const p={...scope,concernId:'rec_test'}
    expect((await send(state,'patch',{...p,patch:{attention:'priority'}})).status).toBe(200)
    const dot=await send(state,'patch',{...p,patch:{placement}})
    expect((await dot.json()).data).toEqual({concernId:'rec_test',attention:'priority',placement})
    const changed=await send(state,'patch',{...p,patch:{attention:'routine'}})
    expect((await changed.json()).data).toMatchObject({attention:'routine',placement})
    const clear=await send(state,'patch',{...p,patch:{placement:null}})
    expect((await clear.json()).data).toEqual({concernId:'rec_test',attention:'routine',placement:null})
    expect(commands.filter(x=>x.includes('ON CONFLICT('))).toHaveLength(4)
  })
  it('isolates Space/Person inside one User DO and delete is scoped',async()=>{
    const {state,map}=memoryObject()
    await send(state,'patch',{...scope,concernId:'rec_test',patch:{attention:'watch'}})
    await send(state,'patch',{...otherSpace,concernId:'rec_test',patch:{attention:'priority'}})
    await send(state,'patch',{...otherPerson,concernId:'rec_test',patch:{attention:'routine'}})
    const list=await send(state,'list',scope)
    expect((await list.json()).data.items).toMatchObject([{concernId:'rec_test',attention:'watch'}])
    expect((await (await send(state,'list',otherSpace)).json()).data.items).toMatchObject([{attention:'priority'}])
    expect((await (await send(state,'list',otherPerson)).json()).data.items).toMatchObject([{attention:'routine'}])
    expect((await send(state,'delete',{...scope,concernId:'rec_test'})).status).toBe(204)
    expect((await (await send(state,'list',scope)).json()).data.items).toEqual([])
    expect(map.size).toBe(2)
  })
  it('rejects invalid scope, mismatched ids, background and unsupported operation',async()=>{
    const {state,map}=memoryObject()
    expect((await send(state,'patch',{...scope,concernId:'rec_test',patch:
      {placement:{...placement,concernId:'rec_other'}}})).status).toBe(422)
    expect((await send(state,'patch',{...scope,concernId:'rec_test',patch:
      {placement:{...placement,point:{x:1.4,y:0}}}})).status).toBe(422)
    expect((await send(state,'list',{spaceId:'spc_test',personId:'per_wrong*'})).status).toBe(400)
    expect((await send(state,'patch',{...scope,concernId:'bad*',patch:{attention:'watch'}})).status).toBe(400)
    expect((await send(state,'unknown',scope)).status).toBe(404)
    expect(map.size).toBe(0)
  })
  it('stores users in separate Durable Object instances, not a shared SQL database',async()=>{
    const first=memoryObject(),second=memoryObject()
    await send(first.state,'patch',{...scope,concernId:'rec_test',patch:{attention:'priority'}})
    expect((await (await send(second.state,'list',scope)).json()).data.items).toEqual([])
  })
})
