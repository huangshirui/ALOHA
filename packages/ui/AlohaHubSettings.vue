<script setup lang="ts">
import {computed} from 'vue'
import {ArrowLeft,ArrowUpRight,ShieldCheck} from 'lucide-vue-next'

export interface HubSpace {id:string;name:string}
const props=withDefaults(defineProps<{
  accountUrl:string
  selectedSpaceId:string
  spaces:HubSpace[]
  busy?:boolean
  spaceMessage?:string
  backUrl:string
  embedded?:boolean
}>(),{busy:false,spaceMessage:'',embedded:false})
const emit=defineEmits<{(e:'choose-space',id:string):void;(e:'retry'):void}>()
const selectedName=computed(()=>props.spaces.find(x=>x.id===props.selectedSpaceId)?.name)
</script>
<template>
  <section class="aloha-settings" aria-label="ALOHA 公共设置">
    <a v-if="!embedded" class="aloha-settings-back" :href="backUrl"><ArrowLeft :size="18"/> 返回应用</a>
    <h1 v-if="!embedded">应用设置</h1>
    <p v-if="!embedded" class="aloha-settings-caption">ALOHA 各应用共享的设置入口，账号资料在独立账号中心管理。</p>
    <section id="default-space" class="aloha-settings-card" aria-label="默认空间">
      <div class="aloha-settings-section-heading"><h2>默认空间</h2><ShieldCheck :size="20" aria-hidden="true"/></div>
      <p>选择进入 ALOHA 时优先使用的空间。此项仅保存浏览器偏好，不改变 LifeSpace 权限。</p>
      <label for="aloha-default-space">当前空间</label>
      <select id="aloha-default-space" :value="selectedSpaceId" :disabled="busy||!spaces.length"
        @change="emit('choose-space',($event.target as HTMLSelectElement).value)">
        <option value="">请选择一个空间</option>
        <option v-for="space in spaces" :key="space.id" :value="space.id">{{ space.name }}</option>
      </select>
      <p v-if="selectedName" class="aloha-settings-hint">当前：{{selectedName}}</p>
      <p v-if="spaceMessage" role="status" class="aloha-settings-hint">{{spaceMessage}}</p>
      <button v-if="!spaces.length" type="button" class="aloha-settings-retry" @click="emit('retry')">重新读取可访问空间</button>
    </section>
    <section id="account-center" class="aloha-settings-card" aria-label="账号设置">
      <div class="aloha-settings-section-heading"><h2>账号与安全</h2></div>
      <p>账号名称、头像、安全及授权统一由 AISR 账号中心管理。</p>
      <a :href="accountUrl" target="_blank" rel="noopener noreferrer" class="aloha-settings-account">
        前往账号中心 <ArrowUpRight :size="17" aria-hidden="true"/>
      </a>
    </section>
  </section>
</template>
<style scoped>
.aloha-settings {width:100%;max-width:48rem;margin:0;display:grid;gap:1.1rem;color:var(--aloha-color-text);scroll-margin-top:5rem}
.aloha-settings h1 {font-size:var(--aloha-type-page);margin:.3rem 0 0}
.aloha-settings-caption,.aloha-settings-card p {color:var(--aloha-color-text-muted);line-height:1.55;font-size:.85rem}
.aloha-settings-back,.aloha-settings-account {display:inline-flex;align-items:center;gap:.4rem;color:var(--aloha-accent-strong);text-decoration:none;font-size:.85rem}
.aloha-settings-card {display:grid;gap:1rem;padding:1.35rem 1.5rem;background:var(--aloha-color-surface);border:1px solid var(--aloha-color-border);border-radius:var(--aloha-radius-lg);scroll-margin-top:5rem}
.aloha-settings-section-heading {display:flex;justify-content:space-between;align-items:center}
.aloha-settings-section-heading h2 {font-size:1.1rem;margin:0}
.aloha-settings-card p {margin:0}
.aloha-settings-card label {font-weight:650;font-size:.82rem}
.aloha-settings-card select {width:100%;min-height:3rem;padding:.55rem 2rem .55rem .8rem;border:1px solid var(--aloha-color-border);background-color:var(--aloha-color-surface);color:var(--aloha-color-text);border-radius:var(--aloha-radius-sm)}
.aloha-settings-retry {justify-self:start;background:transparent;color:var(--aloha-accent-strong);border:0;padding:.4rem}
.aloha-settings-account {justify-self:start}
@media (max-width:47.999rem) {
  .aloha-settings-card {padding:1.15rem;gap:.8rem}
}
</style>