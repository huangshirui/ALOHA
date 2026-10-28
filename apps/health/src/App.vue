<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import {
  Activity, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, CalendarDays, Check, CheckCircle2,
  ChevronDown, ChevronRight, CircleHelp, ClipboardCheck, ClipboardList, Clock3, FileHeart,
  FilePlus2, FileText, FolderHeart, Heart, HeartPulse, Home, Info, LayoutGrid, Link2,
  ListChecks, Menu, MoreHorizontal, Pencil, Plus, Search, ShieldCheck, Sparkles,
  Stethoscope, Trash2, TrendingDown, Upload, Utensils, X, PanelLeftClose, PanelLeftOpen,
} from 'lucide-vue-next'
import { useDemoAgentSession } from './agent-demo'
import AlohaHub from './components/AlohaHub.vue'
import HealthPageHeader from './components/HealthPageHeader.vue'
import HealthCreateMenu from './components/HealthCreateMenu.vue'
import BodyOverview from './components/BodyOverview.vue'
import HealthTimeline from './components/HealthTimeline.vue'
import MetricTrend from './components/MetricTrend.vue'
import ReferenceIndicator from './components/ReferenceIndicator.vue'
import {matchMetricReferenceFilter, metricReferenceState, type MetricReferenceFilter} from './metric-reference-filter'
import type { TimelineFilter } from './health-timeline'
import { compareReference,formatReferenceRange,parseReferenceDraft,validateReferenceDraft } from './health-reference'
import { seedBodyBindings, setConcernPoint, type BodyMapBinding, type BodyPoint, type BodyView } from './body-map'
import { concernAttentionOptions, attentionColor, parseConcernAttention, type ConcernAttention } from './concern-attention'
import { primaryAction, recordChoices, saveDestination, type HealthLocation } from './health-journeys'
import {
  buildObservationValue, documentTypes, eventTypes, labelFrom, makeEmpty,
  assessmentStatuses, observationValue, regimenStatuses, regimenTypes, seedDemo,
  validateConcern, validateObservation, validateRegimen, validateEventTime, valueTypes,
  type HealthKind, type Metric, type Observation, type Regimen,
} from './demo-model'

type Tab = 'home' | 'body' | 'food' | 'movement' | 'more'
type HubSection = 'apps' | 'account' | 'settings' | 'privacy' | 'help'
const hubTitles:Record<HubSection,string>={apps:'更多',account:'账号与安全',settings:'通用设置',privacy:'隐私与授权',help:'帮助与反馈'}
type BodyTab = 'focus' | 'metrics' | 'timeline' | 'documents' | 'regimens'
type Sheet = '' | 'edit' | 'import'
type RecordView = { kind: HealthKind; id: string }
const alohaApps = [
  { id:'assistant', name:'Assistant', description:'个人 AI 助手' },
  { id:'health', name:'Health', description:'健康记录与管理' },
  { id:'finance', name:'Finance', description:'财务与资产' },
  { id:'things', name:'Things', description:'物品与空间' },
]
const sidebarCollapsed = ref(false)
const uiDensity = ref<'comfortable'|'compact'>('comfortable')
const hubSection = ref<HubSection>('apps')
function handleAppSelection(id:string) {
  if (id!=='health') notice.value='此应用尚未接入本次体验。'
}
function openHubSetting(section:Exclude<HubSection,'apps'>) {
  navigate('more')
  hubSection.value=section
}
const navItems = [
  { id: 'home' as Tab, title: '首页', icon: Home },
  { id: 'body' as Tab, title: '身体', icon: HeartPulse },
  { id: 'food' as Tab, title: '饮食', icon: Utensils },
  { id: 'movement' as Tab, title: '运动', icon: Activity },
  { id: 'more' as Tab, title: '更多', icon: LayoutGrid },
]
const bodyTabs = [
  { id: 'focus' as BodyTab, title: '关注' },
  { id: 'metrics' as BodyTab, title: '指标' },
  { id: 'timeline' as BodyTab, title: '时间线' },
  { id: 'documents' as BodyTab, title: '资料' },
  { id: 'regimens' as BodyTab, title: '干预' },
]
const kindLabel: Record<HealthKind,string> = {
  concern: '健康问题', metric: '健康指标', observation: '测量记录', event: '健康事件',
  document: '健康资料', assessment: '健康评估', regimen: '健康方案',
}
const kindCollection: Record<HealthKind, keyof ReturnType<typeof seedDemo>> = {
  concern: 'concerns', metric: 'metrics', observation: 'observations', event: 'events',
  document: 'documents', assessment: 'assessments', regimen: 'regimens',
}
const kindIcon = { concern: Heart, metric: Activity, observation: ClipboardCheck, event: CalendarDays, document: FileText, assessment: BadgeCheck, regimen: ListChecks }
const demo = reactive(seedDemo())
const activeTab = ref<Tab>('home')
const bodyTab = ref<BodyTab>('focus')
const mapView = ref<BodyView>('front')
const mapSelectedConcern = ref<string|null>(null)
const bodyBindings = ref<BodyMapBinding[]>(seedBodyBindings())
// App-only user priorities; this does not extend the LifeSpace HealthConcern schema.
const attentionByConcern = ref<Record<string,ConcernAttention>>({'c-1':'watch','c-2':'routine'})
const selected = ref<RecordView | null>(null)
const routeStack = ref<HealthLocation[]>([])
const sheet = ref<Sheet>('')
const editKind = ref<HealthKind>('concern')
const editId = ref('')
const draft = ref<Record<string,any>>({})
const formError = ref('')
const search = ref('')
const timelineKind = ref<TimelineFilter>('all')
const metricReferenceFilter=ref<MetricReferenceFilter>('all')
const metricReferenceChoices=[
 {value:'all' as const,label:'全部'},
 {value:'within' as const,label:'范围内'},
 {value:'outside' as const,label:'超出范围'},
 {value:'unknown' as const,label:'未判定'},
]
const timelineScrollPosition = ref(0)
const notice = ref('')
const agentSession = useDemoAgentSession()
const agentOpen = agentSession.open
const agentMessages = agentSession.messages
const agentQuestion = ref('')
const agentThread = ref<HTMLElement | null>(null)
const agentInput = ref<HTMLTextAreaElement | null>(null)
const uploadStage = ref<1|2|3>(1)
const uploadedName = ref('')
const uploadTitle = ref('')
const uploadType = ref('lab_report')
const uploadConcernId = ref('')
const uploadIncludeResult = ref(false)
const completedPlanIds = ref<string[]>([])
const bodyCreateAction = computed(() => primaryAction(bodyTab.value))
let nextRecordId = 100
const today = new Date().toISOString().slice(0,10)
const displayDate = (date: string) => date ? date.replace(/-/g,'.') : '未填写'
const nameOfMetric = (id: string) => demo.metrics.find(x => x.id === id)?.name ?? '其他指标'
const nameOfDocument = (id: string) => demo.documents.find(x => x.id === id)?.title ?? '未找到资料'
const nameOfConcern = (id: string) => demo.concerns.find(x => x.id === id)?.name ?? '健康问题'
const getList = (kind: HealthKind): any[] => demo[kindCollection[kind]] as any[]
const current = computed<any | null>(() => selected.value ? getList(selected.value.kind).find(item=>item.id===selected.value?.id) ?? null : null)
const selectedConcern = computed(() => selected.value?.kind === 'concern' ? selected.value.id : '')
const related = (record: {concernIds?:string[]},id:string) => (record.concernIds ?? []).includes(id)
const activeConcerns = computed(() => demo.concerns.filter(c=>c.status==='active'))
const latestFor = (metricId:string) => [...demo.observations].filter(o=>o.metricId===metricId).sort((a,b)=>b.observedDate.localeCompare(a.observedDate))[0]
const referenceFor=(observation:Observation,metric?:Metric)=>metric?compareReference(metric,observation):null
const metricRangeLabel=(metric:Metric)=>formatReferenceRange(metric,metric.defaultUnit)
const observationTitle = (o: Observation) => nameOfMetric(o.metricId) + ' · ' + observationValue(o,demo.metrics.find(m=>m.id===o.metricId))
const eventName = (e: {eventType:string}) => labelFrom(eventTypes,e.eventType)
const docName = (d: {documentType:string}) => labelFrom(documentTypes,d.documentType)
const assessmentCount = computed(() => demo.assessments.length)
const docCount = computed(() => demo.documents.length)
const timeline = computed(() => [
  ...demo.observations.map(o=>({ id:o.id,kind:'observation' as const,date:o.observedDate,title:observationTitle(o),meta:'测量记录' })),
  ...demo.events.map(e=>({ id:e.id,kind:'event' as const,date:e.date,title:e.summary,meta:eventName(e)+(e.timeStart?' · '+e.timeStart:'') })),
  ...demo.assessments.map(a=>({ id:a.id,kind:'assessment' as const,date:a.assessedDate,title:a.title,meta:'评估记录' })),
].sort((a,b)=>b.date.localeCompare(a.date)))
const metricState=(m:Metric)=>metricReferenceState(m,latestFor(m.id))
const metricReferenceCounts=computed(()=>{
 const result:Record<MetricReferenceFilter,number>={all:0,within:0,outside:0,unknown:0}
 for(const metric of demo.metrics){
   if(!metric.name.toLowerCase().includes(search.value.trim().toLowerCase()))continue
   const state=metricState(metric)
   result.all++
   result[state]++
 }
 return result
})
const filteredMetrics=computed(()=>demo.metrics.filter(m=>
 m.name.toLowerCase().includes(search.value.trim().toLowerCase()) &&
 matchMetricReferenceFilter(metricState(m),metricReferenceFilter.value)
))
const filteredDocuments = computed(()=>demo.documents.filter(d=>d.title.includes(search.value) || d.issuerName.includes(search.value)))
const filteredRegimens = computed(()=>demo.regimens.filter(r=>r.name.includes(search.value)))
const filteredTimeline = computed(()=>timeline.value.filter(e=>e.title.includes(search.value) || e.meta.includes(search.value)))
const contextName = computed(()=>current.value ? (current.value.name || current.value.title || current.value.summary || nameOfMetric(current.value.metricId)) : activeTab.value === 'body' ? '身体' : navItems.find(n=>n.id===activeTab.value)?.title ?? '首页')
const concernRelated = computed(() => {
  const id = selectedConcern.value
  return {
    observations: demo.observations.filter(o=>related(o,id)),
    events: demo.events.filter(e=>related(e,id)),
    documents: demo.documents.filter(d=>related(d,id)),
    assessments: demo.assessments.filter(a=>related(a,id)),
    regimens: demo.regimens.filter(r=>related(r,id)),
  }
})
const valuePreview = computed(() => {
  if(!current.value || selected.value?.kind !== 'observation') return ''
  return observationValue(current.value,demo.metrics.find(m=>m.id===current.value.metricId))
})
function chartPoints(metricId: string) {
  const points = demo.observations.filter(o=>o.metricId===metricId && o.valueNumber!==null).sort((a,b)=>a.observedDate.localeCompare(b.observedDate))
  if(points.length < 2) return ''
  const values = points.map(p=>p.valueNumber!)
  const lo=Math.min(...values)-2, hi=Math.max(...values)+2
  return points.map((p,i)=>`${Math.round(10+320*i/(points.length-1))},${Math.round(82-60*(p.valueNumber!-lo)/(hi-lo))}`).join(' ')
}
function location(): HealthLocation {
  return { tab:activeTab.value, section:bodyTab.value, record:selected.value ? {...selected.value} : null }
}
function navigate(tab: Tab) {
  routeStack.value=[]
  activeTab.value=tab; selected.value=null; sheet.value=''; bodyTab.value='focus'; search.value=''
  if(tab==='more') hubSection.value='apps'
  window.scrollTo({top:0,behavior:'smooth'})
}
function openBody(tab: BodyTab) { navigate('body');bodyTab.value=tab }
function changeBodyTab(tab:BodyTab) {
  selected.value=null;routeStack.value=[];bodyTab.value=tab;search.value=''
}
function show(kind: HealthKind,id: string) {
  if (selected.value?.kind === kind && selected.value.id===id) return
  if(activeTab.value==='body' && bodyTab.value==='timeline' && !selected.value)
    timelineScrollPosition.value=window.scrollY
  routeStack.value.push(location())
  activeTab.value='body'; selected.value=saveDestination(kind,id);sheet.value='';search.value=''
  window.scrollTo({top:0,behavior:'smooth'})
}
function back() {
  const previous=routeStack.value.pop()
  if(previous) {
    activeTab.value=previous.tab
    bodyTab.value=previous.section
    selected.value=previous.record
  } else selected.value=null
  if(previous?.tab==='body' && previous.section==='timeline' && !previous.record)
    nextTick(()=>window.scrollTo({top:timelineScrollPosition.value,behavior:'auto'}))
  else window.scrollTo({top:0,behavior:'smooth'})
}
function startCreate(kind: HealthKind) {
  if(kind==='document') openImport(selected.value?.kind==='concern' ? selected.value.id : '')
  else openEditor(kind,'', selected.value?.kind==='concern' ? selected.value.id : '')
}
function runBodyPrimary() {
  const action=bodyCreateAction.value
  if(action.mode==='direct') startCreate(action.action)
}
function onAttentionChange(id:string,event:Event) {
  const value=(event.target as HTMLSelectElement).value
  attentionByConcern.value={...attentionByConcern.value,[id]:parseConcernAttention(value)}
}
function assignConcernPoint(id:string,view:BodyView,point:BodyPoint) {
  try {
    bodyBindings.value=setConcernPoint(bodyBindings.value,id,view,point)
    notice.value='已为关注事项标记位置（仅本次演示）。'
  } catch { notice.value='请点选人体轮廓内的位置。' }
}
function openEditor(kind: HealthKind,id='',presetConcernId='') {
  const record=id ? getList(kind).find(r=>r.id===id) : null
  if (id && !record) return
  const d=record ? structuredClone({...record}) : makeEmpty(kind,today)
  if(kind==='concern') d.attention=attentionByConcern.value[id]??'unset'
  if(kind==='metric'||kind==='observation'){
    d.referenceLow=d.referenceLow??''
    d.referenceHigh=d.referenceHigh??''
    d.referenceSource=d.referenceSource??''
  }
  if (kind==='observation' && record) d.value = record.valueNumber !== null ? String(record.valueNumber) : record.valueBoolean !== null ? String(record.valueBoolean) : record.valueText
  if (presetConcernId && !record && kind!=='metric') d.concernIds=[presetConcernId]
  if (kind==='observation' && !d.metricId) d.metricId=demo.metrics[0]?.id ?? ''
  editKind.value=kind;editId.value=id;draft.value=d;formError.value='';sheet.value='edit'
}
function formSave() {
  formError.value=''
  const v=draft.value, kind=editKind.value
  const mandatory: Record<HealthKind,string[]> = {
    concern:['name'],metric:['name'],observation:['metricId','observedDate'],event:['summary','date'],
    document:['title','fileName'],assessment:['title','content','assessedDate'],regimen:['name','instructions'],
  }
  for(const key of mandatory[kind]) {
    if(typeof v[key]!=='boolean' && !String(v[key]??'').trim()) {
      formError.value=key==='fileName'?'请先选择一份演示文件':'请填写必填内容'
      return
    }
  }
  if(kind==='concern') formError.value=validateConcern(v.onsetDate,v.resolvedDate)??''
  if(kind==='event') formError.value=validateEventTime(v.timeStart,v.timeEnd)??''
  if(kind==='regimen') formError.value=validateRegimen(v.startDate,v.endDate,v.recurrence,v.firstDueDate)??''
  if(kind==='observation') formError.value=validateObservation(demo.metrics.find(m=>m.id===v.metricId),String(v.value??''))??''
  if(kind==='metric' && demo.metrics.some(m=>m.name.trim()===String(v.name).trim() && m.id!==editId.value)) formError.value='已有同名指标，可直接使用现有指标'
  if(kind==='metric' && v.valueType==='number') formError.value=validateReferenceDraft(v.referenceLow,v.referenceHigh,v.referenceSource,'number')??formError.value
  if(kind==='observation' && demo.metrics.find(m=>m.id===v.metricId)?.valueType==='number') formError.value=validateReferenceDraft(v.referenceLow,v.referenceHigh,v.referenceSource,'number')??formError.value
  if(kind==='metric' && editId.value && demo.metrics.find(m=>m.id===editId.value)?.valueType!==v.valueType && demo.observations.some(o=>o.metricId===editId.value)) formError.value='已经有历史记录的指标不能改动记录方式'
  if(formError.value) return
  const payload:any={...v}
  // This is an ALOHA presentation preference, never a canonical HealthConcern field.
  if(kind==='concern') delete payload.attention
  if(kind==='metric'||kind==='observation'){
    const numeric=kind==='metric'?v.valueType==='number':demo.metrics.find(m=>m.id===v.metricId)?.valueType==='number'
    Object.assign(payload,numeric?parseReferenceDraft(v.referenceLow,v.referenceHigh,v.referenceSource):parseReferenceDraft('','',''))
  }
  if(kind==='observation') {
    const metric=demo.metrics.find(m=>m.id===v.metricId)!
    Object.assign(payload,buildObservationValue(metric,String(v.value)))
    payload.unit=metric.valueType==='number' ? (v.unit || metric.defaultUnit) : ''
    delete payload.value
  }
  // Every remaining relation is an explicit demo UI association; it never deletes source facts.
  if(!payload.concernIds && kind!=='metric') payload.concernIds=[]
  const rows=getList(kind)
  const savedId=editId.value || 'demo-'+(++nextRecordId)
  if(editId.value) {
    const index=rows.findIndex(r=>r.id===editId.value)
    if(index>=0) rows.splice(index,1,{...rows[index],...payload})
  } else rows.unshift({...payload,id:savedId})
  if(kind==='concern') attentionByConcern.value={...attentionByConcern.value,[savedId]:parseConcernAttention(String(v.attention??'unset'))}
  sheet.value=''
  formError.value=''
  notice.value='已保存。当前为演示数据，刷新页面后将恢复。'
  search.value=''
  // Save -> detail -> Back returns to the exact list, concern or metric that started the action.
  if(selected.value?.kind===kind && selected.value.id===savedId) return
  show(kind,savedId)
}
function removeCurrent() {
  if(!selected.value||!current.value) return
  if(!window.confirm('要从本次演示中删除这条记录吗？')) return
  const kind=selected.value.kind,id=selected.value.id
  if(kind==='metric' && demo.observations.some(o=>o.metricId===id)) {notice.value='该指标已有测量记录，请先保留指标与历史数据。';return}
  const rows=getList(kind)
  const i=rows.findIndex(r=>r.id===id)
  if(i>=0) rows.splice(i,1)
  // Remove orphaned UI-only relation indexes without cascading health facts.
  if(kind==='document') {
    demo.observations.forEach(o=>{if(o.sourceDocumentId===id)o.sourceDocumentId=''})
    demo.regimens.forEach(r=>{if(r.sourceDocumentId===id)r.sourceDocumentId=''})
    demo.assessments.forEach(a=>{a.basisIds=a.basisIds.filter(x=>x!==id)})
  }
  if(kind==='observation')demo.assessments.forEach(a=>{a.basisIds=a.basisIds.filter(x=>x!==id)})
  if(kind==='event')demo.documents.forEach(d=>{if(d.eventId===id)d.eventId=''})
  if(kind==='concern') {
    if(mapSelectedConcern.value===id) mapSelectedConcern.value=null
    const next={...attentionByConcern.value};delete next[id];attentionByConcern.value=next
    bodyBindings.value=bodyBindings.value.filter(binding=>binding.concernId!==id)
    for(const collection of ['observations','events','documents','assessments','regimens'] as const)
      for(const record of demo[collection]) record.concernIds=record.concernIds.filter(x=>x!==id)
  }
  notice.value='已从演示页面移除。'
  back()
}
function togglePlan(id: string) {
  completedPlanIds.value=completedPlanIds.value.includes(id) ? completedPlanIds.value.filter(x=>x!==id) : [...completedPlanIds.value,id]
}
function closeSheet() { sheet.value='';formError.value='' }
function pickFile(e: Event) {
  const file=(e.target as HTMLInputElement).files?.[0]
  // Never read file contents; filename is held only in component memory.
  if(sheet.value==='edit') draft.value.fileName=file?.name ?? ''
  else uploadedName.value=file?.name ?? ''
}
function openImport(concernId='') {
  sheet.value='import';uploadStage.value=1;uploadedName.value='';uploadTitle.value='';uploadType.value='lab_report';uploadConcernId.value=concernId;uploadIncludeResult.value=false
}
function importNext() {
  if(uploadStage.value===1) {
    if(!uploadedName.value){formError.value='请先选择一个示例文件';return}
    if(!uploadTitle.value.trim())uploadTitle.value=uploadedName.value.replace(/\.[^.]+$/,'')
    uploadStage.value=2;formError.value='';return
  }
  if(uploadStage.value===2) {uploadStage.value=3;return}
  const id='demo-'+(++nextRecordId)
  demo.documents.unshift({id,title:uploadTitle.value,documentType:uploadType.value,issuedDate:today,issuerName:'',eventId:'',fileName:uploadedName.value,notes:'此记录只保存了演示文件名，没有上传文件。',concernIds:uploadConcernId.value?[uploadConcernId.value]:[]})
  if(uploadIncludeResult.value) {
    demo.observations.unshift({
      id:'demo-'+(++nextRecordId),metricId:'m-2',observedDate:today,
      valueNumber:118,valueText:'',valueBoolean:null,unit:'mmHg',
      sourceDocumentId:id,notes:'虚构演示结果，未读取真实文件',
      concernIds:uploadConcernId.value?[uploadConcernId.value]:[],
    })
  }
  sheet.value='';notice.value='已整理资料。文件内容没有被读取或上传。';show('document',id)
}
async function sendAgent() {
  if (!agentSession.send(agentQuestion.value, contextName.value)) return
  agentQuestion.value = ''
  await nextTick()
  if (agentThread.value) agentThread.value.scrollTop = agentThread.value.scrollHeight
  agentInput.value?.focus()
}
async function openAgent() {
  agentSession.show()
  await nextTick()
  agentInput.value?.focus()
}
function closeAgent() { agentSession.hide() }
async function suggestAgent(question: string) {
  agentQuestion.value = question
  await sendAgent()
}
function handleEscape() {
  if (sheet.value) closeSheet()
  else if (agentOpen.value) closeAgent()
}
function handleAgentEnter(event: KeyboardEvent) {
  // Preserve Chinese IME candidate confirmation instead of sending mid-composition.
  if (event.isComposing || event.keyCode === 229) return
  event.preventDefault()
  void sendAgent()
}
function labelForKind(kind: HealthKind) {return kindLabel[kind]}
function detailName(kind: HealthKind,record:any) {
  if(kind==='observation')return observationTitle(record)
  return record.name || record.title || record.summary
}
</script>

<template>
  <div :class="['aloha-surface', 'health-shell', { 'agent-open': agentOpen, 'sidebar-collapsed': sidebarCollapsed, 'compact-density': uiDensity==='compact' }]" data-aloha-surface="health" @keydown.esc="handleEscape">
    <aside class="desktop-sidebar" aria-label="主导航">
      <AlohaHub :apps="alohaApps" current-app="health" :compact="sidebarCollapsed" :density="uiDensity"
        preview @open-setting="openHubSetting"/>
      <nav class="sidebar-nav" aria-label="Health 页面导航">
        <button v-for="item in navItems.filter(item=>item.id!=='more')" :key="item.id" :class="['nav-link',{selected:activeTab===item.id}]"
          type="button" :title="sidebarCollapsed ? item.title : undefined"
          :aria-label="item.title" @click="navigate(item.id)">
          <component :is="item.icon" :size="20" :stroke-width="1.9"/>
          <span v-if="!sidebarCollapsed">{{ item.title }}</span>
        </button>
      </nav>
      <div class="sidebar-bottom">
        <div v-if="!sidebarCollapsed" class="sidebar-note"><Info :size="16"/><span>体验版本<br>所有数据均为虚构示例</span></div>
        <button type="button" class="sidebar-collapse" :title="sidebarCollapsed ? '展开导航' : '收起导航'"
          :aria-label="sidebarCollapsed ? '展开导航' : '收起导航'" :aria-expanded="!sidebarCollapsed"
          @click="sidebarCollapsed=!sidebarCollapsed">
          <PanelLeftOpen v-if="sidebarCollapsed" :size="20"/>
          <PanelLeftClose v-else :size="20"/>
          <span v-if="!sidebarCollapsed">收起导航</span>
        </button>
      </div>
    </aside>
    <div class="page-frame">
      <main class="content">
        <section v-if="activeTab==='home'" class="home-view">
          <HealthPageHeader title="健康概览" subtitle="持续关注与最近变化"
            :agent-open="agentOpen"
            
            @ask="openAgent">
            <template #actions>
              <HealthCreateMenu label="快速记录" :choices="recordChoices" @select="startCreate($event)"/>
            </template>
          </HealthPageHeader>
          <div class="dashboard-layout">
            <section class="hero-card">
              <div class="hero-head"><span>健康概览</span><span>持续关注的内容</span></div>
              <div class="hero-main"><div><h2>{{ activeConcerns.length }} 项正在关注</h2><p>记录已经开始。这里会随着健康资料和日常记录逐步丰富。</p></div><HeartPulse class="hero-watermark" :size="92" :stroke-width="1"/></div>
              <div class="hero-stats"><button type="button" @click="openBody('focus')"><b>{{ activeConcerns.length }}</b><span>关注事项 <ChevronRight :size="15"/></span></button><button type="button" @click="openBody('documents')"><b>{{ docCount }}</b><span>资料 <ChevronRight :size="15"/></span></button><button type="button" @click="openBody('timeline')"><b>{{ demo.observations.length }}</b><span>测量记录 <ChevronRight :size="15"/></span></button></div>
            </section>
            <section class="ui-card focus-panel">
              <div class="card-heading"><div><span class="eyebrow">持续关注</span><h2>正在关注的健康问题</h2></div><button class="inline-link" type="button" @click="openBody('focus')">查看全部 <ArrowUpRight :size="15"/></button></div>
              <button v-for="c in activeConcerns.slice(0,3)" :key="c.id" type="button" class="row-link" @click="show('concern',c.id)">
                <span class="list-icon"><Heart :size="19"/></span><span class="row-main"><b>{{ c.name }}</b><small>{{ c.summary || '点击查看关联的健康记录' }}</small></span><ChevronRight :size="18" class="subtle-icon"/>
              </button>
            </section>
            <section class="ui-card metrics-panel">
              <div class="card-heading"><div><span class="eyebrow">关键指标</span><h2>留意长期变化</h2></div><button class="inline-link" type="button" @click="openBody('metrics')">查看指标 <ArrowUpRight :size="15"/></button></div>
              <div class="metric-grid"><button v-for="metric in demo.metrics.filter(m=>m.valueType==='number').slice(0,2)" :key="metric.id" type="button" class="metric-card" @click="show('metric',metric.id)">
                <span>{{ metric.name }}</span><strong>{{ latestFor(metric.id)?.valueNumber ?? '—' }} <small>{{ metric.defaultUnit }}</small></strong>
                <svg class="sparkline" viewBox="0 0 340 100" preserveAspectRatio="none" aria-hidden="true"><polyline :points="chartPoints(metric.id) || '10,75 120,62 220,68 330,45'"/></svg>
                <small>最近记录：{{ displayDate(latestFor(metric.id)?.observedDate??'') }}</small>
              </button></div>
            </section>
            <section class="ui-card tasks-panel">
              <div class="card-heading"><div><span class="eyebrow">今天可以做什么</span><h2>正在执行的健康计划</h2></div><button class="inline-link" type="button" @click="openBody('regimens')">全部计划 <ArrowUpRight :size="15"/></button></div>
              <template v-if="demo.regimens.some(r=>r.status==='active')">
                <button v-for="r in demo.regimens.filter(r=>r.status==='active').slice(0,3)" :key="r.id" class="task-line" type="button" @click="togglePlan(r.id)">
                  <span :class="['check-circle',{done:completedPlanIds.includes(r.id)}]"><Check v-if="completedPlanIds.includes(r.id)" :size="15"/></span>
                  <span class="row-main"><b :class="{struck:completedPlanIds.includes(r.id)}">{{ r.name }}</b><small>{{ r.recurrence==='daily'?'每日安排':r.recurrence==='weekly'?'每周安排':'自主安排' }} · 点击体验完成状态</small></span>
                </button>
              </template><p v-else class="empty-inline">目前没有正在执行的计划。</p>
            </section>
            <section class="ui-card history-panel">
              <div class="card-heading"><div><span class="eyebrow">最近记录</span><h2>健康时间线</h2></div><button class="inline-link" type="button" @click="openBody('timeline')">查看全部 <ArrowUpRight :size="15"/></button></div>
              <button v-for="e in timeline.slice(0,3)" :key="e.kind+e.id" type="button" class="row-link" @click="show(e.kind,e.id)"><span class="list-icon"><component :is="kindIcon[e.kind]" :size="18"/></span><span class="row-main"><b>{{ e.title }}</b><small>{{ e.meta }} · {{ displayDate(e.date) }}</small></span><ChevronRight :size="18" class="subtle-icon"/></button>
            </section>
          </div>
        </section>

        <section v-else-if="activeTab==='body'" class="body-view">
          <template v-if="selected && current">
            <HealthPageHeader :title="detailName(selected.kind,current)" :context="labelForKind(selected.kind)"
              :subtitle="selected.kind==='concern' ? (current.summary || '持续关注的健康问题') : undefined"
              can-back :agent-open="agentOpen"
            
            @ask="openAgent" @back="back">
              <template #actions>
                <button type="button" class="quiet-button detail-edit-button" aria-label="修改记录" title="修改记录" @click="openEditor(selected.kind,current.id)">
                  <Pencil :size="16"/><span class="detail-edit-label">修改</span>
                </button>
                <button type="button" class="icon-button destructive" title="删除演示记录"
                  aria-label="删除演示记录" @click="removeCurrent"><Trash2 :size="18"/></button>
              </template>
            </HealthPageHeader>
            <div v-if="selected.kind==='concern'" class="detail-columns">
              <section class="ui-card detail-primary">
                <div class="card-heading"><h2>现在怎么样？</h2><span class="status-chip">{{ current.status==='active'?'持续关注':'已结束' }}</span></div>
                <p class="body-copy">{{ current.summary || '你可以添加相关指标，逐步建立健康记录。' }}</p>
                <div class="detail-stat"><b>{{ concernRelated.observations.length }}</b><span>条相关观测</span><span class="stat-separator"></span><b>{{ concernRelated.documents.length }}</b><span>份相关资料</span></div>
                <dl class="detail-fields">
                  <div class="concern-attention-row"><dt>关注度</dt><dd class="concern-attention-value">
                    <span class="concern-attention-dot" :style="{'--body-dot-color':attentionColor(attentionByConcern[current.id]??'unset')}" aria-hidden="true"/>
                    <select :value="attentionByConcern[current.id]??'unset'" class="concern-attention-select"
                      :aria-label="'设置'+current.name+'的关注度'" @change="onAttentionChange(current.id,$event)">
                      <option v-for="option in concernAttentionOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                    </select>
                  </dd></div>
                  <div><dt>开始关注</dt><dd>{{ displayDate(current.onsetDate) }}</dd></div><div v-if="current.resolvedDate"><dt>结束日期</dt><dd>{{ displayDate(current.resolvedDate) }}</dd></div><div v-if="current.notes"><dt>备注</dt><dd>{{ current.notes }}</dd></div></dl>
                <div class="mini-label">相关指标</div>
                <button v-for="o in concernRelated.observations.slice().sort((a,b)=>b.observedDate.localeCompare(a.observedDate)).slice(0,3)" :key="o.id" class="row-link" type="button" @click="show('observation',o.id)">
                  <span class="list-icon"><Activity :size="18"/></span>
                  <span class="row-main">
                    <span class="concern-observation-title">
                      <b>{{ nameOfMetric(o.metricId) }} ·</b>
                      <span class="metric-reading-inline">
                        <b>{{ observationValue(o,demo.metrics.find(m=>m.id===o.metricId)) }}</b>
                        <ReferenceIndicator :comparison="referenceFor(o,demo.metrics.find(m=>m.id===o.metricId))?.comparison"/>
                      </span>
                    </span>
                    <small>{{ displayDate(o.observedDate) }}</small>
                  </span>
                  <ChevronRight :size="16"/>
                </button>
                <p v-if="concernRelated.observations.length===0" class="empty-inline">还没有关联的测量记录。</p>
                <button class="soft-button" type="button" @click="openEditor('observation','',current.id)"><Plus :size="16"/> 添加测量</button>
              </section>
              <section class="ui-card"><div class="card-heading"><h2>正在做什么？</h2></div>
                <button v-for="r in concernRelated.regimens" :key="r.id" class="row-link" type="button" @click="show('regimen',r.id)"><span class="list-icon"><ListChecks :size="18"/></span><span class="row-main"><b>{{ r.name }}</b><small>{{ labelFrom(regimenStatuses,r.status) }}</small></span><ChevronRight :size="17"/></button>
                <p v-if="!concernRelated.regimens.length" class="empty-inline">还没有关联的健康方案。</p>
                <button class="soft-button" type="button" @click="openEditor('regimen','',current.id)"><Plus :size="16"/> 添加方案</button>
              </section>
              <section class="ui-card"><div class="card-heading"><h2>最近发生了什么？</h2></div>
                <button v-for="e in concernRelated.events" :key="e.id" class="row-link" type="button" @click="show('event',e.id)"><span class="list-icon"><CalendarDays :size="18"/></span><span class="row-main"><b>{{ e.summary }}</b><small>{{ displayDate(e.date) }}</small></span><ChevronRight :size="17"/></button>
                <p v-if="!concernRelated.events.length" class="empty-inline">还没有关联的健康事件。</p>
                <button class="soft-button" type="button" @click="openEditor('event','',current.id)"><Plus :size="16"/> 记录事件</button>
              </section>
              <section class="ui-card"><div class="card-heading"><h2>有哪些依据？</h2></div>
                <button v-for="d in concernRelated.documents" :key="d.id" class="row-link" type="button" @click="show('document',d.id)"><span class="list-icon"><FileText :size="18"/></span><span class="row-main"><b>{{ d.title }}</b><small>{{ docName(d) }}</small></span><ChevronRight :size="17"/></button>
                <button v-for="a in concernRelated.assessments" :key="a.id" class="row-link" type="button" @click="show('assessment',a.id)"><span class="list-icon"><BadgeCheck :size="18"/></span><span class="row-main"><b>{{ a.title }}</b><small>评估 · {{ displayDate(a.assessedDate) }}</small></span><ChevronRight :size="17"/></button>
                <p v-if="!concernRelated.assessments.length&&!concernRelated.documents.length" class="empty-inline">还没有报告或评估记录。</p>
                <div class="action-row"><button class="soft-button" type="button" @click="openImport(current.id)"><Plus :size="16"/> 添加资料</button><button class="soft-button" type="button" @click="openEditor('assessment','',current.id)"><Plus :size="16"/> 新建评估</button></div>
              </section>
            </div>

            <div v-else-if="selected.kind==='metric'" class="detail-columns metric-detail-layout">
              <section class="ui-card detail-primary">
                <div class="metric-summary">
                  <div class="metric-hero">
                    <span class="metric-value-row"><strong>{{ latestFor(current.id) ? observationValue(latestFor(current.id)!,current) : '暂无记录' }}</strong>
                      <ReferenceIndicator v-if="latestFor(current.id)" :comparison="referenceFor(latestFor(current.id)!,current)?.comparison"/>
                    </span>
                    <span>{{ latestFor(current.id) ? '最新记录 · '+displayDate(latestFor(current.id)!.observedDate) : '还没有观测记录' }}</span>
                  </div>
                  <button class="primary-button metric-add-button" type="button" @click="openEditor('observation');draft.metricId=current.id;draft.unit=current.defaultUnit"><Plus :size="17"/> 记录一次</button>
                </div>
                <div class="card-heading metric-chart-heading"><h2>变化趋势</h2></div>
                <p v-if="current.valueType==='number' && (current.referenceLow!=null || current.referenceHigh!=null)" class="reference-range-note">
                  参考范围：{{ metricRangeLabel(current) }} · {{ current.referenceSource||'来源未注明' }}
                  <span>仅用于比较，不代表医学诊断。</span>
                </p>
                <MetricTrend v-if="current.valueType==='number'"
                  :metric-name="current.name" :unit="current.defaultUnit"
                  :reference-low="current.referenceLow" :reference-high="current.referenceHigh"
                  :reference-source="current.referenceSource"
                  :observations="demo.observations.filter(o=>o.metricId===current.id && (o.unit||current.defaultUnit)===current.defaultUnit)"
                  @open-observation="show('observation',$event)"/>
                <p v-else class="helper-copy">该指标记录的是{{ current.valueType==='text'?'文字':'是或否' }}，可在右侧查看历史记录，不适合用数值趋势图展示。</p>
              </section>
              <section class="ui-card metric-history"><div class="card-heading"><h2>历史记录</h2><span class="quiet-caption">{{ demo.observations.filter(o=>o.metricId===current.id).length }} 条</span></div>
                <button v-for="o in demo.observations.filter(o=>o.metricId===current.id).sort((a,b)=>b.observedDate.localeCompare(a.observedDate))" :key="o.id" type="button" class="row-link" @click="show('observation',o.id)"><span class="row-main"><span class="metric-reading-inline"><b>{{ observationValue(o,current) }}</b><ReferenceIndicator :comparison="referenceFor(o,current)?.comparison"/></span><small>{{ displayDate(o.observedDate) }}</small></span><ChevronRight :size="16"/></button>
                <p v-if="!demo.observations.some(o=>o.metricId===current.id)" class="empty-inline">暂时没有历史记录。</p>
              </section>
            </div>
            <div v-else class="detail-columns">
              <section class="ui-card detail-primary">
                <div class="card-heading"><h2>记录详情</h2><span v-if="selected.kind==='assessment'" class="status-chip">{{ labelFrom(assessmentStatuses,current.status) }}</span><span v-else-if="selected.kind==='regimen'" class="status-chip">{{ labelFrom(regimenStatuses,current.status) }}</span></div>
                <template v-if="selected.kind==='observation'">
                  <div class="metric-hero"><span class="metric-value-row"><strong>{{ valuePreview }}</strong>
                      <ReferenceIndicator :comparison="referenceFor(current,demo.metrics.find(m=>m.id===current.metricId))?.comparison"/></span>
                    <span>{{ nameOfMetric(current.metricId) }}</span>
                  </div>
                  <dl class="detail-fields"><div><dt>记录日期</dt><dd>{{ displayDate(current.observedDate) }}</dd></div><div v-if="referenceFor(current,demo.metrics.find(m=>m.id===current.metricId))?.comparison"><dt>本次比较依据</dt><dd>{{ formatReferenceRange(referenceFor(current,demo.metrics.find(m=>m.id===current.metricId))!.comparison!.range,referenceFor(current,demo.metrics.find(m=>m.id===current.metricId))!.comparison!.unit) }} · {{ referenceFor(current,demo.metrics.find(m=>m.id===current.metricId))!.comparison!.sourceNote }}{{ referenceFor(current,demo.metrics.find(m=>m.id===current.metricId))!.comparison!.source==='observation'?'（本次报告）':'（指标默认）' }}</dd></div>
                    <div v-else-if="referenceFor(current,demo.metrics.find(m=>m.id===current.metricId))?.reason==='unit_mismatch'"><dt>范围比较</dt><dd>单位不同，暂不比较</dd></div><div v-if="current.notes"><dt>备注</dt><dd>{{ current.notes }}</dd></div></dl>
                </template>
                <template v-else-if="selected.kind==='event'"><p class="body-copy">{{ current.description || '没有补充说明' }}</p><dl class="detail-fields"><div><dt>事件类型</dt><dd>{{ eventName(current) }}</dd></div><div><dt>发生日期</dt><dd>{{ displayDate(current.date) }}</dd></div><div v-if="current.timeStart"><dt>发生时段</dt><dd>{{ current.timeStart }}—{{ current.timeEnd }}</dd></div><div><dt>地点</dt><dd>{{ current.location||'未填写' }}</dd></div></dl></template>
                <template v-else-if="selected.kind==='document'"><div class="document-preview"><FileHeart :size="40"/><span>{{ current.fileName }}</span><small>体验版仅保存文件名，不包含实际文件</small></div><dl class="detail-fields"><div><dt>资料类型</dt><dd>{{ docName(current) }}</dd></div><div><dt>资料日期</dt><dd>{{ displayDate(current.issuedDate) }}</dd></div><div><dt>出具机构</dt><dd>{{ current.issuerName||'未填写' }}</dd></div></dl></template>
                <template v-else-if="selected.kind==='assessment'"><p class="body-copy">{{ current.content }}</p><dl class="detail-fields"><div><dt>评估日期</dt><dd>{{ displayDate(current.assessedDate) }}</dd></div><div><dt>来源说明</dt><dd>{{ current.sourceNote||'未填写' }}</dd></div><div v-if="current.notes"><dt>备注</dt><dd>{{ current.notes }}</dd></div></dl></template>
                <template v-else-if="selected.kind==='regimen'"><p class="body-copy">{{ current.instructions }}</p><dl class="detail-fields"><div><dt>方案类型</dt><dd>{{ labelFrom(regimenTypes,current.regimenType) }}</dd></div><div><dt>安排</dt><dd>{{ current.recurrence==='daily'?'每日':current.recurrence==='weekly'?'每周':'不重复' }}</dd></div><div><dt>首次执行</dt><dd>{{ displayDate(current.firstDueDate) }}</dd></div><div><dt>开始日期</dt><dd>{{ displayDate(current.startDate) }}</dd></div><div><dt>结束日期</dt><dd>{{ displayDate(current.endDate) }}</dd></div><div v-if="current.notes"><dt>备注</dt><dd>{{ current.notes }}</dd></div></dl></template>
                <div class="relation-tags" v-if="current.concernIds?.length"><span class="mini-label">相关健康问题</span><button v-for="cid in current.concernIds" :key="cid" type="button" class="relation-pill" @click="show('concern',cid)"><Link2 :size="13"/>{{ nameOfConcern(cid) }}</button></div>
              </section>
              <section class="ui-card"><div class="card-heading"><h2>{{ selected.kind==='assessment'?'判断依据':selected.kind==='document'?'由这份资料整理':'关联资料' }}</h2></div>
                <template v-if="selected.kind==='document'">
                  <button v-for="o in demo.observations.filter(o=>o.sourceDocumentId===current.id)" :key="o.id"
                    class="row-link" type="button" @click="show('observation',o.id)">
                    <span class="list-icon"><ClipboardCheck :size="18"/></span>
                    <span class="row-main"><b>{{ observationTitle(o) }}</b><small>{{ displayDate(o.observedDate) }}</small></span>
                    <ChevronRight :size="17"/>
                  </button>
                  <button v-if="current.eventId" class="row-link" type="button" @click="show('event',current.eventId)">
                    <span class="list-icon"><CalendarDays :size="18"/></span>
                    <span class="row-main"><b>{{ demo.events.find(e=>e.id===current.eventId)?.summary || '相关事件' }}</b><small>相关健康事件</small></span>
                    <ChevronRight :size="17"/>
                  </button>
                  <p v-if="!demo.observations.some(o=>o.sourceDocumentId===current.id)&&!current.eventId" class="empty-inline">
                    暂无从这份资料整理出的记录。你可以保留原始资料，稍后再补充。
                  </p>
                </template>
                <template v-else-if="selected.kind==='assessment'"><button v-for="id in current.basisIds" :key="id" type="button" class="row-link" @click="show(id.startsWith('d-')||demo.documents.some(d=>d.id===id)?'document':'observation',id)"><span class="list-icon"><FileText :size="18"/></span><span class="row-main"><b>{{ demo.documents.find(d=>d.id===id)?.title||observationTitle(demo.observations.find(o=>o.id===id)!) }}</b><small>已关联的依据</small></span><ChevronRight :size="17"/></button><p v-if="!current.basisIds.length" class="empty-inline">还没有关联依据，可以通过“修改”补充。</p></template>
                <template v-else-if="selected.kind==='observation'&&current.sourceDocumentId"><button class="row-link" type="button" @click="show('document',current.sourceDocumentId)"><span class="list-icon"><FileText :size="18"/></span><span class="row-main"><b>{{ nameOfDocument(current.sourceDocumentId) }}</b><small>原始资料</small></span><ChevronRight :size="17"/></button></template>
                <template v-else-if="selected.kind==='regimen'&&current.sourceDocumentId"><button class="row-link" type="button" @click="show('document',current.sourceDocumentId)"><span class="list-icon"><FileText :size="18"/></span><span class="row-main"><b>{{ nameOfDocument(current.sourceDocumentId) }}</b><small>方案来源</small></span><ChevronRight :size="17"/></button></template>
                <p v-else-if="selected.kind!=='assessment'&&selected.kind!=='document'" class="empty-inline">这里会显示与当前记录有关的资料和记录。</p>
              </section>
            </div>
          </template>

          <template v-else>
            <HealthPageHeader title="身体健康" subtitle="健康问题、指标、事件与资料"
              :agent-open="agentOpen"
              
              @ask="openAgent">
              <template #actions>
                <HealthCreateMenu v-if="bodyCreateAction.mode==='menu'"
                  :label="bodyCreateAction.label" :choices="bodyCreateAction.choices"
                  @select="startCreate($event)"/>
                <button v-else class="primary-button" type="button" @click="runBodyPrimary">
                  <Plus :size="17"/>{{ bodyCreateAction.label }}
                </button>
              </template>
            </HealthPageHeader>
            <nav class="sub-navigation" aria-label="身体页面导航">
              <button v-for="item in bodyTabs" :key="item.id" :class="{active:bodyTab===item.id}" type="button" @click="changeBodyTab(item.id)">{{ item.title }}</button>
            </nav>
            <div v-if="bodyTab==='focus'" class="body-overview">
              <BodyOverview
                :concerns="demo.concerns"
                :bindings="bodyBindings"
                :attention-by-concern="attentionByConcern"
                :view="mapView"
                :selected-concern-id="mapSelectedConcern"
                @update:view="mapView=$event"
                @update:selected-concern-id="mapSelectedConcern=$event"
                @open-concern="show('concern',$event)"
                @place-point="assignConcernPoint"
              />
            </div>
            <template v-else>
              <div class="list-toolbar">
                <label class="search-field"><Search :size="17"/><input v-model="search"
                  aria-label="搜索当前内容" placeholder="搜索当前内容"/></label>
              </div>
              <div class="list-panel">
                <template v-if="bodyTab==='metrics'">
                  <div class="metric-reference-filters" role="group" aria-label="按参考范围筛选健康指标">
                    <button v-for="option in metricReferenceChoices" :key="option.value" type="button"
                      :class="{active:metricReferenceFilter===option.value}"
                      :aria-pressed="metricReferenceFilter===option.value"
                      @click="metricReferenceFilter=option.value">
                      {{ option.label }} <small>{{ metricReferenceCounts[option.value] }}</small>
                    </button>
                  </div><button v-for="m in filteredMetrics" :key="m.id" class="list-row" type="button" @click="show('metric',m.id)"><span class="list-icon"><Activity :size="19"/></span><span class="row-main"><b>{{ m.name }}</b><small>{{ labelFrom(valueTypes,m.valueType) }} {{ m.defaultUnit?' · '+m.defaultUnit:'' }}</small></span><span class="metric-list-result"><strong class="list-value">{{ latestFor(m.id)?observationValue(latestFor(m.id)!,m):'—' }}</strong>
                    <ReferenceIndicator v-if="latestFor(m.id)"
                      :comparison="referenceFor(latestFor(m.id)!,m)?.comparison"/>
                  </span><ChevronRight :size="18"/></button>
                  <p v-if="!filteredMetrics.length" class="empty-inline metric-reference-empty">
                    {{ search.trim()?'没有找到符合条件的指标。':metricReferenceFilter==='all'?'还没有指标，添加后可以查看测量变化。':'目前没有这类指标，可以切换其他筛选。' }}
                  </p>
                </template>
                <template v-if="bodyTab==='timeline'">
                  <HealthTimeline :entries="filteredTimeline" :selected-kind="timelineKind" :search-active="Boolean(search.trim())"
                    @update:selected-kind="timelineKind=$event" @open="show"/>
                </template>
                <template v-if="bodyTab==='documents'"><button v-for="d in filteredDocuments" :key="d.id" class="list-row" type="button" @click="show('document',d.id)"><span class="list-icon"><FileText :size="19"/></span><span class="row-main"><b>{{ d.title }}</b><small>{{ docName(d) }} · {{ displayDate(d.issuedDate) }}</small></span><ChevronRight :size="18"/></button></template>
                <template v-if="bodyTab==='regimens'"><button v-for="r in filteredRegimens" :key="r.id" class="list-row" type="button" @click="show('regimen',r.id)"><span class="list-icon"><ListChecks :size="19"/></span><span class="row-main"><b>{{ r.name }}</b><small>{{ labelFrom(regimenTypes,r.regimenType) }} · {{ r.recurrence==='daily'?'每日':r.recurrence==='weekly'?'每周':'不重复' }}</small></span><span class="status-chip">{{ labelFrom(regimenStatuses,r.status) }}</span><ChevronRight :size="18"/></button></template>
                <div v-if="(bodyTab==='metrics'&&!filteredMetrics.length)||(bodyTab==='documents'&&!filteredDocuments.length)||(bodyTab==='regimens'&&!filteredRegimens.length)" class="empty-state"><Search :size="26"/><b>没有找到相关内容</b><span>试试其他关键词，或添加一条新记录。</span></div>
              </div>
              <p v-if="bodyTab==='documents'" class="below-hint"><ShieldCheck :size="16"/> 上传演示只模拟整理过程，不会读取或发送文件内容。</p>
            </template>
          </template>
        </section>

        <section v-else-if="activeTab==='food'||activeTab==='movement'" class="future-page">
          <HealthPageHeader :title="activeTab==='food'?'饮食管理':'运动管理'"
              subtitle="逐步连接日常习惯与身体变化"
              :agent-open="agentOpen"
            
            @ask="openAgent"/>
          <div class="future-card"><component :is="activeTab==='food'?Utensils:Activity" :size="36"/><h2>先把重要的健康记录整理好</h2><p>饮食和运动会继续沿用这套操作方式，提供各自更适合的记录和分析页面。</p><button class="quiet-button" type="button" @click="openBody('focus')">看看身体管理 <ArrowRight :size="16"/></button></div></section>
        <section v-else class="more-view">
          <HealthPageHeader :title="hubTitles[hubSection]" :subtitle="hubSection==='apps'?'应用、账号与设置':'ALOHA 公共设置 · 体验版'"
            :agent-open="agentOpen" @ask="openAgent"/>
          <AlohaHub page :apps="alohaApps" current-app="health" preview
            :initial-section="hubSection" :density="uiDensity" @select-app="handleAppSelection"
            @update:section="hubSection=$event" @update:density="uiDensity=$event"/>
        </section>
      </main>
    </div>

    <!-- Persistent side workspace: no backdrop, no modal focus trap, no nav reset. -->
    <aside v-if="agentOpen" id="health-agent-panel" class="agent-dock" aria-label="Health 助手对话">
      <header class="agent-dock-header">
        <div class="agent-dock-title"><span class="agent-dock-logo"><Sparkles :size="21"/></span><div><span class="agent-dock-eyebrow">ALOHA Health</span><h2>问问 Health</h2></div></div>
        <button class="icon-button" type="button" aria-label="收起对话" title="收起对话" @click="closeAgent"><X :size="20"/></button>
      </header>
      <div class="agent-dock-context"><span>当前页面：{{ contextName }}</span><span>切换页面后对话保留</span></div>
      <div ref="agentThread" class="agent-thread" role="log" aria-label="聊天记录" aria-live="polite" aria-relevant="additions">
        <div v-if="agentMessages.length===0" class="agent-start">
          <div class="agent-start-icon"><Sparkles :size="26"/></div>
          <h3>一边查看，一边提问</h3>
          <p>你可以继续浏览左侧健康记录。这里的对话不会因切换页面而中断。</p>
          <button class="agent-suggestion" type="button" @click="suggestAgent('最近有哪些变化？')">最近有哪些变化？ <ArrowUpRight :size="16"/></button>
          <button class="agent-suggestion" type="button" @click="suggestAgent('帮我整理一下资料')">帮我整理一下资料 <ArrowUpRight :size="16"/></button>
        </div>
        <div v-for="message in agentMessages" :key="message.id" :class="['agent-message', message.role==='user'?'agent-message-user':'agent-message-assistant']">
          <div v-if="message.role==='assistant'" class="agent-message-icon"><Sparkles :size="16"/></div>
          <div class="agent-message-content"><p>{{ message.text }}</p><small v-if="message.role==='user'">提问时查看：{{ message.context }}</small></div>
        </div>
      </div>
      <footer class="agent-dock-footer">
        <form class="agent-dock-composer" @submit.prevent="sendAgent">
          <label class="sr-only" for="health-agent-question">向 Health 提问</label>
          <textarea id="health-agent-question" ref="agentInput" v-model="agentQuestion" rows="2" placeholder="想了解什么？" @keydown.enter.exact="handleAgentEnter"/>
          <button class="primary-button agent-send" type="submit" :disabled="!agentQuestion.trim()">发送 <ArrowRight :size="17"/></button>
        </form>
        <p class="agent-dock-disclaimer"><ShieldCheck :size="14"/> 当前为演示对话，未接入真实 AI 或健康档案。</p>
      </footer>
    </aside>

    <nav class="bottom-nav" aria-label="主导航">
      <button v-for="item in navItems" :key="item.id" :class="{active:activeTab===item.id}" type="button" @click="navigate(item.id)">
        <component :is="item.icon" :size="22" :stroke-width="1.8"/><span>{{ item.title }}</span>
      </button>

    </nav>

    <div v-if="sheet" class="modal-backdrop" @click.self="closeSheet">
      <section class="drawer" role="dialog" aria-modal="true" :aria-label="sheet==='edit'?'编辑健康记录':'整理报告'">
        <div class="drawer-handle"></div>
        <header class="drawer-heading"><div><span class="eyebrow">{{ sheet==='edit'?'健康记录':'整理一份健康资料' }}</span><h2>{{ sheet==='edit'?(editId?'修改':'添加')+kindLabel[editKind]:'整理健康报告' }}</h2></div><button class="icon-button" aria-label="关闭" type="button" @click="closeSheet"><X :size="20"/></button></header>

        <form v-if="sheet==='edit'" class="editor-form" @submit.prevent="formSave">
          <p class="form-intro">填写你知道的内容即可，之后还可以修改。</p>
          <template v-if="editKind==='concern'">
            <label><span class="field-label">关注事项名称 <span class="required-mark" aria-hidden="true">*</span></span><input v-model="draft.name" maxlength="160" required placeholder="例如：睡眠调整"/></label>
            <label>情况说明<textarea v-model="draft.summary" rows="3" placeholder="为什么想持续关注这件事？"/></label>
            <label>当前状态<select v-model="draft.status"><option value="active">持续关注</option><option value="inactive">已结束</option></select></label>
            <label>关注度<select v-model="draft.attention">
              <option v-for="option in concernAttentionOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select></label>
            <p class="helper-copy">关注度由你设置，只用于整理先后顺序，不代表医学严重程度。</p>
            <div class="form-two"><label>开始日期<input v-model="draft.onsetDate" type="date"/></label><label>结束日期<input v-model="draft.resolvedDate" type="date"/></label></div>
            <label>备注<textarea v-model="draft.notes" rows="2"/></label>
          </template>
          <template v-else-if="editKind==='metric'">
            <label><span class="field-label">指标名称 <span class="required-mark" aria-hidden="true">*</span></span><input v-model="draft.name" maxlength="160" required placeholder="例如：静息心率"/></label>
            <label>记录方式 <select v-model="draft.valueType"><option v-for="[value,name] in valueTypes" :key="value" :value="value">{{ name }}</option></select></label>
            <label v-if="draft.valueType==='number'">单位<input v-model="draft.defaultUnit" placeholder="例如：次/分"/></label>
            <fieldset v-if="draft.valueType==='number'" class="health-reference-fieldset">
              <legend>参考范围（可选）</legend>
              <p class="helper-copy">有明确依据时才填写。范围内不代表医学上一定正常，个人目标请在目标中管理。</p>
              <div class="form-two">
                <label>参考下限<input v-model="draft.referenceLow" type="number" step="any" placeholder="不设下限"/></label>
                <label>参考上限<input v-model="draft.referenceHigh" type="number" step="any" placeholder="不设上限"/></label>
              </div>
              <label>参考范围来源<input v-model="draft.referenceSource" placeholder="例如：报告提供的参考范围"/></label>
            </fieldset>
            <p class="helper-copy">同一种指标只需建一次，之后可以持续记录。</p>
          </template>
          <template v-else-if="editKind==='observation'">
            <label><span class="field-label">记录哪一项 <span class="required-mark" aria-hidden="true">*</span></span><select v-model="draft.metricId"><option v-for="m in demo.metrics" :key="m.id" :value="m.id">{{ m.name }}</option></select></label>
            <template v-if="demo.metrics.find(m=>m.id===draft.metricId)?.valueType==='boolean'"><label><span class="field-label">本次结果 <span class="required-mark" aria-hidden="true">*</span></span><select v-model="draft.value"><option value="">请选择</option><option value="true">是</option><option value="false">否</option></select></label></template>
            <template v-else><label><span class="field-label">记录结果 <span class="required-mark" aria-hidden="true">*</span></span><input v-model="draft.value" :type="demo.metrics.find(m=>m.id===draft.metricId)?.valueType==='number'?'number':'text'" :step="demo.metrics.find(m=>m.id===draft.metricId)?.valueType==='number'?'any':undefined" required placeholder="填写此次记录"/></label></template>
            <label v-if="demo.metrics.find(m=>m.id===draft.metricId)?.valueType==='number'">单位<input v-model="draft.unit" :placeholder="demo.metrics.find(m=>m.id===draft.metricId)?.defaultUnit||'选填'"/></label>
            <fieldset v-if="demo.metrics.find(m=>m.id===draft.metricId)?.valueType==='number'" class="health-reference-fieldset">
              <legend>本次报告的参考范围（可选）</legend>
              <p class="helper-copy">报告写明的上下限可以填在这里；不填则按该指标的默认范围比较。只填写一侧也可以。</p>
              <div class="form-two">
                <label>本次下限<input v-model="draft.referenceLow" type="number" step="any" placeholder="沿用默认范围"/></label>
                <label>本次上限<input v-model="draft.referenceHigh" type="number" step="any" placeholder="沿用默认范围"/></label>
              </div>
              <label>范围来源<input v-model="draft.referenceSource" placeholder="例如：本次化验报告"/></label>
            </fieldset>
            <label><span class="field-label">测量日期 <span class="required-mark" aria-hidden="true">*</span></span><input v-model="draft.observedDate" type="date" required/></label>
            <label>参考资料<select v-model="draft.sourceDocumentId"><option value="">没有或稍后补充</option><option v-for="d in demo.documents" :key="d.id" :value="d.id">{{ d.title }}</option></select></label>
            <label>备注<textarea v-model="draft.notes" rows="2"/></label>
          </template>
          <template v-else-if="editKind==='event'">
            <label><span class="field-label">发生了什么 <span class="required-mark" aria-hidden="true">*</span></span><input v-model="draft.summary" maxlength="200" required placeholder="例如：一次门诊咨询"/></label>
            <label>事件类型<select v-model="draft.eventType"><option v-for="[value,name] in eventTypes" :key="value" :value="value">{{ name }}</option></select></label>
            <label><span class="field-label">发生日期 <span class="required-mark" aria-hidden="true">*</span></span><input v-model="draft.date" type="date" required/></label>
            <div class="form-two"><label>开始时间（选填）<input v-model="draft.timeStart" type="time"/></label><label>结束时间（选填）<input v-model="draft.timeEnd" type="time"/></label></div>
            <p class="helper-copy">只记日期也可以；填写时间时，需要同时填写开始和结束时间。</p>
            <label>地点<input v-model="draft.location" placeholder="例如：社区医院"/></label>
            <label>事情经过<textarea v-model="draft.description" rows="3"/></label>
            <label>状态<select v-model="draft.status"><option value="active">已记录</option><option value="cancelled">已取消</option></select></label>
          </template>
          <template v-else-if="editKind==='document'">
            <label><span class="field-label">资料名称 <span class="required-mark" aria-hidden="true">*</span></span><input v-model="draft.title" required placeholder="例如：年度检查报告"/></label>
            <label>资料类型<select v-model="draft.documentType"><option v-for="[value,name] in documentTypes" :key="value" :value="value">{{ name }}</option></select></label>
            <label><span class="field-label">选择文件 <span class="required-mark" aria-hidden="true">*</span></span><input type="file" accept=".pdf,.png,.jpg,.jpeg" @change="pickFile"/><small>只保留文件名，不读取内容。</small></label>
            <p v-if="draft.fileName" class="file-picked"><FileText :size="16"/>{{ draft.fileName }}</p>
            <div class="form-two"><label>资料日期<input v-model="draft.issuedDate" type="date"/></label><label>出具机构<input v-model="draft.issuerName" placeholder="选填"/></label></div>
            <label>相关健康事件<select v-model="draft.eventId"><option value="">不关联</option><option v-for="e in demo.events" :key="e.id" :value="e.id">{{ e.summary }}</option></select></label>
            <label>备注<textarea v-model="draft.notes" rows="2"/></label>
          </template>
          <template v-else-if="editKind==='assessment'">
            <label><span class="field-label">评估标题 <span class="required-mark" aria-hidden="true">*</span></span><input v-model="draft.title" required placeholder="例如：本次检查结果回顾"/></label>
            <label><span class="field-label">评估内容 <span class="required-mark" aria-hidden="true">*</span></span><textarea v-model="draft.content" rows="4" required placeholder="记录医生意见或经确认的总结，不要混作原始数据"/></label>
            <div class="form-two"><label><span class="field-label">评估日期 <span class="required-mark" aria-hidden="true">*</span></span><input v-model="draft.assessedDate" required type="date"/></label><label>状态<select v-model="draft.status"><option v-for="[value,name] in assessmentStatuses" :key="value" :value="value">{{ name }}</option></select></label></div>
            <fieldset class="check-group"><legend>依据哪些记录？</legend><label v-for="d in demo.documents" :key="d.id" class="checkbox-line"><input v-model="draft.basisIds" type="checkbox" :value="d.id"/>{{ d.title }}</label><label v-for="o in demo.observations.slice(0,5)" :key="o.id" class="checkbox-line"><input v-model="draft.basisIds" type="checkbox" :value="o.id"/>{{ observationTitle(o) }}</label></fieldset>
            <label>来源说明<input v-model="draft.sourceNote" placeholder="例如：医生意见、个人整理"/></label>
            <label>补充备注<textarea v-model="draft.notes" rows="2"/></label>
          </template>
          <template v-else-if="editKind==='regimen'">
            <label><span class="field-label">方案名称 <span class="required-mark" aria-hidden="true">*</span></span><input v-model="draft.name" required placeholder="例如：每周活动计划"/></label>
            <label>方案类型<select v-model="draft.regimenType"><option v-for="[value,name] in regimenTypes" :key="value" :value="value">{{ name }}</option></select></label>
            <label><span class="field-label">怎么执行 <span class="required-mark" aria-hidden="true">*</span></span><textarea v-model="draft.instructions" rows="3" required placeholder="记录具体可执行的安排"/></label>
            <label>状态<select v-model="draft.status"><option v-for="[value,name] in regimenStatuses" :key="value" :value="value">{{ name }}</option></select></label>
            <div class="form-two"><label>开始日期<input v-model="draft.startDate" type="date"/></label><label>结束日期<input v-model="draft.endDate" type="date"/></label></div>
            <label>需要重复提醒吗？<select v-model="draft.recurrence"><option value="none">不重复</option><option value="daily">每天</option><option value="weekly">每周</option></select></label>
            <label v-if="draft.recurrence!=='none'"><span class="field-label">首次执行日期 <span class="required-mark" aria-hidden="true">*</span></span><input v-model="draft.firstDueDate" required type="date"/></label>
            <label>参考资料<select v-model="draft.sourceDocumentId"><option value="">无</option><option v-for="d in demo.documents" :key="d.id" :value="d.id">{{ d.title }}</option></select></label>
            <label>方案来源<input v-model="draft.sourceNote" placeholder="例如：个人计划"/></label>
            <label>备注<textarea v-model="draft.notes" rows="2"/></label>
            <p class="helper-copy">真实版本会由平台生成待办，不会由页面自行定时。</p>
          </template>
          <fieldset v-if="editKind!=='metric'&&editKind!=='concern'" class="check-group"><legend>相关健康问题（可多选）</legend><label v-for="c in demo.concerns" :key="c.id" class="checkbox-line"><input v-model="draft.concernIds" type="checkbox" :value="c.id"/>{{ c.name }}</label><p v-if="!demo.concerns.length" class="helper-copy">可以先创建健康问题，后续再关联。</p></fieldset>
          <p v-if="formError" class="form-error" role="alert"><Info :size="16"/>{{ formError }}</p>
          <div class="form-actions"><button type="button" class="quiet-button" @click="closeSheet">取消</button><button type="submit" class="primary-button"><Check :size="17"/> 保存记录</button></div>
          <p class="privacy-note"><ShieldCheck :size="15"/> 仅当前页面有效。刷新后不会保留本次修改。</p>
        </form>

        <div v-else-if="sheet==='import'" class="import-flow">
          <div class="step-track"><span v-for="num in [1,2,3]" :key="num" :class="{active:uploadStage>=num}">{{ num }}</span></div>
          <template v-if="uploadStage===1">
            <div class="flow-copy"><h3>先把原始资料留下来</h3><p>选取一个示例文件并命名。演示不会打开、读取或上传文件内容。</p></div>
            <label class="upload-field"><Upload :size="27"/><b>选择 PDF 或图片</b><span>仅使用文件名演示下一步</span><input type="file" accept=".pdf,.png,.jpg,.jpeg" @change="pickFile"/></label>
            <p v-if="uploadedName" class="file-picked"><FileText :size="16"/>{{ uploadedName }}</p>
            <label class="plain-label">资料名称<input v-model="uploadTitle" placeholder="例如：一次检查报告"/></label>
            <label class="plain-label">资料类型<select v-model="uploadType"><option v-for="[value,name] in documentTypes" :key="value" :value="value">{{ name }}</option></select></label>
            <label class="plain-label">相关健康问题<select v-model="uploadConcernId"><option value="">暂不关联</option><option v-for="c in demo.concerns" :key="c.id" :value="c.id">{{ c.name }}</option></select></label>
          </template>
          <template v-else-if="uploadStage===2">
            <div class="flow-copy"><h3>查看可能整理出的内容</h3><p>以下是一条独立生成的<strong>虚构示例</strong>，与所选文件内容无关。正式版本将在识别后要求你核对。</p></div>
            <div class="extract-card"><div class="extract-head"><ClipboardCheck :size="19"/><b>示例：一次血压测量</b></div><strong>118 <small>mmHg</small></strong><p>测量日期：今天 · 请先核对这条虚构演示值</p><label class="checkbox-line"><input v-model="uploadIncludeResult" type="checkbox"/> 确认后添加这条演示结果</label></div>
            <p class="helper-copy">未勾选时，只创建一份资料记录；不会凭空添加身体测量。</p>
          </template>
          <template v-else>
            <div class="flow-copy"><h3>确认本次整理</h3><p>你可以回到上一步核对。确认后才将勾选的示例测量添加为正式观测；所有演示数据仅存在于当前页面。</p></div>
            <div class="summary-block"><p><CheckCircle2 :size="17"/> 资料：{{ uploadTitle }}</p><p><CheckCircle2 :size="17"/> 已选文件名：{{ uploadedName }}</p><p><CheckCircle2 :size="17"/> 示例测量：{{ uploadIncludeResult?'同时添加':'不添加' }}</p></div>
          </template>
          <p v-if="formError" class="form-error"><Info :size="16"/>{{ formError }}</p>
          <div class="form-actions"><button class="quiet-button" type="button" @click="uploadStage===1?closeSheet():uploadStage--">{{ uploadStage===1?'取消':'上一步' }}</button><button class="primary-button" type="button" @click="importNext">{{ uploadStage===3?'确认添加':'下一步' }} <ArrowRight :size="17"/></button></div>
        </div>

      </section>
    </div>
    <div v-if="notice" role="status" class="toast"><span>{{ notice }}</span><button type="button" aria-label="关闭提示" @click="notice=''"><X :size="17"/></button></div>
  </div>
</template>
