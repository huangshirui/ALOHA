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
const bodyArtSrc = import.meta.env.BASE_URL + 'body-front-outline.svg'
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
          <!-- Static artwork and interactive coordinate layer share one immutable
               340×520 aspect ratio; SVG never stretches to fit a different box. -->
          <img class="body-artwork" :src="bodyArtSrc" alt=""
            width="340" height="520" draggable="false"/>
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
.body-silhouette { position:relative;width:min(100%,21rem);aspect-ratio:340 / 520;flex:none; }
.body-artwork { display:block;width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none; }
/* A 42px invisible touch target protects the tiny 8px visual dot. */
.body-region-marker {
  position:absolute;display:grid;place-items:center;z-index:2;
  width:2.625rem;height:2.625rem;
  transform:translate(-50%,-50%);padding:0;border:0;
  background:transparent;border-radius:50%;cursor:pointer;
  -webkit-tap-highlight-color:transparent;
}
.body-hotspot-dot {
  display:block;width:.5rem;height:.5rem;border-radius:50%;
  background:var(--health-brand);border:1px solid var(--health-surface);
  box-shadow:0 0 0 2px var(--health-surface);
  pointer-events:none;
}
.body-region-marker:focus-visible .body-hotspot-dot {
  box-shadow:0 0 0 5px color-mix(in srgb,var(--health-brand) 25%,transparent),
             0 0 0 11px color-mix(in srgb,var(--health-brand) 9%,transparent);
}
@media (hover:hover) and (pointer:fine) {
  .body-region-marker:hover .body-hotspot-dot {
    box-shadow:0 0 0 5px color-mix(in srgb,var(--health-brand) 25%,transparent),
               0 0 0 11px color-mix(in srgb,var(--health-brand) 9%,transparent);
  }
}
.body-region-marker.selected .body-hotspot-dot {
  box-shadow:0 0 0 4px color-mix(in srgb,var(--health-brand) 24%,transparent),
             0 0 0 8px color-mix(in srgb,var(--health-brand) 8%,transparent);
}
.body-region-marker:focus-visible { outline:2px solid var(--health-brand);outline-offset:1px; }
.body-map-position-layer {
  position:absolute;inset:0;z-index:4;width:100%;height:100%;
  border:0;background:color-mix(in srgb,var(--health-brand-subtle) 13%,transparent);
  border-radius:var(--health-radius-control);cursor:crosshair;
  display:grid;place-items:end center;padding:var(--aloha-space-2);
}
.body-map-position-layer span {
  background:var(--health-surface);color:var(--health-brand-strong);
  padding:.32rem .6rem;border-radius:var(--health-radius-pill);
  font-size:var(--health-type-caption);pointer-events:none;
}
.body-pending-dot {
  position:absolute;z-index:5;display:block;pointer-events:none;
  width:.65rem;height:.65rem;transform:translate(-50%,-50%);
  border-radius:50%;background:var(--health-brand);
  box-shadow:0 0 0 5px color-mix(in srgb,var(--health-brand) 25%,transparent),
             0 0 0 13px color-mix(in srgb,var(--health-brand) 10%,transparent);
}
.body-position-instruction { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.55rem;padding:.7rem .8rem;margin-top:.5rem;border:1px solid var(--health-brand);border-radius:var(--health-radius-control);background:var(--health-brand-subtle);color:var(--health-brand-strong);font-size:var(--health-type-label); }
.body-position-actions { display:flex;align-items:center;gap:.4rem; }
.body-position-actions button { min-height:2.3rem; }
.body-position-row { display:flex;align-items:center;justify-content:space-between;gap:.4rem;margin:.3rem 0;padding:.2rem 0; }
.body-position-row span { color:var(--health-muted);font-size:var(--health-type-caption); }
.body-position-row .inline-link { font-size:var(--health-type-caption); }
.body-map-note { display:flex;align-items:flex-start;gap:.35rem;margin:.65rem 0 0;color:var(--health-muted);font-size:var(--health-type-caption);line-height:1.5; }
.body-map-note svg { flex:none;margin-top:.12rem; }
.body-explorer-aside { display:grid;gap:var(--health-page-gap); }
.body-region-card { min-height:11rem;scroll-margin-top:5rem; }
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
@media(prefers-reduced-motion:no-preference) {
  .body-hotspot-dot { transition:box-shadow var(--health-motion) ease; }
}
</style>
