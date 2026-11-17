import {describe,expect,it} from 'vitest'
import {selectedAuthorizedHealthSpace} from './health-space-entry'
import type {WorkspaceView} from '@aloha/contracts'
const space={id:'spc_synthetic',name:'Synthetic',role:'owner' as const}
describe('Health cloud Space entry',()=>{
  it('accepts only a current cloud binding',()=>{
    expect(selectedAuthorizedHealthSpace({status:'bound',space,spaces:[space]})).toBe(space.id)
    expect(selectedAuthorizedHealthSpace({status:'bound',space,spaces:[]})).toBeNull()
  })
  for(const status of ['unbound','reselect','creating','uncertain'] as const)it('never guesses from members when '+status,()=>{
    const view:WorkspaceView={status,space:null,spaces:[space]}
    expect(selectedAuthorizedHealthSpace(view)).toBeNull()
  })
})
