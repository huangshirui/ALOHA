<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, ref, shallowRef } from 'vue'
import { readHealthDocument, saveHealthDocument, type HealthDocumentFile } from '../health-api'
const PdfPreview = defineAsyncComponent(()=>import('./PdfPreview.vue'))
const props=defineProps<{spaceId:string;recordId:string;title?:string}>()
const file=shallowRef<HealthDocumentFile|null>(null)
const imageUrl=ref('')
const open=ref(false),busy=ref(false),error=ref(''),zoom=ref(1)
let request:AbortController|undefined
function close(){
  request?.abort();request=undefined
  if(imageUrl.value)URL.revokeObjectURL(imageUrl.value)
  imageUrl.value='';file.value=null;open.value=false;busy.value=false;error.value='';zoom.value=1
}
onBeforeUnmount(close)
async function show(){
  if(open.value)return
  open.value=true;busy.value=true;error.value=''
  const controller=new AbortController();request=controller
  try{
    const loaded=await readHealthDocument(props.spaceId,props.recordId,controller.signal)
    if(request!==controller)return
    file.value=loaded
    if(loaded.blob.type.startsWith('image/'))imageUrl.value=URL.createObjectURL(loaded.blob)
  }catch(e){if(request===controller)error.value=e instanceof Error?e.message:'文件暂时无法预览'}
  finally{if(request===controller)busy.value=false}
}
function download(){if(file.value)saveHealthDocument(file.value)}
</script>
<template>
  <button type="button" class="soft-button" @click="show">查看原始资料</button>
  <Teleport to="body">
    <div v-if="open" class="attachment-overlay" role="dialog" aria-modal="true" aria-label="文件预览" @keydown.esc="close">
      <header class="attachment-toolbar">
        <strong>{{ title || '文件预览' }}</strong>
        <button type="button" :disabled="!file" @click="download">下载</button>
        <button type="button" @click="close" autofocus>关闭</button>
      </header>
      <p v-if="busy" role="status">正在安全读取文件…</p>
      <p v-else-if="error" role="alert">{{ error }}</p>
      <template v-else-if="file">
        <PdfPreview v-if="file.blob.type==='application/pdf'" :blob="file.blob"/>
        <template v-else>
          <div class="attachment-toolbar"><button type="button" :disabled="zoom<=1" @click="zoom=Math.max(1,zoom-.25)">缩小</button><button type="button" :disabled="zoom>=3" @click="zoom=Math.min(3,zoom+.25)">放大</button></div>
          <div class="attachment-scroll"><img :src="imageUrl" :alt="title || '图片预览'" :style="{width:(zoom*100)+'%',maxWidth:zoom===1?'100%':'none'}"/></div>
        </template>
      </template>
    </div>
  </Teleport>
</template>
<style scoped>
.attachment-overlay{position:fixed;inset:0;z-index:1000;background:var(--health-surface,#fff);color:var(--health-ink,#17212b);display:flex;flex-direction:column;gap:.5rem;padding:env(safe-area-inset-top) 12px env(safe-area-inset-bottom);overflow:hidden}
.attachment-toolbar{display:flex;align-items:center;gap:.5rem;padding:.65rem 0;flex-wrap:wrap}
.attachment-toolbar strong{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.attachment-toolbar button{border:1px solid currentColor;border-radius:8px;padding:.4rem .7rem;background:transparent;color:inherit}
.attachment-toolbar button:disabled{opacity:.4}
.attachment-scroll{overflow:auto;flex:1;min-height:0;text-align:center;background:#edf0f2}
.attachment-scroll img{display:block;height:auto;margin:auto;object-fit:contain}
.attachment-overlay>p{margin:auto;padding:1rem}
</style>
