<script setup lang="ts">
import { ArrowLeft, Sparkles } from 'lucide-vue-next'
import AlohaHub from './AlohaHub.vue'

/**
 * ALOHA Health's one page-title / action bar, reused for every primary screen.
 * The structure is local to the Health PWA until another real surface needs it.
 */
defineProps<{
  title: string
  subtitle?: string
  context?: string
  canBack?: boolean
  agentOpen?: boolean
  apps: Array<{id:string;name:string;description:string;href?:string}>
  density: 'comfortable' | 'compact'
}>()
defineEmits<{ back: []; ask: []; selectApp: [id:string]; updateDensity: [value:'comfortable'|'compact'] }>()
</script>

<template>
  <header class="health-page-heading">
    <div class="health-page-heading-main">
      <div class="health-page-heading-prefix"><AlohaHub :apps="apps" current-app="health" compact preview :density="density" @select-app="$emit('selectApp',$event)" @update:density="$emit('updateDensity',$event)"/></div>
      <div class="health-page-heading-copy">
        <button v-if="canBack" class="health-page-back" type="button" aria-label="返回列表" @click="$emit('back')">
          <ArrowLeft :size="17"/>
        </button>
        <div class="health-page-heading-text">
          <div class="health-page-heading-titleline">
            <h1 :title="title">{{ title }}</h1>
            <span v-if="context" class="health-page-context">{{ context }}</span>
          </div>
          <p v-if="subtitle" class="health-page-subtitle" :title="subtitle">{{ subtitle }}</p>
        </div>
      </div>
    </div>
    <div class="health-page-toolbar" role="group" aria-label="页面操作">
      <slot name="actions"/>
      <button type="button" class="health-page-ask" :class="{ active: agentOpen }"
        aria-controls="health-agent-panel" :aria-expanded="agentOpen"
        @click="$emit('ask')">
        <Sparkles :size="17"/><span>问问 Health</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.health-page-heading {
  display:flex;
  align-items:center;
  justify-content:space-between;
  flex-wrap:wrap;
  gap:var(--aloha-space-3);
  margin:0 0 var(--aloha-space-4);
  min-height:3rem;
}
.health-page-heading-main { display:flex;align-items:center;gap:.6rem;flex:1;min-width:0; }
.health-page-heading-prefix { display:none; }
.health-page-heading-copy { display:flex;align-items:center;gap:.45rem;min-width:0;flex:1; }
.health-page-heading-text { display:flex;flex-direction:column;gap:.17rem;min-width:0; }
.health-page-heading-titleline { display:flex;align-items:baseline;flex-wrap:wrap;gap:.4rem .7rem;min-width:0; }
.health-page-heading h1 { color:var(--health-ink);font-size:var(--health-type-page);font-weight:700;letter-spacing:-.025em;line-height:var(--aloha-leading-tight);margin:0;overflow-wrap:anywhere; }
.health-page-context { font-size:var(--health-type-caption);color:var(--health-muted);font-weight:600; }
.health-page-subtitle { font-size:var(--health-type-caption);color:var(--health-muted);line-height:1.4;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:44rem; }
.health-page-back { display:grid;place-items:center;flex:none;width:2rem;height:2rem;padding:0;border:0;border-radius:var(--health-radius-control);background:transparent;color:var(--health-brand-strong); }
.health-page-back:hover { background:var(--health-brand-subtle); }
.health-page-toolbar { display:flex;align-items:center;justify-content:flex-end;gap:.5rem;flex-wrap:wrap;flex:none; }
.health-page-ask { display:inline-flex;align-items:center;justify-content:center;gap:.4rem;min-height:var(--aloha-control-sm);border:1px solid var(--health-brand);border-radius:var(--health-radius-pill);padding:.42rem .85rem;color:var(--health-brand-strong);background:var(--health-brand-subtle);font-size:var(--health-type-label);font-weight:650;white-space:nowrap; }
.health-page-ask:hover,.health-page-ask.active { color:var(--health-surface);background:var(--health-brand); }
:slotted(.primary-button),:slotted(.quiet-button) { min-height:var(--aloha-control-sm);padding:.43rem .86rem;font-size:var(--health-type-label); }
:slotted(.icon-button) { min-height:var(--aloha-control-sm);width:var(--aloha-control-sm); }
@media (max-width:47.999rem) {
  .health-page-heading { align-items:flex-start;gap:.6rem; }
  .health-page-heading-prefix { display:flex;flex:none; }
  .health-page-heading-main { flex-basis:100%; }
  .health-page-heading h1 { font-size:var(--health-type-section); }
  .health-page-subtitle { white-space:normal;max-height:2.6em; }
  .health-page-toolbar { width:100%;justify-content:flex-end; }
}
@media (max-width:28rem) {
  .health-page-ask { padding:.4rem .64rem; }
}
</style>
