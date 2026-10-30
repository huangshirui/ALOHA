import {describe,expect,it} from 'vitest'
import {selectedAuthorizedHealthSpace} from './health-space-entry'

const spaces=[{id:'spc_personal'},{id:'spc_household'}]
const storage=(selected:string|null,legacy:string|null=null)=>({
  getItem:(key:string)=>key==='aloha.space'?selected:key==='aloha.health.space'?legacy:null,
})
describe('Health entry requires explicit, currently authorized ALOHA Space',()=>{
  it('accepts a valid current ALOHA selection',()=>{
    expect(selectedAuthorizedHealthSpace(spaces,storage('spc_personal'))).toBe('spc_personal')
  })
  it('honors legacy Health preference during migration only when authorized',()=>{
    expect(selectedAuthorizedHealthSpace(spaces,storage(null,'spc_personal'))).toBe('spc_personal')
  })
  it('never guesses a Space even if there is only one available',()=>{
    expect(selectedAuthorizedHealthSpace([spaces[0]!],storage(null))).toBeNull()
  })
  it('requires Settings for unset selection or revoked Space',()=>{
    expect(selectedAuthorizedHealthSpace(spaces,storage(null))).toBeNull()
    expect(selectedAuthorizedHealthSpace(spaces,storage('spc_revoked'))).toBeNull()
    expect(selectedAuthorizedHealthSpace([],storage('spc_personal'))).toBeNull()
  })
  it('never trusts an invalid current preference even when legacy is authorized',()=>{
    expect(selectedAuthorizedHealthSpace(spaces,storage('spc_revoked','spc_personal'))).toBeNull()
  })
})
