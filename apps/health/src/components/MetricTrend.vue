<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import type { EChartsType, EChartsCoreOption } from 'echarts/core'
import { formatTrendValue, referenceBounds, trendDomain, trendReadings, type NumericObservation } from '../metric-trend'

const props=defineProps<{
 observations:NumericObservation[]
 unit:string
 metricName:string
 referenceLow?:number|null
 referenceHigh?:number|null
 referenceSource?:string
 rangeStart?:string
 rangeEnd?:string
}>()
const emit=defineEmits<{openObservation:[id:string]}>()
const readings=computed(()=>trendReadings(props.observations))
const domain=computed(()=>trendDomain(readings.value,props.rangeStart,props.rangeEnd))
const bounds=computed(()=>referenceBounds(props.referenceLow,props.referenceHigh))
const plot=ref<HTMLElement|null>(null)
const activeId=ref('')
const active=computed(()=>readings.value.find(p=>p.id===activeId.value))
const failed=ref(false)
const loading=ref(false)
let chart:EChartsType|undefined
let observer:ResizeObserver|undefined
let generation=0
function css(el:HTMLElement,name:string,fallback:string){
 return getComputedStyle(el).getPropertyValue(name).trim()||fallback
}
function render(){
 if(!chart||!plot.value||!domain.value)return
 const el=plot.value
 const ink=css(el,'--health-muted','#64748b'),brand=css(el,'--health-brand','#09845e')
 const border=css(el,'--health-border-soft','#e2e8f0'),surface=css(el,'--health-surface','#ffffff')
 const warning=css(el,'--health-attention-watch','#b7791f')
 const {low,high}=bounds.value
 const compact=el.clientWidth<440
 const axisValues=[...readings.value.map(p=>p.value),...([low,high].filter((v):v is number=>v!==undefined))]
 const min=Math.min(...axisValues),max=Math.max(...axisValues)
 const span=max-min||Math.max(Math.abs(max)*.1,1)
 const stepBase=10**Math.floor(Math.log10(span/4))
 const step=[1,2,2.5,5,10].map(n=>n*stepBase).find(n=>n>=span/4)??stepBase*10
 const yMin=Number((Math.floor((min-span*.05)/step)*step).toPrecision(12))
 const yMax=Number((Math.ceil((max+span*.05)/step)*step).toPrecision(12))
 const guides=[
  ...(low===undefined?[]:[{name:low===high?'参考值':'下限',yAxis:low}]),
  ...(high===undefined||high===low?[]:[{name:'上限',yAxis:high}])
 ]
 const option:EChartsCoreOption={
  useUTC:true,animation:false,
  grid:{left:compact?54:66,right:compact?16:24,top:24,bottom:68},
  textStyle:{fontFamily:'inherit',color:ink},
  xAxis:{type:'time',min:domain.value.min,max:domain.value.max,boundaryGap:false,
   splitNumber:compact?4:8,axisLabel:{hideOverlap:true,color:ink,fontSize:compact?10:12,margin:12},
   axisLine:{lineStyle:{color:border}},axisTick:{show:true,lineStyle:{color:border}},splitLine:{show:false}},
  yAxis:{type:'value',scale:true,min:yMin,max:yMax,interval:step,
   axisLabel:{color:ink,fontSize:12,formatter:(v:number)=>formatTrendValue(v)},
   splitLine:{lineStyle:{color:border}},axisLine:{show:false},axisTick:{show:false}},
  tooltip:{trigger:'item',renderMode:'richText',confine:true,backgroundColor:surface,borderColor:border,textStyle:{color:ink},
   formatter:(params:unknown)=>{
    const index=(params as {dataIndex?:number}).dataIndex
    const p=index===undefined?undefined:readings.value[index]
    return p?p.date+'\n'+formatTrendValue(p.value)+(props.unit?' '+props.unit:''):''
   }},
  dataZoom:[{type:'inside',xAxisIndex:0,zoomOnMouseWheel:'ctrl',moveOnMouseWheel:false,filterMode:'none'},
   {type:'slider',xAxisIndex:0,bottom:12,height:20,filterMode:'none',showDetail:false,brushSelect:false,
    borderColor:border,backgroundColor:surface,fillerColor:'rgba(9,132,94,.10)',handleStyle:{color:brand,borderColor:brand},showDataShadow:false}],
  series:[{type:'line',name:props.metricName,smooth:0.35,smoothMonotone:'x',showSymbol:true,symbol:'circle',symbolSize:compact?7:8,
   lineStyle:{width:2,color:brand},itemStyle:{color:surface,borderColor:brand,borderWidth:2},
   emphasis:{scale:1.5,itemStyle:{color:brand}},clip:true,
   data:readings.value.map(p=>({value:[p.timestamp,p.value],itemStyle:{
     borderColor:(low!==undefined&&p.value<low||high!==undefined&&p.value>high)?warning:brand
   }})),
   markLine:{silent:true,symbol:'none',lineStyle:{color:warning,type:'dashed',width:1},
    label:{show:!compact,position:'insideEndTop',color:warning,formatter:'{b}: {c}'},data:guides},
   ...(low!==undefined&&high!==undefined&&low<high?{markArea:{silent:true,itemStyle:{color:'rgba(9,132,94,.065)'},
      data:[[{yAxis:low},{yAxis:high}]]}}:{})
  }]
 }
 chart.setOption(option,{notMerge:true})
}
async function mount(el:HTMLElement|null){
 const current=++generation
 observer?.disconnect();observer=undefined
 chart?.dispose();chart=undefined
 failed.value=false
 if(!el){loading.value=false;return}
 loading.value=true
 try{
  const {init}=await import('../health-chart-engine')
  if(current!==generation||plot.value!==el)return
  chart=init(el,undefined,{renderer:'svg'})
  chart.on('click',(params)=>{
   if(params.componentType==='series'&&typeof params.dataIndex==='number'){
    const p=readings.value[params.dataIndex]
    if(p)activeId.value=activeId.value===p.id?'':p.id
   }
  })
  render()
  if(typeof ResizeObserver!=='undefined'){
   let width=el.clientWidth
   observer=new ResizeObserver(()=>{
    if(!chart)return
    chart.resize()
    if((width<440)!==(el.clientWidth<440))render()
    width=el.clientWidth
   })
   observer.observe(el)
  }
 }catch{
  if(current===generation){chart?.dispose();chart=undefined;failed.value=true}
 }finally{if(current===generation)loading.value=false}
}
watch(plot,mount,{flush:'post'})
watch([readings,domain,bounds,()=>props.unit,()=>props.metricName],()=>{
 activeId.value=''
 render()
},{flush:'post'})
onBeforeUnmount(()=>{generation++;observer?.disconnect();chart?.dispose();chart=undefined})
</script>

<template>
 <section class="metric-trend" aria-label="观测趋势">
  <template v-if="readings.length">
   <div class="metric-trend-legend">
    <span><i class="trend-dot"/>实际观测 · {{ readings.length }} 次</span>
    <span v-if="bounds.low!==undefined||bounds.high!==undefined"><i class="trend-ref"/>当前指标参考边界</span>
   </div>
   <div class="metric-trend-chart-wrap">
    <div ref="plot" class="metric-trend-plot" role="img" :aria-label="metricName+'，'+readings.length+'次真实观测，按实际日期显示'"/>
    <p v-if="loading" class="metric-trend-message" role="status">正在加载趋势图…</p>
    <p v-if="failed" class="metric-trend-message" role="alert">图表加载失败。<button type="button" class="metric-trend-source" @click="mount(plot)">重试</button></p>
   </div>
   <div class="metric-trend-controls">
    <label class="metric-trend-field metric-trend-picker"><span>查看观测</span>
     <select v-model="activeId" aria-label="选择一条实际观测">
      <option value="">选择日期和数值</option>
      <option v-for="p in readings.slice().reverse()" :key="p.id" :value="p.id">{{ p.date }} · {{ formatTrendValue(p.value) }} {{ unit }}</option>
     </select>
    </label>
    <span class="metric-trend-note">拖动底部滑块缩放时间范围</span>
   </div>
   <div v-if="active" class="metric-trend-readout" role="status">
    <div class="metric-trend-readout-main">
     <span>已选 · {{ active.date }} · 原始观测</span>
     <strong>{{ formatTrendValue(active.value) }}<small v-if="unit">{{ ' '+unit }}</small></strong>
    </div>
    <button type="button" class="metric-trend-source" @click="emit('openObservation',active.id)">查看这条记录</button>
    <button type="button" class="metric-trend-clear" aria-label="取消选中图表观测点" @click="activeId=''"><X :size="16"/></button>
   </div>
   <p class="metric-trend-note">曲线仅用于连接真实观测，不代表测量间的实际变化；同日多次记录分别显示。</p>
   <p v-if="(bounds.low!==undefined||bounds.high!==undefined)&&referenceSource" class="metric-trend-note">当前参考边界来源：{{ referenceSource }}</p>
  </template>
  <div v-else class="metric-trend-empty" role="status">暂无可绘制的数值记录。添加测量后就能看到变化趋势。</div>
 </section>
</template>

<style scoped>
.metric-trend{min-width:0;margin:.5rem 0 var(--health-space-4)}
.metric-trend-legend,.metric-trend-controls{display:flex;align-items:center;gap:.65rem 1rem;flex-wrap:wrap;color:var(--health-muted);font-size:var(--health-type-caption)}
.metric-trend-legend span{display:inline-flex;align-items:center;gap:.35rem}
.trend-dot{width:.55rem;height:.55rem;border-radius:50%;border:2px solid var(--health-brand);display:inline-block}
.trend-ref{width:1rem;border-top:2px dashed var(--health-attention-watch);display:inline-block}
.metric-trend-chart-wrap{position:relative;min-width:0}
.metric-trend-plot{width:100%;height:320px;min-width:0}
.metric-trend-message{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:.5rem;color:var(--health-muted);background:var(--health-surface)}
.metric-trend-controls{justify-content:space-between;margin:.25rem 0 .65rem;gap:.45rem 1rem}
.metric-trend-controls .metric-trend-note{margin:0}
.metric-trend-picker{flex:0 1 auto;max-width:100%}
.metric-trend-readout{display:flex;align-items:center;gap:.65rem;padding:.55rem .7rem;margin:.15rem 0 .4rem;background:var(--health-surface-secondary);border:1px solid var(--health-border-soft);border-radius:var(--health-radius-control)}
.metric-trend-readout-main{display:flex;flex:1;align-items:baseline;flex-wrap:wrap;gap:.25rem .65rem;min-width:0}
.metric-trend-readout-main span{color:var(--health-muted);font-size:var(--health-type-caption)}
.metric-trend-readout-main strong{color:var(--health-ink);font-size:var(--health-type-body);font-weight:700;font-variant-numeric:tabular-nums}
.metric-trend-readout-main strong small{color:var(--health-muted);font-size:var(--health-type-caption);font-weight:500}
.metric-trend-source{flex:none;border:1px solid var(--health-border);border-radius:var(--health-radius-control);padding:.5rem .7rem;background:var(--health-surface);color:var(--health-brand-strong);font-size:var(--health-type-label)}
.metric-trend-clear{display:grid;place-items:center;flex:none;width:2rem;height:2rem;border:0;border-radius:var(--health-radius-control);background:transparent;color:var(--health-muted);font-size:1.15rem}
.metric-trend-note,.metric-trend-empty{color:var(--health-muted);font-size:var(--health-type-caption);line-height:1.7}
.metric-trend-note{margin:.3rem 0 0}
.metric-trend-empty{padding:2rem .5rem;text-align:center}
@media(max-width:47.999rem){.metric-trend-readout{flex-wrap:wrap}.metric-trend-picker{width:100%}}
</style>
