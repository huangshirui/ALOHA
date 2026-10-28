<script setup lang="ts">
import { computed, ref } from 'vue'
import { buildTrendChart, type MetricGranularity, type NumericObservation, type TrendPoint } from '../metric-trend'

const props=defineProps<{
 observations:NumericObservation[]
 unit:string
 metricName:string
}>()
const emit=defineEmits<{openObservation:[id:string]}>()
const mode=ref<MetricGranularity>('day')
const modes=[
 {value:'day' as const,label:'日'},
 {value:'month' as const,label:'月'},
 {value:'year' as const,label:'年'},
]
const chart=computed(()=>buildTrendChart(props.observations,mode.value))
const activeKey=ref('')
const active=computed<TrendPoint|null>(()=>chart.value.points.find(p=>p.key===activeKey.value)??chart.value.points.at(-1)??null)
function choosePoint(key:string){activeKey.value=key}
function formatValue(v:number){return Number(v.toFixed(2)).toLocaleString('zh-CN',{maximumFractionDigits:2})}
const periodLabel=computed(()=>mode.value==='day'?'当天':'当月':'当年')
const chartDescription=computed(()=>{
 const pts=chart.value.points
 if(!pts.length)return props.metricName+'：暂无数值记录'
 return `${props.metricName}，${mode.value==='day'?'按日':mode.value==='month'?'按月':'按年'}展示共${pts.length}个记录周期，最早${pts[0]!.key}，最新${pts[pts.length-1]!.key}。空白周期仅平滑连接，没有补充记录。`
})
</script>

<template>
 <section class="metric-trend" aria-label="观测趋势">
   <div class="metric-trend-head">
     <div class="metric-trend-switch" role="group" aria-label="选择趋势时间维度">
       <button v-for="item in modes" :key="item.value" type="button"
        :aria-pressed="mode===item.value" :class="{active:mode===item.value}" @click="mode=item.value;activeKey=''">
         {{ item.label }}
       </button>
     </div>
     <span class="metric-trend-unit">{{ unit || '无单位' }}</span>
   </div>
   <template v-if="chart.points.length">
     <div class="metric-trend-plot">
       <svg viewBox="0 0 680 224" role="img" :aria-label="chartDescription">
         <g class="metric-trend-grid">
           <line v-for="tick in chart.yTicks" :key="'g'+tick.y" :x1="52" :x2="660" :y1="tick.y" :y2="tick.y"/>
         </g>
         <g class="metric-trend-axis" aria-hidden="true">
           <text v-for="tick in chart.yTicks" :key="'y'+tick.y" x="45" :y="tick.y+4" text-anchor="end">{{ tick.label }}</text>
           <text v-for="(tick,i) in chart.ticks" :key="'x'+tick.key" :x="tick.x"
             y="214" :text-anchor="i===0?'start':i===chart.ticks.length-1?'end':'middle'">{{ tick.label }}</text>
         </g>
         <path v-if="chart.points.length>=2" class="metric-trend-line" :d="chart.path"/>
         <g v-for="point in chart.points" :key="point.key" class="metric-trend-point"
           :class="{active:active?.key===point.key}" role="button" tabindex="0"
           :aria-label="point.key+'，'+formatValue(point.value)+(unit?' '+unit:'')+'，'+point.count+'次观测'"
           @click="choosePoint(point.key)" @keydown.enter.prevent="choosePoint(point.key)"
           @keydown.space.prevent="choosePoint(point.key)">
           <circle :cx="point.x" :cy="point.y" r="16" class="metric-trend-hit"/>
           <circle :cx="point.x" :cy="point.y" r="4.5" class="metric-trend-dot"/>
         </g>
       </svg>
     </div>
     <div v-if="active" class="metric-trend-readout">
       <div class="metric-trend-readout-main">
         <span>{{ active.key }} · {{ periodLabel }}{{ active.count>1?'平均值':'观测值' }}</span>
         <strong>{{ formatValue(active.value) }}<small v-if="unit"> {{ unit }}</small></strong>
         <span>{{ active.count }} 次真实观测</span>
       </div>
       <button v-if="active.count===1" type="button" class="metric-trend-source"
         @click="emit('openObservation',active.recordIds[0]!)">查看记录</button>
     </div>
     <p class="metric-trend-note">缺少记录的周期仅连线，不代表实际测量值；月、年有多次记录时显示平均值。</p>
   </template>
   <div v-else class="metric-trend-empty" role="status">
     暂无可绘制的数值记录。添加测量后就能看到变化趋势。
   </div>
 </section>
</template>

<style scoped>
.metric-trend{min-width:0;margin:.5rem 0 var(--health-space-4)}
.metric-trend-head{display:flex;align-items:center;justify-content:space-between;gap:.8rem;flex-wrap:wrap;margin:.4rem 0 .3rem}
.metric-trend-switch{display:inline-flex;gap:.15rem;padding:.2rem;border:1px solid var(--health-border-soft);background:var(--health-surface-secondary);border-radius:var(--health-radius-control)}
.metric-trend-switch button{border:0;border-radius:calc(var(--health-radius-control) - 3px);background:transparent;min-width:2.75rem;min-height:2rem;padding:.3rem .7rem;font-size:var(--health-type-label);font-weight:600;color:var(--health-muted)}
.metric-trend-switch button.active{color:var(--health-brand-strong);background:var(--health-surface);box-shadow:0 0 0 1px var(--health-border)}
.metric-trend-switch button:focus-visible,.metric-trend-source:focus-visible{outline:2px solid var(--health-brand);outline-offset:2px}
.metric-trend-unit{color:var(--health-muted);font-size:var(--health-type-caption)}
.metric-trend-plot{width:100%;overflow-x:auto;scrollbar-width:thin}
.metric-trend-plot svg{display:block;width:100%;min-width:19rem;height:auto;overflow:visible}
.metric-trend-grid line{stroke:var(--health-border-soft);stroke-width:1}
.metric-trend-axis text{fill:var(--health-muted);font-size:12px}
.metric-trend-line{fill:none;stroke:var(--health-brand);stroke-width:2.8;stroke-linecap:round;stroke-linejoin:round}
.metric-trend-hit{fill:transparent}
.metric-trend-dot{fill:var(--health-surface);stroke:var(--health-brand);stroke-width:2.5}
.metric-trend-point{cursor:pointer;outline:none}
.metric-trend-point.active .metric-trend-dot{fill:var(--health-brand);stroke:var(--health-surface);stroke-width:2.5;filter:drop-shadow(0 0 3px color-mix(in srgb,var(--health-brand) 28%,transparent))}
.metric-trend-point:focus-visible .metric-trend-hit{stroke:var(--health-brand);stroke-width:2;fill:color-mix(in srgb,var(--health-brand) 8%,transparent)}
.metric-trend-readout{display:flex;align-items:center;justify-content:space-between;gap:.65rem;border-top:1px solid var(--health-border-soft);padding:.85rem 0}
.metric-trend-readout-main{display:flex;flex-direction:column;gap:.2rem;min-width:0}
.metric-trend-readout-main span{color:var(--health-muted);font-size:var(--health-type-caption)}
.metric-trend-readout-main strong{color:var(--health-ink);font-size:1.2rem;font-weight:720;font-variant-numeric:tabular-nums}
.metric-trend-readout-main strong small{color:var(--health-muted);font-size:var(--health-type-caption);font-weight:500}
.metric-trend-source{flex:none;border:1px solid var(--health-border);border-radius:var(--health-radius-control);padding:.5rem .75rem;background:var(--health-surface);color:var(--health-brand-strong);font-size:var(--health-type-label)}
.metric-trend-note,.metric-trend-empty{color:var(--health-muted);font-size:var(--health-type-caption);line-height:1.7}
.metric-trend-note{margin:.4rem 0 0}
.metric-trend-empty{padding:2rem .5rem;text-align:center}
@media(max-width:47.999rem){
 .metric-trend-plot svg{min-width:17.5rem}
 .metric-trend-readout{align-items:flex-start}
}
</style>
