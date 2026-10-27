<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight, HeartPulse, Info, MapPin, Route, CircleDot } from 'lucide-vue-next'
import {
  bodyRegions, concernsForRegion, unmappedConcerns,
  type BodyMapBinding, type BodyMapConcern, type BodyRegionId,
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
}>()
const selected = computed(()=>bodyRegions.find(region=>region.id===props.selectedRegion)!)
const inRegion = computed(()=>concernsForRegion(props.concerns,props.bindings,props.selectedRegion))
const unassigned = computed(()=>unmappedConcerns(props.concerns,props.bindings))
const activeConcerns = computed(()=>props.concerns.filter(c=>c.status==='active'))
const markedCount = computed(()=>props.concerns.filter(c=>props.bindings.some(b=>b.concernId===c.id)).length)
const mappedRegions = computed(()=>bodyRegions.filter(region=>concernsForRegion(activeConcerns.value,props.bindings,region.id).length>0).length)
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
        <div>
          <span class="eyebrow">从身体部位探索</span>
          <h2 id="body-map-heading">身体健康图</h2>
          <p>点击图上的标记，查看该部位正在关注的健康问题。</p>
        </div>
        <span class="body-map-total"><MapPin :size="15"/>{{ mappedRegions }} 个部位</span>
      </div>
      <div class="body-map-canvas">
        <div class="body-silhouette" role="img" aria-label="无性别的正面抽象人体轮廓，标记头颈、胸部、腹部、上肢和下肢">
          <svg viewBox="0 0 320 520" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="aloha-body-silhouette" x1="0%" y1="0%" x2="100%" y2="95%">
                <stop offset="0%" stop-color="var(--health-illustration)"/>
                <stop offset="100%" stop-color="var(--health-brand-subtle)"/>
              </linearGradient>
            </defs>
            <!-- Simple front-facing, deliberately nongendered abstract silhouette. -->
            <ellipse cx="160" cy="71" rx="34" ry="43" class="body-shape"/>
            <path d="M146 110 L146 128 Q160 139 174 128 L174 110" class="body-shape"/>
            <path d="M128 132 Q160 145 192 132 L211 148 Q222 160 219 186 L209 248 Q206 270 202 298 L118 298 Q114 271 111 248 L101 186 Q98 160 109 148 Z" class="body-shape"/>
            <path d="M108 153 Q87 151 79 173 L52 271 Q46 291 48 318 Q49 327 57 329 Q66 330 69 319 L101 229 L115 178 Z" class="body-shape"/>
            <path d="M212 153 Q233 151 241 173 L268 271 Q274 291 272 318 Q271 327 263 329 Q254 330 251 319 L219 229 L205 178 Z" class="body-shape"/>
            <path d="M118 289 L157 289 L155 369 L144 462 Q143 480 136 489 L117 489 Q109 482 115 467 L111 370 Z" class="body-shape"/>
            <path d="M163 289 L202 289 L209 370 L203 467 Q209 482 201 489 L182 489 Q175 480 176 462 L165 369 Z" class="body-shape"/>
            <!-- Light anatomy-free axis / segment hints: guides, not diagnoses. -->
            <path d="M126 208 Q160 219 194 208 M129 263 Q160 271 191 263 M160 156 L160 280" class="body-guide"/>
          </svg>
          <button v-for="region in bodyRegions" :key="region.id"
            type="button"
            :style="{left:region.markerX+'%',top:region.markerY+'%'}"
            :class="['body-region-marker',{selected:selectedRegion===region.id, populated:countInRegion(region.id)>0}]"
            :aria-label="region.label + (countInRegion(region.id)?'，'+countInRegion(region.id)+'项正在关注':'，暂无关注')"
            :aria-pressed="selectedRegion===region.id"
            @click="emit('selectRegion',region.id)">
            <span class="body-marker-count">{{ countInRegion(region.id)>0?countInRegion(region.id):'·' }}</span>
            <span class="body-marker-name">{{ region.label }}</span>
          </button>
        </div>
      </div>
      <div class="body-map-key"><span class="body-key-dot active"></span>有关注事项 <span class="body-key-dot"></span>暂无关注 <span class="body-key-outline"></span>当前选择</div>
      <p class="body-map-note"><Info :size="14"/> 身体图仅用于查找相关健康问题，不代表医学诊断或风险等级。</p>
    </section>

    <aside class="body-explorer-aside" aria-label="身体图关联的健康问题">
      <section class="ui-card body-region-card">
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
        <p v-if="!inRegion.length" class="body-region-empty">这个部位还没有关联健康问题。你可以查看其他部位，或为已有的健康问题指定部位。</p>
      </section>
      <section class="ui-card body-region-summary">
        <div class="card-heading"><div><span class="eyebrow">关注概况</span><h2>身体关注分布</h2></div><Route :size="19" class="subtle-icon"/></div>
        <div class="body-summary-stats">
          <div><strong>{{ activeConcerns.length }}</strong><span>持续关注</span></div>
          <div><strong>{{ mappedRegions }}</strong><span>已标记部位</span></div>
          <div><strong>{{ Math.max(0,props.concerns.length-markedCount) }}</strong><span>未标记部位</span></div>
        </div>
        <p>这里只整理关注位置，具体记录、指标和健康方案仍在对应的健康问题中查看。</p>
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
          </label>
        </div>
      </section>
    </aside>
  </div>
</template>

<style scoped>
.body-explorer { display:grid;grid-template-columns:minmax(0,1.1fr) minmax(17rem,.9fr);gap:var(--health-page-gap);align-items:start; }
.body-figure-card { min-width:0; }
.body-card-heading,.body-region-card-heading { display:flex;align-items:flex-start;justify-content:space-between;gap:var(--aloha-space-3); }
.body-card-heading h2,.body-region-card-heading h2 { margin:0 0 .28rem;font-size:var(--health-type-section);letter-spacing:-.02em; }
.body-card-heading p,.body-region-card-heading p { margin:0;color:var(--health-muted);font-size:var(--health-type-caption);line-height:1.55; }
.body-map-total { display:inline-flex;align-items:center;gap:.3rem;white-space:nowrap;font-size:var(--health-type-caption);color:var(--health-brand-strong);background:var(--health-brand-subtle);border-radius:var(--health-radius-pill);padding:.3rem .6rem; }
.body-map-canvas { display:grid;place-items:center;margin:var(--aloha-space-4) 0;min-height:27rem;border-radius:var(--health-radius-card);background:radial-gradient(ellipse at 50% 45%,var(--health-brand-subtle) 0%,var(--health-highlight) 42%,transparent 80%); }
.body-silhouette { position:relative;width:min(100%,19.5rem);aspect-ratio:320 / 520; }
.body-silhouette svg { display:block;height:100%;width:100%;overflow:visible; }
.body-shape { fill:url(#aloha-body-silhouette);stroke:var(--health-brand);stroke-opacity:.35;stroke-width:1.5;stroke-linejoin:round; }
.body-guide { fill:none;stroke:var(--health-brand);stroke-opacity:.19;stroke-width:1.6;stroke-linecap:round; }
.body-region-marker { position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.22rem;min-width:3.2rem;min-height:3.15rem;transform:translate(-50%,-50%);padding:.2rem .28rem;border:0;background:transparent;color:var(--health-muted); }
.body-marker-count { display:grid;place-items:center;width:2.1rem;height:2.1rem;border:1.5px solid var(--health-border);border-radius:50%;background:var(--health-surface);box-shadow:var(--health-shadow-card);color:var(--health-muted);font-size:var(--health-type-label);font-weight:780;line-height:1; }
.body-region-marker.populated .body-marker-count { background:var(--health-brand);border-color:var(--health-brand);color:var(--health-surface); }
.body-region-marker.selected .body-marker-count { outline:3px solid color-mix(in srgb,var(--health-brand) 40%,transparent);outline-offset:3px; }
.body-region-marker:hover .body-marker-count { transform:scale(1.08); }
.body-region-marker:focus-visible { outline:2px solid var(--health-brand);outline-offset:4px;border-radius:var(--health-radius-control); }
.body-marker-name { display:block;padding:.1rem .26rem;background:var(--health-surface);border-radius:var(--health-radius-pill);font-size:.66rem;font-weight:680;line-height:1.3;white-space:nowrap; }
.body-region-marker.selected .body-marker-name { color:var(--health-brand-strong); }
.body-map-key { display:flex;gap:.45rem .65rem;align-items:center;flex-wrap:wrap;font-size:var(--health-type-caption);color:var(--health-muted); }
.body-key-dot { width:.58rem;height:.58rem;border-radius:50%;background:var(--health-surface);border:1px solid var(--health-border); }
.body-key-dot.active { background:var(--health-brand);border-color:var(--health-brand); }
.body-key-outline { width:.64rem;height:.64rem;border-radius:50%;border:2px solid var(--health-brand); }
.body-map-note { display:flex;align-items:flex-start;gap:.35rem;margin:.65rem 0 0;color:var(--health-muted);font-size:var(--health-type-caption);line-height:1.5; }
.body-map-note svg { flex:none;margin-top:.12rem; }
.body-explorer-aside { display:grid;gap:var(--health-page-gap);min-width:0; }
.body-region-card { min-height:11rem; }
.body-region-card-heading { margin-bottom:var(--aloha-space-3); }
.body-region-card-heading .status-chip { font-size:.67rem; }
.body-region-empty { margin:1rem 0 0;font-size:var(--health-type-body);color:var(--health-muted);line-height:1.7; }
.body-summary-stats { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.4rem; }
.body-summary-stats div { display:flex;flex-direction:column;gap:.25rem;border-radius:var(--health-radius-control);padding:.6rem .4rem;background:var(--health-highlight); }
.body-summary-stats strong { font-size:var(--health-type-page);color:var(--health-brand-strong);line-height:1.25; }
.body-summary-stats span { font-size:var(--health-type-caption);color:var(--health-muted);line-height:1.4; }
.body-region-summary>p { margin:.8rem 0 0;font-size:var(--health-type-caption);color:var(--health-muted);line-height:1.65; }
.body-unmapped-item + .body-unmapped-item { border-top:1px solid var(--health-border-soft);margin-top:.65rem;padding-top:.65rem; }
.body-unmapped-link { margin-bottom:.35rem; }
.body-unmapped-item label { display:flex;flex-direction:column;gap:.4rem;font-size:var(--health-type-caption);color:var(--health-muted); }
.body-unmapped-item select { border:1px solid var(--health-border);border-radius:var(--health-radius-control);padding:.65rem;background-color:var(--health-surface);font-size:var(--health-type-label);color:var(--health-ink); }
@media(max-width:75rem) { .body-explorer { grid-template-columns:minmax(0,1fr); } .body-figure-card { max-width:100%; } .body-map-canvas { min-height:23rem; } .body-silhouette { width:min(100%,16rem); } .body-explorer-aside { grid-template-columns:repeat(2,minmax(0,1fr)); } .body-region-card { grid-column:1 / -1; } }
@media(max-width:47.999rem) { .body-explorer-aside { grid-template-columns:minmax(0,1fr); } .body-region-card { grid-column:auto; } .body-map-canvas { min-height:20rem;margin:var(--aloha-space-3) 0; } .body-silhouette { width:min(100%,14.5rem); } .body-card-heading { flex-direction:column;gap:.4rem; } .body-map-total { align-self:flex-start; } }
/* Respond to available content width — including the docked Agent panel —
   instead of relying on the whole viewport width. */
:global(.body-overview) { container-type:inline-size; }
@container (max-width: 52rem) {
  .body-explorer { grid-template-columns:minmax(0,1fr); }
  .body-explorer-aside { grid-template-columns:minmax(0,1fr); }
  .body-region-card { grid-column:auto; }
  .body-map-canvas { min-height:21rem; }
}
@media(prefers-reduced-motion:no-preference) { .body-marker-count { transition:transform var(--health-motion) ease; } }
</style>
