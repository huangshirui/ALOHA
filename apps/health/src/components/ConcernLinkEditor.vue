<script setup lang="ts">
import type {ConcernTargetKind} from '../health-concern-relations'
const props=defineProps<{
  kinds:{kind:ConcernTargetKind;label:string}[]
  kind:ConcernTargetKind
  targetId:string
  candidates:{id:string;label:string}[]
  busy:boolean
  error:string
}>()
const emit=defineEmits<{
  (e:'change-kind',kind:ConcernTargetKind):void
  (e:'change-target',id:string):void
  (e:'add'):void
}>()
</script>
<template>
  <div class="concern-inline-editor">
    <p class="helper-copy">关联已有记录；解除关联不会删除原记录。</p>
    <div class="relation-picker" :class="{ 'has-kind': kinds.length > 1 }">
      <label v-if="kinds.length>1" class="sr-only" for="concern-link-kind">记录类型</label>
      <select v-if="kinds.length>1" id="concern-link-kind" :value="kind" :disabled="busy"
        aria-label="选择记录类型" @change="emit('change-kind',($event.target as HTMLSelectElement).value as ConcernTargetKind)">
        <option v-for="choice in kinds" :key="choice.kind" :value="choice.kind">{{ choice.label }}</option>
      </select>
      <label class="sr-only" for="concern-link-target">选择现有记录</label>
      <select id="concern-link-target" :value="targetId" :disabled="busy" aria-label="选择现有记录"
        @change="emit('change-target',($event.target as HTMLSelectElement).value)">
        <option value="">选择尚未关联的记录</option>
        <option v-for="record in candidates" :key="record.id" :value="record.id">{{ record.label }}</option>
      </select>
      <button type="button" class="soft-button" :disabled="busy||!targetId" @click="emit('add')">{{ busy?'处理中…':'建立关联' }}</button>
    </div>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
  </div>
</template>
