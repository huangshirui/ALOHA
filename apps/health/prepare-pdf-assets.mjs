// Copy public PDF.js runtime resources only; no user documents.
import {cpSync,mkdirSync,rmSync} from 'node:fs'
import {createRequire} from 'node:module'
import {dirname,join} from 'node:path'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url)
const root=dirname(dirname(require.resolve('pdfjs-dist')))
const target=fileURLToPath(new URL('./public/pdf-assets/',import.meta.url))
rmSync(target,{recursive:true,force:true});mkdirSync(target,{recursive:true})
for(const folder of ['cmaps','standard_fonts','wasm','iccs']){
  cpSync(join(root,folder),join(target,folder),{recursive:true})
}
cpSync(join(root,'LICENSE'),join(target,'LICENSE'))
