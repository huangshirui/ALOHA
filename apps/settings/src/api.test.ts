import {describe,it,expect,vi,afterEach} from 'vitest'
afterEach(()=>vi.unstubAllGlobals())
import {safeReturn,selectedSpace} from './api'
describe('ALOHA common settings',()=>{
  it('allows only known application paths as return destinations',()=>{
    expect(safeReturn('assistant')).toBe('/assistant/')
    expect(safeReturn('health')).toBe('/health/')
    expect(safeReturn('//malicious.example')).toBe('/health/')
    expect(safeReturn('https://evil.example')).toBe('/health/')
  })
  it('returns to a same-account Health Preview instead of Settings /health/',()=>{
    vi.stubGlobal('window',{location:{hostname:'staging-aloha-app-settings.synthetic.workers.dev'}})
    expect(safeReturn('health')).toBe('https://staging-aloha-app-health.synthetic.workers.dev/health/')
    expect(safeReturn('assistant')).toBe('https://aloha.aisr.online/')
    expect(safeReturn('https://evil.example')).toBe('https://staging-aloha-app-health.synthetic.workers.dev/health/')
  })
  it('does not construct a Preview URL for untrusted hostnames',()=>{
    vi.stubGlobal('window',{location:{hostname:'staging-aloha-app-settings.attacker.example.com'}})
    expect(safeReturn('health')).toBe('/health/')
  })
  it('never applies an unavailable Space preference',()=>{
    const spaces=[{id:'spc_a',name:'Synthetic A'}]
    expect(selectedSpace(spaces,{getItem:key=>key==='aloha.space'?'spc_unlisted':null})).toBe('')
    expect(selectedSpace(spaces,{getItem:key=>key==='aloha.health.space'?'spc_a':null})).toBe('spc_a')
  })
})
