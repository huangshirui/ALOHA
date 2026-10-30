import {describe,it,expect} from 'vitest'
import {safeReturn,selectedSpace} from './api'
describe('ALOHA common settings',()=>{
  it('allows only known application paths as return destinations',()=>{
    expect(safeReturn('assistant')).toBe('/assistant/')
    expect(safeReturn('health')).toBe('/health/')
    expect(safeReturn('//malicious.example')).toBe('/health/')
    expect(safeReturn('https://evil.example')).toBe('/health/')
  })
  it('never applies an unavailable Space preference',()=>{
    const spaces=[{id:'spc_a',name:'Synthetic A'}]
    expect(selectedSpace(spaces,{getItem:key=>key==='aloha.space'?'spc_unlisted':null})).toBe('')
    expect(selectedSpace(spaces,{getItem:key=>key==='aloha.health.space'?'spc_a':null})).toBe('spc_a')
  })
})
