<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { ChevronRight, HeartPulse, Info, MapPin, CircleDot } from 'lucide-vue-next'
import {
  bodyRegions, concernHotspots, concernsForRegion, normalizedPoint, unmappedConcerns,
  type BodyMapBinding, type BodyMapConcern, type BodyPoint, type BodyRegionId,
} from '../body-map'

const props = defineProps<{
  concerns: BodyMapConcern[]
  bindings: BodyMapBinding[]
  selectedRegion: BodyRegionId
}>()
const emit = defineEmits<{
  selectRegion: [regionId:BodyRegionId]
  openConcern: [concernId:string]
  assign: [concernId:string,regionId:BodyRegionId|'']
  placePoint: [concernId:string,point:BodyPoint]
}>()
const selected = computed(()=>bodyRegions.find(region=>region.id===props.selectedRegion)!)
const inRegion = computed(()=>concernsForRegion(props.concerns,props.bindings,props.selectedRegion))
const unassigned = computed(()=>unmappedConcerns(props.concerns,props.bindings))
const activeConcerns = computed(()=>props.concerns.filter(c=>c.status==='active'))
const mappedRegions = computed(()=>bodyRegions.filter(region=>concernsForRegion(activeConcerns.value,props.bindings,region.id).length>0).length)
const hotspots = computed(()=>concernHotspots(props.concerns,props.bindings))
const locatingConcernId=ref<string|null>(null)
const pendingPoint=ref<BodyPoint|null>(null)
const figureEl=ref<HTMLElement|null>(null)
const regionCardEl=ref<HTMLElement|null>(null)
const locatingConcernName=computed(()=>props.concerns.find(c=>c.id===locatingConcernId.value)?.name||'健康问题')
async function selectHotspot(id:BodyRegionId) {
  emit('selectRegion',id)
  await nextTick()
  if(typeof window!=='undefined' && window.matchMedia('(max-width:47.999rem)').matches)
    regionCardEl.value?.scrollIntoView({block:'start',behavior:'smooth'})
}
async function startPositioning(id:string) {
  locatingConcernId.value=id
  pendingPoint.value=null
  await nextTick()
  figureEl.value?.scrollIntoView({block:'center',behavior:'smooth'})
}
function pickMapPoint(event:MouseEvent) {
  const rect=figureEl.value?.getBoundingClientRect()
  if(!rect || !locatingConcernId.value) return
  pendingPoint.value=normalizedPoint(
    (event.clientX-rect.left)/rect.width,
    (event.clientY-rect.top)/rect.height,
  )
}
function cancelPositioning() {
  locatingConcernId.value=null
  pendingPoint.value=null
}
function confirmPositioning() {
  if(!locatingConcernId.value||!pendingPoint.value) return
  emit('placePoint',locatingConcernId.value,pendingPoint.value)
  cancelPositioning()
}

const otherRegions = computed(()=>bodyRegions.filter(region=>region.id!==props.selectedRegion && concernsForRegion(activeConcerns.value,props.bindings,region.id).length>0))
function countInRegion(id:BodyRegionId) {
  return concernsForRegion(activeConcerns.value,props.bindings,id).length
}
function onRegionChange(id:string,event:Event) {
  emit('assign',id,(event.target as HTMLSelectElement).value as BodyRegionId|'')
}
</script>

<template>
  <div class="body-explorer">
    <section class="ui-card body-figure-card" aria-labelledby="body-map-heading">
      <div class="body-card-heading">
        <h2 id="body-map-heading">身体图</h2>
        <span v-if="mappedRegions" class="body-map-total">{{ mappedRegions }} 处标记</span>
      </div>
      <div v-if="locatingConcernId" class="body-position-instruction" role="status">
        <span>为「{{ locatingConcernName }}」标记位置。请点击人体上的一个位置。</span>
        <div class="body-position-actions">
          <button type="button" class="quiet-button" @click="cancelPositioning">取消</button>
          <button class="primary-button" type="button" :disabled="!pendingPoint" @click="confirmPositioning">确认位置</button>
        </div>
      </div>
      <div class="body-map-canvas">
        <div ref="figureEl" class="body-silhouette" role="group" aria-label="身体健康问题位置图">
          <svg viewBox="0 0 320 520" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
            <!-- Gender-neutral front-view line art, deliberately without anatomy or fill.
                 Original vector path: no third-party or screenshot artwork copied. -->
            <ellipse cx="160" cy="64" rx="24" ry="35" class="body-outline"/>
            <g class="body-outline">
              <path d="M146 98
                C147 107 145 112 131 118
                L113 125 C103 130 99 140 98 154
                L96 186 C94 201 89 220 85 246
                L80 282 C78 291 74 296 71 301
                C68 306 70 310 74 309
                L82 302 C78 315 78 324 83 329
                C88 333 97 330 99 322
                C102 312 98 295 100 282
                L113 231 C120 205 123 182 120 164"/>
              <path d="M120 164
                C123 194 117 230 114 254
                C110 277 113 311 119 340
                C124 363 121 390 123 409
                L128 454 C130 468 125 477 117 484
                C114 487 115 490 121 490
                L138 490 C143 487 142 481 140 474
                L146 418 C149 386 148 365 152 336
                L158 300"/>
            </g>
            <g class="body-outline" transform="translate(320 0) scale(-1 1)">
              <path d="M146 98
                C147 107 145 112 131 118
                L113 125 C103 130 99 140 98 154
                L96 186 C94 201 89 220 85 246
                L80 282 C78 291 74 296 71 301
                C68 306 70 310 74 309
                L82 302 C78 315 78 324 83 329
                C88 333 97 330 99 322
                C102 312 98 295 100 282
                L113 231 C120 205 123 182 120 164"/>
              <path d="M120 164
                C123 194 117 230 114 254
                C110 277 113 311 119 340
                C124 363 121 390 123 409
                L128 454 C130 468 125 477 117 484
                C114 487 115 490 121 490
                L138 490 C143 487 142 481 140 474
                L146 418 C149 386 148 365 152 336
                L158 300"/>
            </g>
          </svg>
          <!-- One discreet dot per concerned location. Larger invisible hit area
               supports touch; the halo appears on hover/focus and selection. -->
          <button v-for="hotspot in hotspots" :key="hotspot.regionId"
            type="button"
            :style="{left:(hotspot.point.x*100)+'%',top:(hotspot.point.y*100)+'%'}"
            :class="['body-region-marker',{selected:selectedRegion===hotspot.regionId}]"
            :title="bodyRegions.find(r=>r.id===hotspot.regionId)?.label + ' · ' + hotspot.count + '项健康关注'"
            :aria-label="bodyRegions.find(r=>r.id===hotspot.regionId)?.label+'，'+hotspot.count+'项健康关注'"
            :aria-pressed="selectedRegion===hotspot.regionId"
            @click="selectHotspot(hotspot.regionId)">
            <span class="body-hotspot-dot" aria-hidden="true"></span>
          </button>
          <button v-if="locatingConcernId" type="button" class="body-map-position-layer"
            aria-label="在此位置标记健康问题" @click="pickMapPoint">
            <span>点击定位</span>
          </button>
          <span v-if="pendingPoint" class="body-pending-dot"
            :style="{left:(pendingPoint.x*100)+'%',top:(pendingPoint.y*100)+'%'}"
            aria-label="待确认的健康问题位置"></span>
        </div>
      </div>
      <p class="body-map-note"><Info :size="14"/> 小圆点表示已关联的关注位置，点击可查看详情，并不代表医学诊断。</p>
    </section>

    <aside class="body-explorer-aside" aria-label="身体图关联的健康问题">
      <section ref="regionCardEl" class="ui-card body-region-card">
        <div class="body-region-card-heading">
          <div><span class="eyebrow">当前部位</span><h2>{{ selected.label }}</h2><p>{{ selected.hint }}</p></div>
          <span class="status-chip">{{ inRegion.filter(c=>c.status==='active').length }} 项关注中</span>
        </div>
        <button v-for="concern in inRegion" :key="concern.id" type="button" class="row-link"
          @click="emit('openConcern',concern.id)">
          <span class="list-icon"><HeartPulse :size="18"/></span>
          <span class="row-main"><b>{{ concern.name }}</b><small>{{ concern.summary }}</small></span>
          <ChevronRight :size="17" class="subtle-icon"/>
        </button>
        <div v-for="concern in inRegion" :key="'point-'+concern.id" class="body-position-row">
          <span>{{ concern.name }}</span>
          <button type="button" class="inline-link" @click="startPositioning(concern.id)">调整标记位置</button>
        </div>
        <p v-if="!inRegion.length" class="body-region-empty">这个部位还没有关联健康问题。你可以查看其他部位，或为已有的健康问题指定部位。</p>
      </section>
      <section class="ui-card body-region-summary">
        <div class="card-heading">
          <div><span class="eyebrow">快速定位</span><h2>其他关注部位</h2></div>
          <span class="body-map-total">{{ activeConcerns.length }} 项关注中</span>
        </div>
        <button v-for="region in otherRegions" :key="region.id" type="button"
          class="body-region-shortcut" @click="selectHotspot(region.id)">
          <span class="list-icon"><MapPin :size="17"/></span>
          <span class="row-main"><b>{{ region.label }}</b><small>{{ countInRegion(region.id) }} 项关注事项 · 点击定位</small></span>
          <ChevronRight :size="17" class="subtle-icon"/>
        </button>
        <p v-if="!otherRegions.length" class="body-region-empty">其余部位暂未关联需要持续关注的健康问题。</p>
      </section>
      <section v-if="unassigned.length" class="ui-card body-unmapped-card">
        <div class="card-heading"><div><span class="eyebrow">待整理</span><h2>尚未标记部位</h2></div><CircleDot :size="18" class="subtle-icon"/></div>
        <div v-for="concern in unassigned" :key="concern.id" class="body-unmapped-item">
          <button type="button" class="inline-link body-unmapped-link" @click="emit('openConcern',concern.id)">{{ concern.name }} <ChevronRight :size="15"/></button>
          <label>
            <span>关联到身体部位</span>
            <select :value="''" :aria-label="'为'+concern.name+'选择身体部位'" @change="onRegionChange(concern.id,$event)">
              <option value="">请选择部位</option>
              <option v-for="region in bodyRegions" :key="region.id" :value="region.id">{{ region.label }}</option>
            </select>
            <button type="button" class="inline-link" @click="startPositioning(concern.id)">
              在身体图上点选位置
            </button>
          </label>
        </div>
      </section>
    </aside>
  </div>
</template>

<style scoped>
/* The grid uses its own available width: Desktop without Agent can be 2 columns;
   Agent opening narrows the same container and may trigger 1 column.
   Phones always stack. Viewport width alone must not decide this. */
:global(.body-overview) { container-type:inline-size; }
.body-explorer {
  display:grid;
  grid-template-columns:minmax(0,1.05fr) minmax(19rem,.95fr);
  gap:var(--health-page-gap);
  align-items:start;
}
.body-figure-card,.body-explorer-aside { min-width:0; }
.body-card-heading,.body-region-card-heading { display:flex;align-items:flex-start;justify-content:space-between;gap:var(--aloha-space-3); }
.body-card-heading h2,.body-region-card-heading h2 { margin:0 0 .28rem;font-size:var(--health-type-section);letter-spacing:-.02em; }
.body-card-heading p,.body-region-card-heading p { margin:0;color:var(--health-muted);font-size:var(--health-type-caption);line-height:1.55; }
.body-map-total { display:inline-flex;align-items:center;gap:.3rem;white-space:nowrap;font-size:var(--health-type-caption);color:var(--health-brand-strong);background:var(--health-brand-subtle);border-radius:var(--health-radius-pill);padding:.3rem .6rem; }
.body-map-canvas {
  display:grid;
  place-items:center;
  margin:var(--aloha-space-3) 0;
  min-height:26rem;
  border-radius:var(--health-radius-control);
  background:var(--health-surface);
}
.body-silhouette { position:relative;width:min(100%,19.5rem);aspect-ratio:320 / 520; }
.body-silhouette svg { display:block;height:100%;width:100%;overflow:visible; }
.body-outline { fill:none;stroke:var(--health-ink);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round; }
.body-region-marker {
  position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:.17rem;min-width:2.65rem;min-height:2.85rem;
  transform:translate(-50%,-50%);padding:.14rem .18rem;border:0;
  background:transparent;color:var(--health-muted);
}
.body-marker-count {
  display:grid;place-items:center;width:1.85rem;height:1.85rem;
  border:1.5px solid var(--health-border);border-radius:50%;
  background:var(--health-surface);box-shadow:var(--health-shadow-card);
  color:var(--health-muted);font-size:var(--health-type-label);font-weight:750;line-height:1;
}
.body-region-marker.populated .body-marker-count { background:var(--health-brand);border-color:var(--health-brand);color:var(--health-surface); }
.body-region-marker.selected .body-marker-count { outline:3px solid color-mix(in srgb,var(--health-brand) 37%,transparent);outline-offset:2px; }
.body-region-marker:hover .body-marker-count { transform:scale(1.08); }
.body-region-marker:focus-visible { outline:2px solid var(--health-brand);outline-offset:4px;border-radius:var(--health-radius-control); }
.body-marker-name { display:block;padding:.08rem .25rem;background:var(--health-surface);border-radius:var(--health-radius-pill);font-size:.66rem;font-weight:680;white-space:nowrap;line-height:1.3; }
.body-region-marker:not(.selected):not(.populated) .body-marker-name { display:none; }
.body-region-marker.selected .body-marker-name { color:var(--health-brand-strong); }
.body-map-key { display:flex;gap:.45rem .65rem;align-items:center;flex-wrap:wrap;font-size:var(--health-type-caption);color:var(--health-muted); }
.body-key-dot { width:.58rem;height:.58rem;border-radius:50%;background:var(--health-surface);border:1px solid var(--health-border); }
.body-key-dot.active { background:var(--health-brand);border-color:var(--health-brand); }
.body-key-outline { width:.64rem;height:.64rem;border-radius:50%;border:2px solid var(--health-brand); }
.body-map-note { display:flex;align-items:flex-start;gap:.35rem;margin:.65rem 0 0;color:var(--health-muted);font-size:var(--health-type-caption);line-height:1.5; }
.body-map-note svg { flex:none;margin-top:.12rem; }
.body-explorer-aside { display:grid;gap:var(--health-page-gap); }
.body-region-card { min-height:11rem; }
.body-region-card-heading { margin-bottom:var(--aloha-space-3); }
.body-region-card-heading .status-chip { font-size:.67rem; }
.body-region-empty { margin:1rem 0 0;font-size:var(--health-type-body);color:var(--health-muted);line-height:1.65; }
.body-region-shortcut { display:flex;align-items:center;gap:.65rem;width:100%;border:0;border-bottom:1px solid var(--health-border-soft);background:transparent;color:var(--health-ink);text-align:left;padding:var(--health-row-pad-block) 0; }
.body-region-shortcut:last-child { border-bottom:0; }
.body-region-shortcut:hover .row-main b { color:var(--health-brand-strong); }
.body-unmapped-item + .body-unmapped-item { border-top:1px solid var(--health-border-soft);margin-top:.65rem;padding-top:.65rem; }
.body-unmapped-link { margin-bottom:.35rem; }
.body-unmapped-item label { display:flex;flex-direction:column;gap:.4rem;font-size:var(--health-type-caption);color:var(--health-muted); }
.body-unmapped-item select { border:1px solid var(--health-border);border-radius:var(--health-radius-control);padding:.65rem;background-color:var(--health-surface);font-size:var(--health-type-label);color:var(--health-ink); }
@container (max-width: 51rem) {
  .body-explorer { grid-template-columns:minmax(0,1fr); }
  .body-map-canvas { min-height:21rem; }
  .body-silhouette { width:min(100%,17rem); }
}
/* A phone always stacks, even if a device has a wide browser viewport in landscape. */
@media (max-width:47.999rem) {
  .body-explorer { grid-template-columns:minmax(0,1fr); }
  .body-map-canvas { min-height:19rem;margin:var(--aloha-space-2) 0; }
  .body-silhouette { width:min(100%,14.5rem); }
  .body-card-heading { flex-direction:column;gap:.4rem; }
  .body-map-total { align-self:flex-start; }
}
@media(prefers-reduced-motion:no-preference) { .body-marker-count { transition:transform var(--health-motion) ease; } }
</style>
