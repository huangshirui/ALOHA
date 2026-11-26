<script setup lang="ts">
withDefaults(defineProps<{label:string;rows?:number}>(),{rows:3})
</script>
<template>
  <div class="health-skeleton" role="status" :aria-label="label" aria-busy="true">
    <span class="health-skeleton-label">{{ label }}…</span>
    <div v-for="row in rows" :key="row" class="health-skeleton-row" aria-hidden="true">
      <span class="health-skeleton-icon"/><span class="health-skeleton-lines"><i/><i/></span>
    </div>
  </div>
</template>
<style scoped>
.health-skeleton{display:grid;gap:.65rem;padding:.75rem 0;min-width:0}
.health-skeleton-label{font-size:var(--health-type-caption);color:var(--health-muted)}
.health-skeleton-row{display:flex;gap:.75rem;align-items:center;min-height:2.75rem;animation:health-skeleton-pulse 1.5s ease-in-out infinite alternate}
.health-skeleton-icon,.health-skeleton-lines i{display:block;background:var(--health-border);border-radius:.5rem}
.health-skeleton-icon{width:2.25rem;height:2.25rem;flex:none}
.health-skeleton-lines{display:grid;gap:.4rem;flex:1;min-width:0}
.health-skeleton-lines i{height:.65rem;width:75%}
.health-skeleton-lines i+ i{width:45%}
@keyframes health-skeleton-pulse{from{opacity:.55}to{opacity:1}}
@media(prefers-reduced-motion:reduce){.health-skeleton-row{animation:none}}
</style>
