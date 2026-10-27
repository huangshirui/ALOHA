<script setup lang="ts">
import { ref } from 'vue'
import { Activity, BadgeCheck, CalendarDays, ChevronDown, Plus } from 'lucide-vue-next'
import type { CreateChoice } from '../health-journeys'

defineProps<{ label: string; choices: ReadonlyArray<CreateChoice> }>()
const emit = defineEmits<{ select:[id:CreateChoice['id']] }>()
const expanded = ref(false)
function choose(id:CreateChoice['id']) { expanded.value=false; emit('select',id) }
function iconFor(id:CreateChoice['id']) {
  return id==='observation'?Activity:id==='event'?CalendarDays:BadgeCheck
}
</script>

<template>
  <div class="health-create-menu">
    <button class="primary-button health-create-menu-trigger" type="button"
      :aria-expanded="expanded" aria-haspopup="menu" @click="expanded=!expanded">
      <Plus :size="17"/><span>{{ label }}</span><ChevronDown :size="16"/>
    </button>
    <template v-if="expanded">
      <button type="button" class="health-create-menu-dismiss" aria-label="关闭新增菜单" @click="expanded=false"/>
      <div class="health-create-menu-options" role="menu" aria-label="选择记录类型" @keydown.esc.stop="expanded=false">
        <button v-for="choice in choices" :key="choice.id" type="button" role="menuitem" @click="choose(choice.id)">
          <span class="health-create-icon"><component :is="iconFor(choice.id)" :size="19"/></span>
          <span class="health-create-copy"><strong>{{ choice.label }}</strong><small>{{ choice.hint }}</small></span>
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.health-create-menu { position:relative;display:inline-flex;flex:none; }
.health-create-menu-trigger { display:inline-flex;gap:.4rem;align-items:center;white-space:nowrap; }
.health-create-menu-dismiss { position:fixed;inset:0;z-index:17;background:transparent;border:0;cursor:default; }
.health-create-menu-options {
  position:absolute;top:calc(100% + .45rem);right:0;z-index:18;
  width:min(18.5rem,calc(100vw - 1.75rem));padding:.35rem;
  background:var(--health-surface);border:1px solid var(--health-border);
  border-radius:var(--health-radius-control);box-shadow:var(--health-shadow-float);
}
.health-create-menu-options button { display:flex;align-items:center;gap:.7rem;text-align:left;width:100%;padding:.65rem;border:0;border-radius:var(--health-radius-control);background:transparent;color:var(--health-ink); }
.health-create-menu-options button:hover,.health-create-menu-options button:focus-visible { background:var(--health-brand-subtle); }
.health-create-icon { display:grid;place-items:center;flex:none;width:2.5rem;height:2.5rem;color:var(--health-brand-strong);background:var(--health-brand-subtle);border-radius:var(--health-radius-control); }
.health-create-copy { display:flex;flex:1;min-width:0;flex-direction:column;gap:.1rem; }
.health-create-copy strong { font-size:var(--health-type-label);font-weight:680; }
.health-create-copy small { font-size:var(--health-type-caption);color:var(--health-muted);line-height:1.35; }
@media(max-width:47.999rem) {
  .health-create-menu-trigger { min-height:2.45rem;padding:.38rem .55rem; }
  .health-create-menu-trigger span { font-size:var(--health-type-label); }
}
</style>
