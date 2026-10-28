<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { ChevronRight, HeartPulse, Info, MapPin, CircleDot, X } from 'lucide-vue-next'
import {
  countForView, isPointOnBody, normalizedPoint, unmappedConcerns, visibleHotspots,
  type BodyMapBinding, type BodyMapConcern, type BodyPoint, type BodyView,
} from '../body-map'

const props=defineProps<{concerns:BodyMapConcern[];bindings:BodyMapBinding[]}>()
const emit=defineEmits<{
  openConcern:[id:string]
  placePoint:[id:string,view:BodyView,point:BodyPoint]
}>()
const imageSrc=import.meta.env.BASE_URL+'body-front-outline.svg'
const view=ref<BodyView>('front')
const selectedConcern=ref<string|null>(null)
const locatingConcern=ref<string|null>(null)
const pendingPoint=ref<BodyPoint|null>(null)
const positionError=ref('')
const figureEl=ref<HTMLElement|null>(null)
const explorerEl=ref<HTMLElement|null>(null)
const recordsCardEl=ref<HTMLElement|null>(null)
const spots=computed(()=>visibleHotspots(props.concerns,props.bindings,view.value))
const counts=computed(()=>({
  front:countForView(props.concerns,props.bindings,'front'),
  back:countForView(props.concerns,props.bindings,'back'),
}))
const unplaced=computed(()=>unmappedConcerns(props.concerns,props.bindings))
const locatingName=computed(()=>props.concerns.find(c=>c.id===locatingConcern.value)?.name||'健康问题')
function switchView(next:BodyView) {
  view.value=next
  selectedConcern.value=null
  pendingPoint.value=null
  positionError.value=''
}
async function selectDot(id:string){
  selectedConcern.value=id
  await nextTick()
  // A docked AI panel can cause stacking at Desktop sizes too.
  if((explorerEl.value?.clientWidth ?? Number.POSITIVE_INFINITY)<=816 ||
    (typeof window!=='undefined' && window.matchMedia('(max-width:47.999rem)').matches))
    recordsCardEl.value?.scrollIntoView({block:'start',behavior:'smooth'})
}
async function beginPlacement(id:string){
  locatingConcern.value=id
  pendingPoint.value=null
  positionError.value=''
  const existing=props.bindings.find(b=>b.concernId===id)
  if(existing)view.value=existing.view
  await nextTick()
  figureEl.value?.scrollIntoView({block:'center',behavior:'smooth'})
}
function pickPoint(event:MouseEvent){
  if(!locatingConcern.value)return
  const bounds=figureEl.value?.getBoundingClientRect()
  if(!bounds)return
  const x=(event.clientX-bounds.left)/bounds.width
  const y=(event.clientY-bounds.top)/bounds.height
  const candidate={x,y}
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1||!isPointOnBody(candidate)){
    positionError.value='请点在人体轮廓内部。'
    pendingPoint.value=null
    return
  }
  positionError.value=''
  pendingPoint.value=normalizedPoint(x,y)
}
function cancelPlacement(){
  locatingConcern.value=null;pendingPoint.value=null;positionError.value=''
}
function confirmPlacement(){
  if(!locatingConcern.value||!pendingPoint.value)return
  const id=locatingConcern.value
  emit('placePoint',id,view.value,pendingPoint.value)
  selectedConcern.value=id
  cancelPlacement()
}
</script>

<template>
  <div ref="explorerEl" class="body-explorer">
    <section class="ui-card body-figure-card" aria-label="健康关注位置图">
      <div class="body-view-switch" role="group" aria-label="人体视图">
        <button v-for="side in (['front','back'] as const)" :key="side" type="button"
          :class="{active:view===side}" :aria-pressed="view===side" @click="switchView(side)">
          {{ side==='front'?'正面':'背面' }}
          <span class="body-view-count" :class="{hasItems:counts[side]>0}">{{ counts[side] }}</span>
        </button>
      </div>
      <div v-if="locatingConcern" class="body-position-instruction" role="status">
        <span>给「{{ locatingName }}」定位：选择正/背面，在身体内点一下。</span>
        <div class="body-position-actions">
          <button type="button" class="quiet-button" @click="cancelPlacement">取消</button>
          <button type="button" class="primary-button" :disabled="!pendingPoint" @click="confirmPlacement">确认</button>
        </div>
        <p v-if="positionError" class="body-position-error" role="alert">{{ positionError }}</p>
      </div>
      <div class="body-map-canvas">
        <div ref="figureEl" class="body-silhouette"
          role="group" :aria-label="(view==='front'?'正面':'背面')+'身体健康关注位置'">
          <!-- Opaque interior layer hides the grid under the person.
               Foreground is the original, unchanged clean SVG outline. -->
          <svg class="body-interior" viewBox="390 40 244 475" aria-hidden="true" focusable="false">
            <path d="M512 55 C486 55 482 91 497 116
              C502 130 481 135 455 145 C447 155 447 178 448 188
              C447 218 434 253 435 279 C435 293 418 297 419 304
              C422 313 429 304 436 298 C424 337 450 339 448 308
              C452 280 467 238 471 199 C478 232 465 284 468 311
              C467 344 476 381 473 416 C472 447 479 482 467 499
              L467 504 L495 504 C496 494 496 466 499 432
              C502 386 504 344 510 303 L514 303
              C520 344 522 386 525 432 C529 466 528 494 529 504
              L557 504 C545 488 550 450 552 416
              C549 383 557 344 556 311 C558 283 545 232 552 199
              C557 239 572 279 576 308 C574 339 600 337 598 298
              C605 304 612 313 605 304 C590 293 589 279 589 268
              C586 241 576 218 576 188 C577 178 577 155 569 145
              C543 135 522 130 527 116 C542 91 538 55 512 55 Z"
              fill="var(--health-surface)"/>
          </svg>
          <img class="body-artwork" :src="imageSrc" alt="" width="244" height="475" draggable="false"/>
          <button v-for="spot in spots" :key="spot.concern.id" type="button"
            class="body-region-marker"
            :class="{selected:selectedConcern===spot.concern.id}"
            :style="{left:(spot.point.x*100)+'%',top:(spot.point.y*100)+'%'}"
            :title="spot.concern.name" :aria-label="spot.concern.name+'，选择关注位置'"
            :aria-pressed="selectedConcern===spot.concern.id"
            @click="selectDot(spot.concern.id)">
            <span class="body-hotspot-dot" aria-hidden="true"/>
          </button>
          <button v-if="locatingConcern" class="body-map-position-layer" type="button"
            aria-label="在人体轮廓内点击定位" @click="pickPoint"><span>点击定位</span></button>
          <span v-if="pendingPoint" class="body-pending-dot"
            :style="{left:(pendingPoint.x*100)+'%',top:(pendingPoint.y*100)+'%'}"/>
        </div>
      </div>
      <p class="body-map-note"><Info :size="14"/> 标记是关注位置，不代表医学诊断。</p>
    </section>

    <aside class="body-explorer-aside">
      <section ref="recordsCardEl" class="ui-card body-region-card" aria-label="当前视图的健康问题">
        <div class="body-region-card-heading">
          <h2>{{ view==='front'?'正面关注':'背面关注' }}</h2>
        </div>
        <div v-for="spot in spots" :key="spot.concern.id"
          class="body-concern-item" :class="{selected:selectedConcern===spot.concern.id}">
          <button type="button" class="body-concern-open" @click="emit('openConcern',spot.concern.id)">
            <span class="list-icon"><HeartPulse :size="18"/></span>
            <span class="row-main"><b>{{ spot.concern.name }}</b><small>{{ spot.concern.summary }}</small></span>
            <ChevronRight :size="17" class="subtle-icon"/>
          </button>
          <button class="body-concern-pin" type="button"
            :title="'调整'+spot.concern.name+'的标记位置'"
            :aria-label="'调整'+spot.concern.name+'的标记位置'"
            @click="beginPlacement(spot.concern.id)"><MapPin :size="17"/></button>
        </div>
        <p v-if="!spots.length" class="body-region-empty">这面还没有标记。可以切换另一面查看。</p>
      </section>
      <section v-if="unplaced.length" class="ui-card body-unmapped-card">
        <div class="card-heading"><h2>未定位的问题</h2><CircleDot :size="18" class="subtle-icon"/></div>
        <div v-for="concern in unplaced" :key="concern.id" class="body-concern-item">
          <button type="button" class="body-concern-open" @click="emit('openConcern',concern.id)">
            <span class="row-main"><b>{{ concern.name }}</b><small>{{ concern.summary }}</small></span>
            <ChevronRight :size="16"/>
          </button>
          <button type="button" class="body-concern-pin"
            :title="'给'+concern.name+'定位'" :aria-label="'给'+concern.name+'定位'"
            @click="beginPlacement(concern.id)"><MapPin :size="18"/></button>
        </div>
      </section>
    </aside>
  </div>
</template>

<style scoped>
:global(.body-overview) { container-type:inline-size; }
.body-explorer {display:grid;grid-template-columns:minmax(0,1.05fr) minmax(19rem,.95fr);gap:var(--health-page-gap);align-items:start;}
.body-figure-card,.body-explorer-aside {min-width:0;}
.body-explorer-aside {display:grid;gap:var(--health-page-gap);}
.body-view-switch {display:flex;align-items:center;gap:.3rem;margin:0 0 .5rem;}
.body-view-switch button {display:flex;align-items:center;gap:.4rem;min-height:2.5rem;padding:.5rem .9rem;background:transparent;border:1px solid var(--health-border);border-radius:var(--health-radius-pill);font-size:var(--health-type-label);color:var(--health-muted);font-weight:650;}
.body-view-switch button.active {background:var(--health-brand-subtle);border-color:var(--health-brand);color:var(--health-brand-strong);}
.body-view-switch button:focus-visible {outline:2px solid var(--health-brand);outline-offset:2px;}
.body-view-count {min-width:1.3rem;padding:0 .24rem;border-radius:1rem;background:var(--health-highlight);color:var(--health-muted);font-variant-numeric:tabular-nums;text-align:center;}
.body-view-count.hasItems {background:color-mix(in srgb,var(--health-brand) 18%,var(--health-surface));color:var(--health-brand-strong);}
.body-map-canvas {position:relative;isolation:isolate;display:grid;place-items:center;min-height:26rem;overflow:hidden;margin:var(--aloha-space-3) 0;background:var(--health-surface);}
.body-map-canvas::before {content:'';position:absolute;inset:5%;z-index:0;pointer-events:none;background-image:linear-gradient(to right,color-mix(in srgb,var(--health-ink) 7%,transparent) 1px,transparent 1px),linear-gradient(to bottom,color-mix(in srgb,var(--health-ink) 7%,transparent) 1px,transparent 1px);background-size:36px 36px;mask-image:radial-gradient(ellipse at center,black 43%,transparent 85%);-webkit-mask-image:radial-gradient(ellipse at center,black 43%,transparent 85%);}
.body-silhouette {position:relative;z-index:1;width:min(100%,15rem);aspect-ratio:244 / 475;flex:none;}
.body-interior,.body-artwork {position:absolute;inset:0;display:block;width:100%;height:100%;pointer-events:none;user-select:none;}
.body-artwork {object-fit:contain;}
.body-region-marker {position:absolute;z-index:2;display:grid;place-items:center;width:2.75rem;height:2.75rem;border:0;background:transparent;border-radius:50%;transform:translate(-50%,-50%);padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent;}
.body-hotspot-dot {display:block;width:.5rem;height:.5rem;border-radius:50%;background:var(--health-brand);border:1px solid var(--health-surface);box-shadow:0 0 0 2px var(--health-surface);pointer-events:none;}
.body-region-marker:focus-visible .body-hotspot-dot {box-shadow:0 0 0 3px color-mix(in srgb,var(--health-brand) 23%,transparent),0 0 0 8px color-mix(in srgb,var(--health-brand) 8%,transparent);}
@media(hover:hover) and (pointer:fine) {.body-region-marker:hover .body-hotspot-dot {box-shadow:0 0 0 3px color-mix(in srgb,var(--health-brand) 23%,transparent),0 0 0 8px color-mix(in srgb,var(--health-brand) 8%,transparent);}}
.body-region-marker.selected .body-hotspot-dot {box-shadow:0 0 0 3px color-mix(in srgb,var(--health-brand) 24%,transparent),0 0 0 7px color-mix(in srgb,var(--health-brand) 8%,transparent);}
.body-region-marker:focus-visible {outline:2px solid var(--health-brand);outline-offset:1px;}
.body-map-position-layer {position:absolute;inset:0;z-index:4;width:100%;height:100%;border:0;background:color-mix(in srgb,var(--health-brand-subtle) 11%,transparent);cursor:crosshair;display:grid;place-items:end center;padding:var(--aloha-space-2);}
.body-map-position-layer span {background:var(--health-surface);color:var(--health-brand-strong);padding:.3rem .6rem;border-radius:var(--health-radius-pill);font-size:var(--health-type-caption);pointer-events:none;}
.body-pending-dot {position:absolute;z-index:5;pointer-events:none;width:.65rem;height:.65rem;transform:translate(-50%,-50%);border-radius:50%;background:var(--health-brand);box-shadow:0 0 0 4px color-mix(in srgb,var(--health-brand) 25%,transparent),0 0 0 10px color-mix(in srgb,var(--health-brand) 10%,transparent);}
.body-position-instruction {display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.55rem;padding:.65rem .75rem;border:1px solid var(--health-brand);border-radius:var(--health-radius-control);background:var(--health-brand-subtle);color:var(--health-brand-strong);font-size:var(--health-type-label);}
.body-position-actions {display:flex;gap:.4rem;}
.body-position-actions button {min-height:2.4rem;}
.body-position-error {flex-basis:100%;margin:0;font-size:var(--health-type-caption);color:var(--health-danger);}
.body-map-note {display:flex;align-items:flex-start;gap:.35rem;margin:.6rem 0 0;color:var(--health-muted);font-size:var(--health-type-caption);line-height:1.5;}
.body-map-note svg {flex:none;margin-top:.12rem;}
.body-region-card {scroll-margin-top:5rem;min-height:8rem;}
.body-region-card-heading {margin-bottom:.5rem;}
.body-region-card-heading h2,.card-heading h2 {margin:0;font-size:var(--health-type-section);font-weight:680;}
.body-concern-item {display:flex;align-items:center;gap:.2rem;border-bottom:1px solid var(--health-border-soft);}
.body-concern-item:last-child {border-bottom:0;}
.body-concern-item.selected {background:var(--health-brand-subtle);border-radius:var(--health-radius-control);}
.body-concern-open {display:flex;align-items:center;gap:.6rem;flex:1;min-width:0;border:0;text-align:left;background:transparent;color:var(--health-ink);padding:.65rem .2rem;}
.body-concern-open:hover .row-main b {color:var(--health-brand-strong);}
.body-concern-pin {display:grid;place-items:center;flex:none;width:2.75rem;height:2.75rem;border:0;border-radius:var(--health-radius-control);color:var(--health-muted);background:transparent;}
.body-concern-pin:hover,.body-concern-pin:focus-visible {color:var(--health-brand-strong);background:var(--health-brand-subtle);}
.body-region-empty {margin:.8rem 0 0;color:var(--health-muted);font-size:var(--health-type-body);line-height:1.6;}
@container (max-width:51rem){.body-explorer{grid-template-columns:minmax(0,1fr)}.body-map-canvas{min-height:21rem}.body-silhouette{width:min(100%,14rem)}}
@media(max-width:47.999rem){.body-explorer{grid-template-columns:minmax(0,1fr)}.body-map-canvas{min-height:19rem}.body-silhouette{width:min(100%,13.5rem)}}
@media(prefers-reduced-motion:no-preference){.body-hotspot-dot{transition:box-shadow var(--health-motion) ease}}
</style>
