import {readFileSync} from 'node:fs'
import {describe,expect,it} from 'vitest'
const source=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8')
describe('local PDF renderer resources',()=>{
  it('uses a local legacy worker and packaged PDF font and decoder resources',()=>{
    const pdf=source('./components/PdfPreview.vue')
    for(const key of ['pdfjs-dist/legacy/build/pdf.worker.min.mjs?url','isEvalSupported:false','enableXfa:false','cMapUrl:','standardFontDataUrl:','wasmUrl:','iccUrl:','task?.destroy()'])expect(pdf).toContain(key)
    const prepare=source('../prepare-pdf-assets.mjs')
    for(const folder of ['cmaps','standard_fonts','wasm','iccs'])expect(prepare).toContain(folder)
    expect(source('../vite.config.ts')).toContain('**/pdf-assets/**')
  })
})
