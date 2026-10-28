<script setup lang="ts">
import { ArrowDown, ArrowUp } from 'lucide-vue-next'
import type { ReferenceComparison } from '../health-reference'

const props=defineProps<{
  comparison?:ReferenceComparison|null
}>()
</script>

<template>
  <!-- Position within the range is not an alert; show no extra decoration. -->
  <span v-if="props.comparison && props.comparison.position!=='within'"
    class="reference-indicator"
    :class="'reference-'+props.comparison.position"
    role="img"
    :aria-label="props.comparison.label"
    :title="props.comparison.label">
    <ArrowUp v-if="props.comparison.position==='above'" :size="16" :stroke-width="2.25" aria-hidden="true"/>
    <ArrowDown v-else :size="16" :stroke-width="2.25" aria-hidden="true"/>
  </span>
</template>

<style scoped>
.reference-indicator {
  display:inline-flex;align-items:center;justify-content:center;
  width:1.4rem;height:1.4rem;flex:none;border-radius:50%;
  color:var(--health-attention-watch);
  background:color-mix(in srgb,var(--health-attention-watch) 10%,transparent);
  vertical-align:middle;
}
.reference-indicator:where(.reference-below,.reference-above) {color:var(--health-attention-watch)}
</style>
