<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ArrowLeft, Sparkles } from 'lucide-vue-next'

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
  agentEnabled?: boolean
}>()
defineEmits<{ back: []; ask: [] }>()

const isScrolled = ref(false)
function updateScrollState() {
  // Keep the header visually part of the page at rest. Only while scrolling
  // should it need a surface behind the text and action controls.
  isScrolled.value = window.scrollY > 8
}
onMounted(() => {
  updateScrollState()
  window.addEventListener('scroll', updateScrollState, { passive: true })
})
onUnmounted(() => window.removeEventListener('scroll', updateScrollState))
</script>

<template>
  <header class="health-page-heading" :class="{ 'is-scrolled': isScrolled }">
    <div class="health-page-heading-main">
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
      <button v-if="agentEnabled!==false" type="button" class="health-page-ask" :class="{ active: agentOpen }"
        aria-controls="health-agent-panel" :aria-expanded="agentOpen" aria-label="问问 Health" title="问问 Health"
        @click="$emit('ask')">
        <Sparkles :size="17"/><span>问问 Health</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
/* All Health pages: one compact sticky tool row, not a second app header. */
.health-page-heading {
  position:sticky;
  top:env(safe-area-inset-top, 0px);
  z-index:8;
  display:grid;
  grid-template-columns:minmax(0,1fr) auto;
  align-items:center;
  gap:var(--aloha-space-3);
  min-height:3.55rem;
  margin:0 0 var(--aloha-space-3);
  padding:.45rem 0;
  background:transparent;
  border-bottom:1px solid transparent;
}
.health-page-heading.is-scrolled {
  background:color-mix(in srgb, var(--health-canvas) 91%, transparent);
  backdrop-filter:blur(14px);
  -webkit-backdrop-filter:blur(14px);
  border-bottom-color:var(--health-border-soft);
}
.health-page-heading-main,.health-page-heading-copy {
  display:flex;
  align-items:center;
  gap:.55rem;
  min-width:0;
}
.health-page-heading-main { flex:1; }
.health-page-heading-copy { flex:1; }
.health-page-heading-text { display:flex;flex-direction:column;gap:.14rem;min-width:0;flex:1; }
.health-page-heading-titleline { display:flex;align-items:baseline;gap:.6rem;min-width:0; }
.health-page-heading h1 {
  margin:0;
  min-width:0;
  color:var(--health-ink);
  font-size:var(--health-type-page);
  line-height:var(--aloha-leading-tight);
  font-weight:700;
  letter-spacing:-.025em;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.health-page-context { color:var(--health-muted);font-size:var(--health-type-caption);font-weight:600;white-space:nowrap; }
.health-page-subtitle { margin:0;color:var(--health-muted);font-size:var(--health-type-caption);line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.health-page-back { flex:none;display:grid;place-items:center;width:2.35rem;height:2.35rem;border:0;background:transparent;color:var(--health-brand-strong);border-radius:var(--health-radius-control); }
.health-page-back:hover { background:var(--health-brand-subtle); }
.health-page-toolbar { display:flex;align-items:center;gap:.4rem;flex:none;min-width:0; }
.health-page-ask { display:inline-flex;align-items:center;justify-content:center;gap:.4rem;min-height:var(--aloha-control-sm);padding:.43rem .75rem;border:1px solid var(--health-brand);border-radius:var(--health-radius-pill);background:var(--health-brand-subtle);color:var(--health-brand-strong);font-size:var(--health-type-label);font-weight:650;white-space:nowrap; }
.health-page-ask:hover,.health-page-ask.active { background:var(--health-brand);color:var(--health-surface); }
:slotted(.primary-button),:slotted(.quiet-button) { min-height:var(--aloha-control-sm);padding:.42rem .75rem;font-size:var(--health-type-label); }
:slotted(.icon-button) { min-height:var(--aloha-control-sm);width:var(--aloha-control-sm); }
@media (max-width:47.999rem) {
  .health-page-heading {
    grid-template-columns:minmax(0,1fr) auto;
    gap:.45rem;
    min-height:3.25rem;
    padding:.35rem 0;
    margin-bottom:var(--aloha-space-3);
  }
  .health-page-heading-main,.health-page-heading-copy { gap:.35rem;min-width:0; }
  .health-page-heading h1 { font-size:var(--health-type-section); }
  .health-page-context,.health-page-subtitle { display:none; }
  .health-page-toolbar { gap:.3rem;white-space:nowrap; }
  .health-page-ask { width:2.45rem;min-width:2.45rem;height:2.45rem;min-height:2.45rem;padding:0; }
  .health-page-ask span { display:none; }
  .health-page-back { width:2rem;height:2.45rem; }
  :slotted(.primary-button),:slotted(.quiet-button) { min-height:2.45rem;padding:.35rem .55rem; }
  :slotted(.icon-button) { width:2.45rem;min-height:2.45rem; }
}
@media (max-width:27rem) {
  :slotted(.overview-shortcut),:slotted(.detail-edit-button) { font-size:0;padding:.35rem;width:2.45rem;gap:0; }
  :slotted(.overview-shortcut) svg:last-child { display:none; }
  .health-page-heading h1 { font-size:var(--health-type-emphasis); }
}
</style>
