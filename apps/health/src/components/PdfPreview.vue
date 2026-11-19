<script setup lang="ts">
import {nextTick,onBeforeUnmount,onMounted,ref} from 'vue'
import {getDocument,GlobalWorkerOptions,type PDFDocumentProxy,type PDFDocumentLoadingTask,type RenderTask} from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
GlobalWorkerOptions.workerSrc=workerUrl
const props=defineProps<{blob:Blob}>()
const canvas=ref<HTMLCanvasElement|null>(null),container=ref<HTMLDivElement|null>(null)
const page=ref(1),pages=ref(0),zoom=ref(1),busy=ref(true),error=ref('')
let task:PDFDocumentLoadingTask|undefined,doc:PDFDocumentProxy|undefined,render:RenderTask|undefined,closed=false
async function draw(){
  if(!doc||!canvas.value||closed)return
  busy.value=true;error.value=''
  try{
    const pdfPage=await doc.getPage(page.value)
    if(closed||!canvas.value)return
    const natural=pdfPage.getViewport({scale:1})
    const width=Math.min(container.value?.clientWidth||700,1000)*zoom.value
    // Bound canvas memory, even for unusually tall or wide PDFs.
    const scale=Math.min(width/natural.width,Math.sqrt(6_000_000/(natural.width*natural.height)))
    const viewport=pdfPage.getViewport({scale})
    const target=canvas.value
    target.width=Math.max(1,Math.floor(viewport.width));target.height=Math.max(1,Math.floor(viewport.height))
    const ctx=target.getContext('2d')
    if(!ctx)throw Error('canvas unavailable')
    render=pdfPage.render({canvas:target,canvasContext:ctx,viewport})
    await render.promise
    pdfPage.cleanup()
  }catch{if(!closed)error.value='此 PDF 无法预览，请下载原文件查看。'}
  finally{render=undefined;if(!closed)busy.value=false}
}
async function go(delta:number){if(busy.value)return;page.value=Math.min(pages.value,Math.max(1,page.value+delta));await draw()}
async function changeZoom(delta:number){if(busy.value)return;zoom.value=Math.min(3,Math.max(1,zoom.value+delta));await draw()}
onMounted(async()=>{
  try{
    const data=new Uint8Array(await props.blob.arrayBuffer())
    if(closed)return
    task=getDocument({data,isEvalSupported:false,useWasm:false,enableXfa:false})
    doc=await task.promise
    if(closed)return
    pages.value=doc.numPages
    await nextTick()
    await draw()
  }catch{if(!closed){error.value='此 PDF 无法预览，请下载原文件查看。';busy.value=false}}
})
onBeforeUnmount(()=>{closed=true;render?.cancel();void task?.destroy().catch(()=>{})})
</script>
<template>
  <div class="pdf-controls">
    <button type="button" :disabled="busy||page<=1" @click="go(-1)">上一页</button>
    <span>{{ pages?page+' / '+pages:'—' }}</span>
    <button type="button" :disabled="busy||page>=pages" @click="go(1)">下一页</button>
    <button type="button" :disabled="busy||zoom<=1" @click="changeZoom(-.25)">−</button>
    <button type="button" :disabled="busy||zoom>=3" @click="changeZoom(.25)">＋</button>
  </div>
  <p v-if="busy" role="status">正在渲染 PDF…</p>
  <p v-if="error" role="alert">{{error}}</p>
  <div ref="container" class="pdf-scroll"><canvas ref="canvas" v-show="!busy&&!error" aria-label="PDF 当前页"/></div>
</template>
<style scoped>
.pdf-controls{display:flex;justify-content:center;align-items:center;gap:.6rem;flex-wrap:wrap}
.pdf-controls button{border:1px solid currentColor;border-radius:8px;padding:.4rem .65rem;background:transparent;color:inherit}
.pdf-controls button:disabled{opacity:.4}
.pdf-scroll{flex:1;min-height:0;overflow:auto;background:#edf0f2}
.pdf-scroll canvas{display:block;margin:auto;background:white}
</style>
