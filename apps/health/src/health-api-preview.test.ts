import {afterEach,describe,expect,it,vi} from 'vitest'
import {readHealthDocument,HEALTH_PREVIEW_MAX_BYTES} from './health-api'
afterEach(()=>vi.unstubAllGlobals())
describe('Health document preview',()=>{
  it('reads PDF from the existing authorized same-origin route without saving to disk',async()=>{
    const fetch=vi.fn(async()=>new Response('%PDF-synthetic',{headers:{'Content-Type':'application/pdf','Content-Disposition':"attachment; filename*=UTF-8''synthetic.pdf"}}))
    vi.stubGlobal('fetch',fetch)
    const file=await readHealthDocument('spc_synthetic','rec_synthetic')
    expect(file.name).toBe('synthetic.pdf')
    expect(file.blob.type).toBe('application/pdf')
    expect(fetch).toHaveBeenCalledWith('/health/api/v1/spaces/spc_synthetic/documents/rec_synthetic/download',expect.objectContaining({credentials:'same-origin',cache:'no-store'}))
  })
  it('rejects HTML, unauthorized and over-limit responses',async()=>{
    const fetch=vi.fn()
    vi.stubGlobal('fetch',fetch)
    fetch.mockResolvedValueOnce(new Response('<html>',{headers:{'Content-Type':'text/html'}}))
    await expect(readHealthDocument('spc_synthetic','rec_synthetic')).rejects.toThrow('不支持')
    fetch.mockResolvedValueOnce(new Response(null,{status:403}))
    await expect(readHealthDocument('spc_synthetic','rec_synthetic')).rejects.toThrow('403')
    fetch.mockResolvedValueOnce(new Response(new Uint8Array(HEALTH_PREVIEW_MAX_BYTES+1),{headers:{'Content-Type':'application/pdf'}}))
    await expect(readHealthDocument('spc_synthetic','rec_synthetic')).rejects.toThrow('15 MB')
  })
})
