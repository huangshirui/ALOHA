<script setup lang="ts">
withDefaults(defineProps<{label:string;rows?:number;variant?:'row'|'list'|'metric'|'regimen'|'history'|'trend'|'detail'|'metric-detail'|'concern-detail'|'choice'}>(),{rows:3,variant:'row'})
</script>
<template>
  <div class="health-skeleton" role="status" :aria-label="label" aria-busy="true">
    <span class="sr-only">{{ label }}</span>
    <template v-if="variant==='trend'">
      <div class="skeleton-trend-switch" aria-hidden="true"><i/><i/><i/></div>
      <div class="skeleton-trend-plot" aria-hidden="true"><i v-for="n in 5" :key="n"/></div>
      <i class="skeleton-caption" aria-hidden="true"/>
    </template>
    <div v-else-if="variant==='detail'||variant==='metric-detail'||variant==='concern-detail'" class="detail-columns" :class="{'metric-detail-layout':variant==='metric-detail','concern-detail':variant==='concern-detail'}" aria-hidden="true">
      <section v-for="n in variant==='concern-detail'?4:2" :key="n" class="ui-card" :class="{'detail-primary':n===1}">
        <div class="card-heading"><i class="skeleton-card-title"/></div>
        <template v-if="variant==='metric-detail'&&n===1">
          <div class="metric-hero"><i class="skeleton-reading"/><i class="skeleton-caption"/></div>
          <div class="skeleton-trend-switch"><i/><i/><i/></div><div class="skeleton-trend-plot"><i v-for="k in 5" :key="k"/></div>
        </template>
        <div v-else v-for="r in rows" :key="r" class="row-link skeleton-row"><span class="row-main skeleton-lines"><i/><i/></span></div>
      </section>
    </div>
    <template v-else>
      <div v-for="r in rows" :key="r" :class="[variant==='list'||variant==='metric'||variant==='regimen'?'list-row':'row-link','skeleton-row']" aria-hidden="true">
        <span v-if="variant!=='history'&&variant!=='choice'" class="list-icon skeleton-block"/>
        <span class="row-main skeleton-lines"><i/><i/><i v-if="variant==='choice'"/></span>
        <span v-if="variant==='metric'" class="metric-list-result skeleton-value"><i/><i/></span>
        <i v-if="variant==='regimen'" class="skeleton-chip"/>
        <i v-if="variant!=='choice'" class="skeleton-arrow"/>
      </div>
    </template>
  </div>
</template>
<style scoped>
.health-skeleton{display:grid;min-width:0}
.health-skeleton:has(.list-row){gap:.65rem}
.skeleton-block,.skeleton-lines i,.skeleton-value i,.skeleton-chip,.skeleton-arrow,.skeleton-card-title,.skeleton-reading,.skeleton-caption,.skeleton-trend-switch i{display:block;background:var(--health-border);border-radius:.35rem;animation:health-skeleton-pulse 1.5s ease-in-out infinite alternate}
.skeleton-lines{display:grid;gap:.45rem;flex:1;min-width:0}
.skeleton-lines i{height:.72rem;width:68%}
.skeleton-lines i+i{height:.59rem;width:45%}
.skeleton-value{display:grid;justify-items:end;gap:.4rem;min-width:4.5rem}
.skeleton-value i{height:.8rem;width:3.6rem}.skeleton-value i+i{height:.5rem;width:2.5rem}
.skeleton-chip{width:3rem;height:1.35rem;border-radius:1rem}
.skeleton-arrow{height:.8rem;width:.4rem;flex:none;opacity:.65}
.skeleton-card-title{height:.9rem;width:7rem}.skeleton-reading{width:7rem;height:2.5rem}.skeleton-caption{height:.65rem;width:45%;margin:.55rem 0}
.skeleton-trend-switch{display:flex;gap:.35rem;margin:.55rem 0}.skeleton-trend-switch i{height:2rem;width:3.2rem}
.skeleton-trend-plot{height:320px;padding:1.4rem .8rem 1.4rem 2.8rem;display:flex;flex-direction:column;justify-content:space-between;border-left:1px solid var(--health-border-soft)}
.skeleton-trend-plot i{border-bottom:1px solid var(--health-border-soft);width:100%}
@keyframes health-skeleton-pulse{from{opacity:.48}to{opacity:1}}
@media(prefers-reduced-motion:reduce){.health-skeleton *{animation:none!important}}
</style>
