<script setup lang="ts">
import type {ConcernTargetKind} from '../health-concern-relations'
const props=defineProps<{
  kinds:{kind:ConcernTargetKind;label:string}[]
  kind:ConcernTargetKind
  targetId:string
  candidates:{id:string;label:string}[]
  busy:boolean
  error:string
  loading?:boolean
  loadError?:string
  search?:string
  hasMore?:boolean
}>()
const emit=defineEmits<{
  (e:'change-kind',kind:ConcernTargetKind):void
  (e:'change-target',id:string):void
  (e:'add'):void
  (e:'search',term:string):void
  (e:'more'):void
  (e:'retry'):void
}>()
</script>
<template>
  <div class="concern-inline-editor">
    <p class="helper-copy">关联已有记录；解除关联不会删除原记录。</p>
    <label v-if="kind!=='observation'" class="search-field">
      <input type="search" :value="search" maxlength="100" placeholder="搜索现有记录" aria-label="搜索现有记录" :disabled="busy" @input="emit('search',($event.target as HTMLInputElement).value)"/>
    </label>
    <p v-else class="helper-copy">测量记录按日期倒序逐批读取。</p>
    <div class="relation-picker" :class="{ 'has-kind': kinds.length > 1 }">
      <label v-if="kinds.length>1" class="sr-only" for="concern-link-kind">记录类型</label>
      <select v-if="kinds.length>1" id="concern-link-kind" :value="kind" :disabled="busy"
        aria-label="选择记录类型" @change="emit('change-kind',($event.target as HTMLSelectElement).value as ConcernTargetKind)">
        <option v-for="choice in kinds" :key="choice.kind" :value="choice.kind">{{ choice.label }}</option>
      </select>
      <label class="sr-only" for="concern-link-target">选择现有记录</label>
      <select id="concern-link-target" :value="targetId" :disabled="busy||loading||!!loadError" aria-label="选择现有记录"
        @change="emit('change-target',($event.target as HTMLSelectElement).value)">
        <option value="">{{ loading?'正在读取候选…':'选择尚未关联的记录' }}</option>
        <option v-for="record in candidates" :key="record.id" :value="record.id">{{ record.label }}</option>
      </select>
      <button type="button" class="soft-button" :disabled="busy||loading||!!loadError||!targetId" @click="emit('add')">{{ busy?'处理中…':'建立关联' }}</button>
    </div>
    <p v-if="loadError" class="form-error" role="alert">{{ loadError }} <button class="inline-link" type="button" @click="emit('retry')">重试</button></p>
    <p v-else-if="loading" class="helper-copy" role="status">正在加载候选记录…</p>
    <p v-else-if="!candidates.length&&!hasMore" class="helper-copy">没有符合条件的未关联记录。</p>
    <button v-if="hasMore&&!loadError" class="quiet-button" type="button" :disabled="busy||loading" @click="emit('more')">加载更多候选</button>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
  </div>
</template>
