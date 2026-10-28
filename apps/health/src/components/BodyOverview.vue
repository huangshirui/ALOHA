<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { attentionColor, attentionLabel, type ConcernAttention } from '../concern-attention'
import { ChevronRight, HeartPulse, Info, MapPin, Search } from 'lucide-vue-next'
import {
  countForView, isPointOnBody, normalizedPoint, visibleHotspots, BODY_MAP_ASSET_IDS,
  type BodyMapBinding, type BodyMapConcern, type BodyPoint, type BodyView,
} from '../body-map'

const props=defineProps<{concerns:BodyMapConcern[];bindings:BodyMapBinding[];view:BodyView;selectedConcernId:string|null;attentionByConcern:Record<string,ConcernAttention>}>()
const emit=defineEmits<{
  openConcern:[id:string]
  'update:view':[view:BodyView]
  'update:selectedConcernId':[id:string|null]
  placePoint:[id:string,view:BodyView,point:BodyPoint]
}>()
const imageSrc=(side:BodyView)=>import.meta.env.BASE_URL+'body-'+side+'-outline.svg'
const sides:BodyView[]=['front','back']
const search=ref('')
const locatingConcern=ref<string|null>(null)
const pendingPoint=ref<BodyPoint|null>(null)
const positionError=ref('')
const figureRefs:Partial<Record<BodyView,HTMLElement>>={}
function setFigureRef(side:BodyView,el:unknown){ if(el) figureRefs[side]=el as HTMLElement }
const explorerEl=ref<HTMLElement|null>(null)
const recordsCardEl=ref<HTMLElement|null>(null)
const spotsFor=(side:BodyView)=>visibleHotspots(props.concerns,props.bindings,side)
const filteredConcerns=computed(()=>{
  const term=search.value.trim().toLowerCase()
  return props.concerns
    .filter(c=>(c.name+' '+c.summary).toLowerCase().includes(term))
    .sort((a,b)=>Number(b.id===props.selectedConcernId)-Number(a.id===props.selectedConcernId))
})
function locationLabel(id:string){
  const binding=props.bindings.find(b=>b.concernId===id && b.assetId===BODY_MAP_ASSET_IDS[b.view])
  return binding ? (binding.view==='front'?'正面':'背面') : '未定位'
}
const counts=computed(()=>({
  front:countForView(props.concerns,props.bindings,'front'),
  back:countForView(props.concerns,props.bindings,'back'),
}))
const locatingName=computed(()=>props.concerns.find(c=>c.id===locatingConcern.value)?.name||'健康问题')
function switchView(next:BodyView) {
  emit('update:view',next)
  emit('update:selectedConcernId',null)
  pendingPoint.value=null
  positionError.value=''
}
async function selectDot(id:string,side:BodyView){
  search.value=''
  emit('update:view',side)
  emit('update:selectedConcernId',id)
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
  if(existing) emit('update:view',existing.view)
  await nextTick()
  figureRefs[existing?.view??props.view]?.scrollIntoView({block:'center',behavior:'smooth'})
}
function pickPoint(event:MouseEvent,side:BodyView){
  if(!locatingConcern.value)return
  const bounds=figureRefs[side]?.getBoundingClientRect()
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
  emit('update:view',side)
  pendingPoint.value=normalizedPoint(x,y)
}
function cancelPlacement(){
  locatingConcern.value=null;pendingPoint.value=null;positionError.value=''
}
function confirmPlacement(){
  if(!locatingConcern.value||!pendingPoint.value)return
  const id=locatingConcern.value
  emit('placePoint',id,props.view,pendingPoint.value)
  emit('update:selectedConcernId',id)
  cancelPlacement()
}
</script>

<template>
  <div ref="explorerEl" class="body-explorer">
    <section class="ui-card body-figure-card" aria-label="健康关注位置图">
      <div class="body-view-switch" role="group" aria-label="人体视图">
        <button v-for="side in sides" :key="side" type="button"
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
        <div class="body-map-pair">
          <div v-for="side in sides" :key="side" class="body-map-figure" :class="{'is-current':view===side}">
            <div class="body-figure-label"><span>{{ side==='front'?'正面':'背面' }}</span><small>{{ counts[side] }} 项</small></div>
            <div :ref="el=>setFigureRef(side,el)" class="body-silhouette"
          role="group" :aria-label="(side==='front'?'正面':'背面')+'身体健康关注位置'">
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
          <img class="body-artwork" :src="imageSrc(side)" alt="" width="244" height="475" draggable="false"/>
          <button v-for="spot in spotsFor(side)" :key="spot.concern.id" type="button"
            class="body-region-marker"
            :class="{selected:selectedConcernId===spot.concern.id}"
            :style="{left:(spot.point.x*100)+'%',top:(spot.point.y*100)+'%', '--body-dot-color':attentionColor(attentionByConcern[spot.concern.id]??'unset')}"
            :title="spot.concern.name+' · '+attentionLabel(attentionByConcern[spot.concern.id]??'unset')" :aria-label="spot.concern.name+'，'+attentionLabel(attentionByConcern[spot.concern.id]??'unset')+'，选择关注位置'"
            :aria-pressed="selectedConcernId===spot.concern.id"
            @click="selectDot(spot.concern.id,side)">
            <span class="body-hotspot-dot" aria-hidden="true"/>
          </button>
          <button v-if="locatingConcern" class="body-map-position-layer" type="button"
            aria-label="在人体轮廓内点击定位" @click="pickPoint($event,side)"><span>点击定位</span></button>
          <span v-if="pendingPoint && view===side" class="body-pending-dot"
            :style="{left:(pendingPoint.x*100)+'%',top:(pendingPoint.y*100)+'%'}"/>
        </div>
          </div>
        </div>
      </div>
      <p class="body-map-note"><Info :size="14"/> 标记是关注位置，不代表医学诊断。</p>
    </section>

    <aside class="body-explorer-aside" aria-label="健康关注事项">
      <section ref="recordsCardEl" class="ui-card body-region-card" aria-label="全部健康关注">
        <div class="body-region-card-heading">
          <h2>关注事项</h2>
          <span class="body-concern-count">{{ concerns.length }} 项</span>
        </div>
        <label class="body-concern-search">
          <Search :size="17" aria-hidden="true"/>
          <input v-model="search" type="search" aria-label="搜索关注事项" placeholder="搜索关注事项"/>
        </label>
        <div v-for="concern in filteredConcerns" :key="concern.id"
          class="body-concern-item" :class="{selected:selectedConcernId===concern.id}">
          <button type="button" class="body-concern-open" @click="emit('openConcern',concern.id)">
            <span class="list-icon"><HeartPulse :size="18"/></span>
            <span class="row-main">
              <b>{{ concern.name }}</b>
              <small>{{ locationLabel(concern.id) }} · {{ concern.status==='active'?'关注中':'已结束' }}{{ concern.summary?' · '+concern.summary:'' }}</small>
              <span class="body-attention-label" :style="{'--body-dot-color':attentionColor(attentionByConcern[concern.id]??'unset')}">
                <i aria-hidden="true"/>{{ attentionLabel(attentionByConcern[concern.id]??'unset') }}
              </span>
            </span>
            <ChevronRight :size="17" class="subtle-icon"/>
          </button>
          <button type="button" class="body-concern-pin"
            :title="'给'+concern.name+'定位或调整位置'"
            :aria-label="'给'+concern.name+'定位或调整位置'"
            @click="beginPlacement(concern.id)">
            <MapPin :size="17"/>
          </button>
        </div>
        <p v-if="!filteredConcerns.length" class="body-region-empty">
          {{ search?'没有找到相关关注事项。':'还没有关注事项，添加后即可在身体图上标记位置。' }}
        </p>
      </section>
    </aside>
  </div>
</template>

<style scoped>
:global(.body-overview) { container-type:inline-size; }
.body-explorer {display:grid;grid-template-columns:minmax(0,1.05fr) minmax(19rem,.95fr);gap:var(--health-page-gap);align-items:start;}
.body-figure-card,.body-explorer-aside {min-width:0;}
.body-figure-card {container:bodyfigure / inline-size;}
.body-map-pair {display:grid;grid-template-columns:minmax(0,1fr);width:100%;}
.body-map-figure {display:none;flex-direction:column;align-items:center;min-width:0;}
.body-map-figure.is-current {display:flex;}
.body-figure-label {display:none;align-items:center;justify-content:center;gap:.55rem;margin:0 0 .35rem;color:var(--health-muted);font-size:var(--health-type-caption);}
.body-figure-label small {color:var(--health-brand-strong);font-size:inherit;}

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
.body-hotspot-dot {
  display:block;width:.625rem;height:.625rem;border-radius:50%;
  background:var(--body-dot-color,var(--health-attention-unset));
  border:1px solid var(--health-surface);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--body-dot-color) 13%,transparent),
             0 0 0 8px color-mix(in srgb,var(--body-dot-color) 5%,transparent);
  pointer-events:none;
}
.body-region-marker:focus-visible .body-hotspot-dot {box-shadow:0 0 0 4px color-mix(in srgb,var(--body-dot-color) 24%,transparent),0 0 0 9px color-mix(in srgb,var(--body-dot-color) 9%,transparent);}
@media(hover:hover) and (pointer:fine) {.body-region-marker:hover .body-hotspot-dot {box-shadow:0 0 0 4px color-mix(in srgb,var(--body-dot-color) 23%,transparent),0 0 0 10px color-mix(in srgb,var(--body-dot-color) 8%,transparent);}}
.body-region-marker.selected .body-hotspot-dot {box-shadow:0 0 0 4px color-mix(in srgb,var(--body-dot-color) 30%,transparent),0 0 0 9px color-mix(in srgb,var(--body-dot-color) 11%,transparent);}
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
.body-region-card-heading {display:flex;align-items:center;justify-content:space-between;gap:.7rem;margin-bottom:.75rem;}
.body-concern-count {white-space:nowrap;font-size:var(--health-type-caption);color:var(--health-muted);}
.body-concern-search {display:flex;align-items:center;gap:.5rem;padding:.65rem .75rem;margin-bottom:.35rem;border:1px solid var(--health-border);border-radius:var(--health-radius-control);color:var(--health-muted);background:var(--health-surface);}
.body-concern-search input {border:0;background:transparent;color:var(--health-ink);width:100%;min-width:0;outline:none;font:inherit;font-size:var(--health-type-body);}
.body-concern-search:focus-within {outline:2px solid var(--health-brand);outline-offset:2px;}
.body-region-card-heading h2,.card-heading h2 {margin:0;font-size:var(--health-type-section);font-weight:680;}
.body-concern-item {display:flex;align-items:center;gap:.2rem;border-bottom:1px solid var(--health-border-soft);}
.body-concern-item:last-child {border-bottom:0;}
/* Selected list items use an extremely light, even outline. No left accent bar. */
.body-concern-item.selected {
  background:color-mix(in srgb,var(--health-brand) 3%,var(--health-surface));
  box-shadow:0 0 0 1px color-mix(in srgb,var(--health-brand) 18%,var(--health-border-soft));
  border-radius:var(--health-radius-control);
}
.body-concern-open {display:flex;align-items:center;gap:.6rem;flex:1;min-width:0;border:0;text-align:left;background:transparent;color:var(--health-ink);padding:.65rem .2rem;}
.body-concern-open:hover .row-main b {color:var(--health-brand-strong);}
.body-attention-label {display:inline-flex;align-items:center;gap:.35rem;margin-top:.18rem;font-size:var(--health-type-caption);color:var(--health-muted);}
.body-attention-label i {display:inline-block;flex:none;width:.45rem;height:.45rem;border-radius:50%;background:var(--body-dot-color);}
.body-concern-pin {display:grid;place-items:center;flex:none;width:2.75rem;height:2.75rem;border:0;border-radius:var(--health-radius-control);color:var(--health-muted);background:transparent;}
.body-concern-pin:hover,.body-concern-pin:focus-visible {color:var(--health-brand-strong);background:var(--health-brand-subtle);}
.body-region-empty {margin:.8rem 0 0;color:var(--health-muted);font-size:var(--health-type-body);line-height:1.6;}
@container (max-width:51rem){.body-explorer{grid-template-columns:minmax(0,1fr)}.body-map-canvas{min-height:21rem}.body-silhouette{width:min(100%,14rem)}}
@media(max-width:47.999rem){.body-explorer{grid-template-columns:minmax(0,1fr)}.body-map-canvas{min-height:19rem}.body-silhouette{width:min(100%,13.5rem)}}
/* Calculated from 2 × 11.5rem usable figures + .75rem gap + 6rem
   breathing space = 29.75rem. 30rem is a first usable-width threshold,
   independent of whether an AI panel is open. */
@container bodyfigure (min-width:30rem) {
  .body-view-switch {display:none;}
  .body-map-pair {
    grid-template-columns:repeat(2,minmax(0,11.75rem));
    justify-content:center;
    column-gap:.75rem;
    align-items:start;
  }
  .body-map-figure {display:flex;}
  .body-figure-label {display:flex;}
  .body-silhouette {width:min(100%,11.5rem);}
}
@media(prefers-reduced-motion:no-preference){
  .body-hotspot-dot {transition:box-shadow var(--health-motion) ease;}
  .body-region-marker.selected .body-hotspot-dot {animation:health-attention-breathe 3s ease-in-out infinite;}
}
@keyframes health-attention-breathe {
  0%,100% {box-shadow:0 0 0 4px color-mix(in srgb,var(--body-dot-color) 30%,transparent),
                      0 0 0 9px color-mix(in srgb,var(--body-dot-color) 11%,transparent);}
  50% {box-shadow:0 0 0 5px color-mix(in srgb,var(--body-dot-color) 27%,transparent),
                   0 0 0 12px color-mix(in srgb,var(--body-dot-color) 7%,transparent);}
}
</style>
