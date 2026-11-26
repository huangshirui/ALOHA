<script setup lang="ts">
import {ChevronDown,Check,Search} from 'lucide-vue-next'
defineProps<{label:string;selectedLabel:string;selectedId:string;open:boolean;disabled:boolean;search:string;
  candidates:{id:string;label:string}[];loading:boolean;error:string;hasMore:boolean}>()
const emit=defineEmits<{toggle:[];search:[term:string];choose:[id:string];more:[];retry:[]}>()
</script>
<template>
  <div class="metric-selector-field">
    <span class="field-label">{{ label }}</span>
    <button type="button" class="metric-picker-toggle" :disabled="disabled" :aria-expanded="open" :aria-label="'选择'+label" @click="emit('toggle')">
      <span>{{ selectedLabel }}</span><ChevronDown :size="17"/>
    </button>
    <div v-if="open" class="metric-picker-panel">
      <label class="metric-picker-search"><Search :size="16"/><input type="search" maxlength="100" :value="search" :aria-label="'搜索'+label" placeholder="搜索记录" @input="emit('search',($event.target as HTMLInputElement).value)" @keydown.enter.prevent/></label>
      <div class="metric-picker-scroll">
        <button type="button" class="metric-picker-option" @click="emit('choose','')">不关联<Check v-if="!selectedId" :size="15"/></button>
        <button v-for="item in candidates" :key="item.id" class="metric-picker-option" type="button" @click="emit('choose',item.id)"><span>{{ item.label }}</span><Check v-if="item.id===selectedId" :size="15"/></button>
        <p v-if="loading" class="helper-copy" role="status">正在加载记录…</p>
        <p v-else-if="error" class="form-error" role="alert">{{ error }} <button class="inline-link" type="button" @click="emit('retry')">重试</button></p>
        <p v-else-if="!candidates.length&&!hasMore" class="helper-copy">没有匹配的记录。</p>
        <button v-if="hasMore&&!error" type="button" class="quiet-button" :disabled="loading" @click="emit('more')">加载更多</button>
      </div>
    </div>
  </div>
</template>
