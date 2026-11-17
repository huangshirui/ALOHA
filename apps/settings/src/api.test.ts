import {describe,it,expect,vi,afterEach} from 'vitest'
afterEach(()=>vi.unstubAllGlobals())
import {safeReturn,getWorkspace,bindWorkspace,createWorkspace} from './api'
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
  it('uses the authenticated cloud endpoint and explicit mutations',async()=>{
    const fetch=vi.fn(async(_path:string,_init?:RequestInit)=>Response.json({data:{status:'unbound',space:null,spaces:[]}}))
    vi.stubGlobal('fetch',fetch)
    await getWorkspace();await bindWorkspace('spc_synthetic');await createWorkspace('Synthetic','UTC',false)
    expect(fetch.mock.calls[0]?.[0]).toBe('/settings/api/v1/workspace')
    const bind=fetch.mock.calls[1] as [string,RequestInit]
    expect(bind[1].method).toBe('POST')
    expect(bind[1].headers).toMatchObject({'X-ALOHA-Intent':'configure-workspace'})
    expect(JSON.parse(String(bind[1].body))).toEqual({intent:'bind',spaceId:'spc_synthetic'})
  })
})
