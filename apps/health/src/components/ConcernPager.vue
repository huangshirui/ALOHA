<script setup lang="ts">
import {computed} from 'vue'
import {pageCount} from '../health-concern-view'
const props=defineProps<{page:number;total:number}>()
const emit=defineEmits<{(e:'change',page:number):void}>()
const pages=computed(()=>pageCount(props.total))
const current=computed(()=>Math.min(props.page,pages.value-1))
</script>
<template>
  <nav v-if="total>3" class="concern-pager" aria-label="关联记录分页">
    <span>{{ current+1 }} / {{ pages }} 页 · 共 {{ total }} 条</span>
    <div>
      <button type="button" :disabled="current<=0" aria-label="上一页" @click="emit('change',current-1)">上一页</button>
      <button type="button" :disabled="current>=pages-1" aria-label="下一页" @click="emit('change',current+1)">下一页</button>
    </div>
  </nav>
</template>
