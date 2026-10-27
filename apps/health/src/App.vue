<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  Activity, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, CalendarDays, Check, CheckCircle2,
  ChevronDown, ChevronRight, CircleHelp, ClipboardCheck, ClipboardList, Clock3, FileHeart,
  FilePlus2, FileText, FolderHeart, Heart, HeartPulse, Home, Info, LayoutGrid, Link2,
  ListChecks, Menu, MoreHorizontal, Pencil, Plus, Search, ShieldCheck, Sparkles,
  Stethoscope, Trash2, TrendingDown, Upload, Utensils, X,
} from 'lucide-vue-next'
import {
  buildObservationValue, documentTypes, eventTypes, interpretationTypes, labelFrom, makeEmpty,
  observationStatuses, observationValue, regimenStatuses, regimenTypes, seedDemo,
  validateConcern, validateObservation, validateRegimen, valueTypes,
  type HealthKind, type Metric, type Observation, type Regimen,
} from './demo-model'

type Tab = 'home' | 'body' | 'food' | 'movement'
type BodyTab = 'overview' | 'concerns' | 'metrics' | 'timeline' | 'documents' | 'regimens'
type Sheet = '' | 'edit' | 'import' | 'agent' | 'switcher' | 'account'
type RecordView = { kind: HealthKind; id: string }
const navItems = [
  { id: 'home' as Tab, title: '首页', icon: Home },
  { id: 'body' as Tab, title: '身体', icon: HeartPulse },
  { id: 'food' as Tab, title: '饮食', icon: Utensils },
  { id: 'movement' as Tab, title: '运动', icon: Activity },
]
const bodyTabs = [
  { id: 'overview' as BodyTab, title: '概览' },
  { id: 'concerns' as BodyTab, title: '健康问题' },
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
const bodyTab = ref<BodyTab>('overview')
const selected = ref<RecordView | null>(null)
const sheet = ref<Sheet>('')
const editKind = ref<HealthKind>('concern')
const editId = ref('')
const draft = ref<Record<string,any>>({})
const formError = ref('')
const search = ref('')
const notice = ref('')
const agentQuestion = ref('')
const agentReply = ref('')
const uploadStage = ref<1|2|3>(1)
const uploadedName = ref('')
const uploadTitle = ref('')
const uploadType = ref('lab_report')
const uploadConcernId = ref('')
const uploadIncludeResult = ref(false)
const completedPlanIds = ref<string[]>([])
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
const latestFor = (metricId:string) => [...demo.observations].filter(o=>o.metricId===metricId && o.status !== 'entered_in_error').sort((a,b)=>b.observedDate.localeCompare(a.observedDate))[0]
const observationTitle = (o: Observation) => nameOfMetric(o.metricId) + ' · ' + observationValue(o,demo.metrics.find(m=>m.id===o.metricId))
const eventName = (e: {eventType:string}) => labelFrom(eventTypes,e.eventType)
const docName = (d: {documentType:string}) => labelFrom(documentTypes,d.documentType)
const assessmentCount = computed(() => demo.assessments.length)
const docCount = computed(() => demo.documents.length)
const timeline = computed(() => [
  ...demo.observations.map(o=>({ id:o.id,kind:'observation' as HealthKind,date:o.observedDate,title:observationTitle(o),meta:'测量记录' })),
  ...demo.events.map(e=>({ id:e.id,kind:'event' as HealthKind,date:e.date,title:e.summary,meta:eventName(e) })),
  ...demo.assessments.map(a=>({ id:a.id,kind:'assessment' as HealthKind,date:a.assessedDate,title:a.title,meta:'评估记录' })),
].sort((a,b)=>b.date.localeCompare(a.date)))
const filteredConcerns = computed(()=>demo.concerns.filter(c=>c.name.includes(search.value) || c.summary.includes(search.value)))
const filteredMetrics = computed(()=>demo.metrics.filter(m=>m.name.includes(search.value)))
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
  const points = demo.observations.filter(o=>o.metricId===metricId && o.valueNumber!==null && o.status!=='entered_in_error').sort((a,b)=>a.observedDate.localeCompare(b.observedDate))
  if(points.length < 2) return ''
  const values = points.map(p=>p.valueNumber!)
  const lo=Math.min(...values)-2, hi=Math.max(...values)+2
  return points.map((p,i)=>`${Math.round(10+320*i/(points.length-1))},${Math.round(82-60*(p.valueNumber!-lo)/(hi-lo))}`).join(' ')
}
function navigate(tab: Tab) {
  activeTab.value=tab; selected.value=null; sheet.value=''; bodyTab.value='overview'; search.value=''
  window.scrollTo({top:0,behavior:'smooth'})
}
function openBody(tab: BodyTab) { navigate('body');bodyTab.value=tab }
function show(kind: HealthKind,id: string) {
  activeTab.value='body'; selected.value={kind,id};sheet.value='';search.value=''
  window.scrollTo({top:0,behavior:'smooth'})
}
function back() { selected.value=null;window.scrollTo({top:0,behavior:'smooth'}) }
function openEditor(kind: HealthKind,id='',presetConcernId='') {
  const record=id ? getList(kind).find(r=>r.id===id) : null
  if (id && !record) return
  const d=record ? structuredClone({...record}) : makeEmpty(kind,today)
  if (kind==='observation' && record) d.value = record.valueNumber !== null ? String(record.valueNumber) : record.valueBoolean !== null ? String(record.valueBoolean) : record.valueText
  if (presetConcernId && !record && kind!=='metric') d.concernIds=[presetConcernId]
  if (kind==='observation' && !d.metricId) d.metricId=demo.metrics[0]?.id ?? ''
  editKind.value=kind;editId.value=id;draft.value=d;formError.value='';sheet.value='edit'
}
function formSave() {
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
  if(kind==='regimen') formError.value=validateRegimen(v.startDate,v.endDate,v.recurrence,v.firstDueDate)??''
  if(kind==='observation') formError.value=validateObservation(demo.metrics.find(m=>m.id===v.metricId),String(v.value??''))??''
  if(kind==='metric' && demo.metrics.some(m=>m.name.trim()===String(v.name).trim() && m.id!==editId.value)) formError.value='已有同名指标，可直接使用现有指标'
  if(formError.value) return
  const payload:any={...v}
  if(kind==='observation') {
    const metric=demo.metrics.find(m=>m.id===v.metricId)!
    Object.assign(payload,buildObservationValue(metric,String(v.value)))
    payload.unit=metric.valueType==='number' ? (v.unit || metric.defaultUnit) : ''
    delete payload.value
  }
  // Every remaining relation is an explicit demo UI association; it never deletes source facts.
  if(!payload.concernIds && kind!=='metric') payload.concernIds=[]
  const rows=getList(kind)
  if(editId.value) {
    const index=rows.findIndex(r=>r.id===editId.value)
    if(index>=0) rows.splice(index,1,{...rows[index],...payload})
  } else rows.unshift({...payload,id:'demo-'+(++nextRecordId)})
  sheet.value=''; notice.value='已保存到当前体验页面，刷新后会恢复初始内容。'
  search.value=''
  if(kind==='concern') openBody('concerns')
  else if(kind==='metric') openBody('metrics')
  else if(kind==='document') openBody('documents')
  else if(kind==='regimen') openBody('regimens')
  else openBody('timeline')
}
function removeCurrent() {
  if(!selected.value||!current.value) return
  if(!window.confirm('要从本次演示中删除这条记录吗？')) return
  const kind=selected.value.kind,id=selected.value.id
  const rows=getList(kind)
  const i=rows.findIndex(r=>r.id===id)
  if(i>=0) rows.splice(i,1)
  // Remove orphaned UI-only relation indexes without cascading health facts.
  if(kind==='concern') {
    for(const collection of ['observations','events','documents','assessments','regimens'] as const)
      for(const record of demo[collection]) record.concernIds=record.concernIds.filter(x=>x!==id)
  }
  selected.value=null;notice.value='已从演示页面移除。'
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
      interpretation:'',status:'preliminary',sourceDocumentId:id,
      sourceNote:'模拟提取结果，不来自真实文件',notes:'请核对后再保存真实数据',
      concernIds:uploadConcernId.value?[uploadConcernId.value]:[],
    })
  }
  sheet.value='';notice.value='资料流程演示完成。文件内容没有被读取或上传。';openBody('documents')
}
function sendAgent() {
  if(!agentQuestion.value.trim())return
  agentReply.value='这是交互演示。正式版会结合你授权的“'+contextName.value+'”相关资料，列出数据出处，并将建议和已记录的事实分开。这里没有调用 AI，也不会生成真实健康结论。'
}
function openAgent() {agentReply.value='';agentQuestion.value='';sheet.value='agent'}
function labelForKind(kind: HealthKind) {return kindLabel[kind]}
function detailName(kind: HealthKind,record:any) {
  if(kind==='observation')return observationTitle(record)
  return record.name || record.title || record.summary
}
</script>

<template>
  <div class="aloha-surface health-shell" data-aloha-surface="health" @keydown.esc="closeSheet">
    <aside class="desktop-sidebar" aria-label="主导航">
      <button type="button" class="sidebar-brand" @click="sheet='switcher'" aria-label="切换应用">
        <span class="brand-mark"><Heart :size="22" fill="currentColor"/></span>
        <span><b>ALOHA</b><small>HEALTH</small></span><ChevronDown :size="15"/>
      </button>
      <nav class="sidebar-nav">
        <button v-for="item in navItems" :key="item.id" :class="['nav-link',{selected:activeTab===item.id}]" type="button" @click="navigate(item.id)">
          <component :is="item.icon" :size="20" :stroke-width="1.9"/><span>{{ item.title }}</span>
        </button>
      </nav>
      <div class="sidebar-note"><Info :size="16"/><span>这是体验版本<br>所有数据均为虚构示例</span></div>
    </aside>
    <div class="page-frame">
      <header class="global-header">
        <button class="header-brand" type="button" @click="sheet='switcher'" aria-label="切换 ALOHA 应用">
          <span class="brand-mark"><Heart :size="20" fill="currentColor"/></span>
          <span class="header-brand-name">Health</span><ChevronDown :size="16"/>
        </button>
        <div class="header-tools">
          <span class="preview-label">体验版本</span>
          <button class="icon-button" type="button" aria-label="问问 Health" title="问问 Health" @click="openAgent"><Sparkles :size="20"/></button>
          <button class="avatar-button" type="button" aria-label="个人与数据共享" title="个人与数据共享" @click="sheet='account'"><CircleHelp :size="21"/></button>
        </div>
      </header>

      <main class="content">
        <section v-if="activeTab==='home'" class="home-view">
          <div class="intro-row">
            <div><span class="eyebrow">你的健康空间</span><h1>慢慢积累记录，<br class="mobile-only">更好地了解自己。</h1><p>从长期状态出发，关注每一次值得记录的变化。</p></div>
            <button class="quiet-button overview-shortcut" type="button" @click="openBody('overview')"><HeartPulse :size="17"/> 身体概览 <ArrowUpRight :size="16"/></button>
          </div>
          <div class="dashboard-layout">
            <section class="hero-card">
              <div class="hero-head"><span>健康概览</span><span>持续关注的内容</span></div>
              <div class="hero-main"><div><h2>{{ activeConcerns.length }} 项正在关注</h2><p>记录已经开始。这里会随着健康资料和日常记录逐步丰富。</p></div><HeartPulse class="hero-watermark" :size="92" :stroke-width="1"/></div>
              <div class="hero-stats"><button type="button" @click="openBody('concerns')"><b>{{ activeConcerns.length }}</b><span>关注事项 <ChevronRight :size="15"/></span></button><button type="button" @click="openBody('documents')"><b>{{ docCount }}</b><span>资料 <ChevronRight :size="15"/></span></button><button type="button" @click="openBody('timeline')"><b>{{ demo.observations.length }}</b><span>测量记录 <ChevronRight :size="15"/></span></button></div>
            </section>
            <section class="ui-card focus-panel">
              <div class="card-heading"><div><span class="eyebrow">持续关注</span><h2>正在关注的健康问题</h2></div><button class="inline-link" type="button" @click="openBody('concerns')">查看全部 <ArrowUpRight :size="15"/></button></div>
              <button v-for="c in activeConcerns.slice(0,3)" :key="c.id" type="button" class="row-link" @click="show('concern',c.id)">
                <span class="list-icon"><Heart :size="19"/></span><span class="row-main"><b>{{ c.name }}</b><small>{{ c.summary || '点击查看关联的健康记录' }}</small></span><ChevronRight :size="18" class="subtle-icon"/>
              </button>
              <button class="add-inline" type="button" @click="openEditor('concern')"><Plus :size="17"/> 添加关注事项</button>
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
          <button class="agent-prompt" type="button" @click="openAgent"><span class="agent-mark"><Sparkles :size="24"/></span><span><b>问问 Health</b><small>了解记录、回顾变化或准备下一步</small></span><ArrowUpRight :size="20"/></button>
        </section>

        <section v-else-if="activeTab==='body'" class="body-view">
          <template v-if="selected && current">
            <button class="back-button" type="button" @click="back"><ArrowLeft :size="18"/> 返回</button>
            <div class="detail-heading">
              <div><span class="eyebrow">{{ labelForKind(selected.kind) }}</span><h1>{{ detailName(selected.kind,current) }}</h1>
                <p v-if="selected.kind==='concern'">{{ current.summary || '你的长期健康关注事项' }}</p>
                <p v-else-if="selected.kind==='assessment'">保留判断依据，方便以后回顾</p>
                <p v-else-if="selected.kind==='document'">原始文件与提取结果分别整理</p>
                <p v-else>查看详情和相关记录</p>
              </div>
              <div class="detail-actions"><button type="button" class="quiet-button" @click="openEditor(selected.kind,current.id)"><Pencil :size="16"/> 修改</button><button type="button" class="icon-button destructive" aria-label="删除演示记录" @click="removeCurrent"><Trash2 :size="18"/></button></div>
            </div>
            <div v-if="selected.kind==='concern'" class="detail-columns">
              <section class="ui-card detail-primary">
                <div class="card-heading"><h2>现在怎么样？</h2><span class="status-chip">{{ current.status==='active'?'持续关注':'已结束' }}</span></div>
                <p class="body-copy">{{ current.summary || '你可以添加相关指标，逐步建立健康记录。' }}</p>
                <div class="detail-stat"><b>{{ concernRelated.observations.length }}</b><span>条相关观测</span><span class="stat-separator"></span><b>{{ concernRelated.documents.length }}</b><span>份相关资料</span></div>
                <div class="mini-label">相关指标</div>
                <button v-for="o in concernRelated.observations.slice().sort((a,b)=>b.observedDate.localeCompare(a.observedDate)).slice(0,3)" :key="o.id" class="row-link" type="button" @click="show('observation',o.id)"><span class="list-icon"><Activity :size="18"/></span><span class="row-main"><b>{{ observationTitle(o) }}</b><small>{{ displayDate(o.observedDate) }}</small></span><ChevronRight :size="16"/></button>
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

            <div v-else-if="selected.kind==='metric'" class="detail-columns">
              <section class="ui-card detail-primary">
                <div class="card-heading"><h2>观测趋势</h2><span class="quiet-caption">{{ current.defaultUnit || '无单位' }}</span></div>
                <div class="metric-hero"><strong>{{ latestFor(current.id) ? observationValue(latestFor(current.id)!,current) : '暂无记录' }}</strong><span>最近一次观测</span></div>
                <div v-if="chartPoints(current.id)" class="chart-wrap"><svg viewBox="0 0 340 100" preserveAspectRatio="none" aria-label="按时间变化的示意趋势"><polyline :points="chartPoints(current.id)"/></svg></div>
                <p class="helper-copy">图表仅连接已记录的数值，不自动判断健康状况。</p>
                <button class="primary-button" type="button" @click="openEditor('observation');draft.metricId=current.id;draft.unit=current.defaultUnit"><Plus :size="17"/> 记录一次</button>
              </section>
              <section class="ui-card"><h2>历史记录</h2>
                <button v-for="o in demo.observations.filter(o=>o.metricId===current.id).sort((a,b)=>b.observedDate.localeCompare(a.observedDate))" :key="o.id" type="button" class="row-link" @click="show('observation',o.id)"><span class="row-main"><b>{{ observationValue(o,current) }}</b><small>{{ displayDate(o.observedDate) }} · {{ labelFrom(observationStatuses,o.status) }}</small></span><ChevronRight :size="16"/></button>
                <p v-if="!demo.observations.some(o=>o.metricId===current.id)" class="empty-inline">暂时没有历史记录。</p>
              </section>
            </div>
            <div v-else class="detail-columns">
              <section class="ui-card detail-primary">
                <div class="card-heading"><h2>记录详情</h2><span v-if="selected.kind==='observation'||selected.kind==='assessment'" class="status-chip">{{ labelFrom(observationStatuses,current.status) }}</span><span v-else-if="selected.kind==='regimen'" class="status-chip">{{ labelFrom(regimenStatuses,current.status) }}</span></div>
                <template v-if="selected.kind==='observation'">
                  <div class="metric-hero"><strong>{{ valuePreview }}</strong><span>{{ nameOfMetric(current.metricId) }}</span></div>
                  <dl class="detail-fields"><div><dt>记录日期</dt><dd>{{ displayDate(current.observedDate) }}</dd></div><div><dt>来源说明</dt><dd>{{ current.sourceNote||'手动记录' }}</dd></div><div v-if="current.interpretation"><dt>原记录标记</dt><dd>{{ labelFrom(interpretationTypes,current.interpretation) }}</dd></div><div v-if="current.notes"><dt>备注</dt><dd>{{ current.notes }}</dd></div></dl>
                </template>
                <template v-else-if="selected.kind==='event'"><p class="body-copy">{{ current.description || '没有补充说明' }}</p><dl class="detail-fields"><div><dt>事件类型</dt><dd>{{ eventName(current) }}</dd></div><div><dt>发生日期</dt><dd>{{ displayDate(current.date) }}</dd></div><div><dt>地点</dt><dd>{{ current.location||'未填写' }}</dd></div></dl></template>
                <template v-else-if="selected.kind==='document'"><div class="document-preview"><FileHeart :size="40"/><span>{{ current.fileName }}</span><small>体验版仅保存文件名，不包含实际文件</small></div><dl class="detail-fields"><div><dt>资料类型</dt><dd>{{ docName(current) }}</dd></div><div><dt>资料日期</dt><dd>{{ displayDate(current.issuedDate) }}</dd></div><div><dt>出具机构</dt><dd>{{ current.issuerName||'未填写' }}</dd></div></dl></template>
                <template v-else-if="selected.kind==='assessment'"><p class="body-copy">{{ current.content }}</p><dl class="detail-fields"><div><dt>评估日期</dt><dd>{{ displayDate(current.assessedDate) }}</dd></div><div><dt>来源说明</dt><dd>{{ current.sourceNote||'未填写' }}</dd></div></dl></template>
                <template v-else-if="selected.kind==='regimen'"><p class="body-copy">{{ current.instructions }}</p><dl class="detail-fields"><div><dt>方案类型</dt><dd>{{ labelFrom(regimenTypes,current.regimenType) }}</dd></div><div><dt>安排</dt><dd>{{ current.recurrence==='daily'?'每日':current.recurrence==='weekly'?'每周':'不重复' }}</dd></div><div><dt>首次执行</dt><dd>{{ displayDate(current.firstDueDate) }}</dd></div><div><dt>开始日期</dt><dd>{{ displayDate(current.startDate) }}</dd></div><div><dt>结束日期</dt><dd>{{ displayDate(current.endDate) }}</dd></div></dl></template>
                <div class="relation-tags" v-if="current.concernIds?.length"><span class="mini-label">相关健康问题</span><button v-for="cid in current.concernIds" :key="cid" type="button" class="relation-pill" @click="show('concern',cid)"><Link2 :size="13"/>{{ nameOfConcern(cid) }}</button></div>
              </section>
              <section class="ui-card"><div class="card-heading"><h2>{{ selected.kind==='assessment'?'判断依据':'关联资料' }}</h2></div>
                <template v-if="selected.kind==='assessment'"><button v-for="id in current.basisIds" :key="id" type="button" class="row-link" @click="show(id.startsWith('d-')||demo.documents.some(d=>d.id===id)?'document':'observation',id)"><span class="list-icon"><FileText :size="18"/></span><span class="row-main"><b>{{ demo.documents.find(d=>d.id===id)?.title||observationTitle(demo.observations.find(o=>o.id===id)!) }}</b><small>已关联的依据</small></span><ChevronRight :size="17"/></button><p v-if="!current.basisIds.length" class="empty-inline">还没有关联依据，可以通过“修改”补充。</p></template>
                <template v-else-if="selected.kind==='observation'&&current.sourceDocumentId"><button class="row-link" type="button" @click="show('document',current.sourceDocumentId)"><span class="list-icon"><FileText :size="18"/></span><span class="row-main"><b>{{ nameOfDocument(current.sourceDocumentId) }}</b><small>原始资料</small></span><ChevronRight :size="17"/></button></template>
                <template v-else-if="selected.kind==='regimen'&&current.sourceDocumentId"><button class="row-link" type="button" @click="show('document',current.sourceDocumentId)"><span class="list-icon"><FileText :size="18"/></span><span class="row-main"><b>{{ nameOfDocument(current.sourceDocumentId) }}</b><small>方案来源</small></span><ChevronRight :size="17"/></button></template>
                <p v-else-if="selected.kind!=='assessment'" class="empty-inline">这里会显示与当前记录有关的资料和记录。</p>
              </section>
            </div>
          </template>

          <template v-else>
            <div class="page-heading"><div><span class="eyebrow">身体健康</span><h1>从记录到理解</h1><p>集中查看健康问题、指标、事件、资料和长期方案。</p></div><button class="primary-button" type="button" @click="openEditor('observation')"><Plus :size="18"/> 添加记录</button></div>
            <nav class="sub-navigation" aria-label="身体页面导航">
              <button v-for="item in bodyTabs" :key="item.id" :class="{active:bodyTab===item.id}" type="button" @click="bodyTab=item.id;search=''">{{ item.title }}</button>
            </nav>
            <div v-if="bodyTab==='overview'" class="body-overview">
              <button type="button" class="body-map-link" @click="bodyTab='concerns'"><span class="body-map-icon"><HeartPulse :size="30"/></span><span><b>身体健康图</b><small>从身体状态进入你关注的问题</small></span><ArrowUpRight :size="20"/></button>
              <div class="two-columns">
                <section class="ui-card"><div class="card-heading"><h2>健康问题</h2><button class="inline-link" type="button" @click="bodyTab='concerns'">查看全部 <ArrowUpRight :size="15"/></button></div><button v-for="c in demo.concerns" :key="c.id" class="row-link" type="button" @click="show('concern',c.id)"><span class="list-icon"><Heart :size="18"/></span><span class="row-main"><b>{{ c.name }}</b><small>{{ c.summary }}</small></span><ChevronRight :size="17"/></button></section>
                <section class="ui-card"><div class="card-heading"><h2>最近的记录</h2><button class="inline-link" type="button" @click="bodyTab='timeline'">时间线 <ArrowUpRight :size="15"/></button></div><button v-for="e in timeline.slice(0,4)" :key="e.id" class="row-link" type="button" @click="show(e.kind,e.id)"><span class="list-icon"><component :is="kindIcon[e.kind]" :size="18"/></span><span class="row-main"><b>{{ e.title }}</b><small>{{ displayDate(e.date) }}</small></span><ChevronRight :size="17"/></button></section>
              </div>
              <div class="quick-actions"><button type="button" @click="openEditor('event')"><CalendarDays :size="18"/> 记一件健康事件</button><button type="button" @click="openImport()"><Upload :size="18"/> 整理报告</button><button type="button" @click="openEditor('assessment')"><BadgeCheck :size="18"/> 记录健康评估</button></div>
            </div>
            <template v-else>
              <div class="list-toolbar">
                <label class="search-field"><Search :size="17"/><input v-model="search" aria-label="搜索当前内容" placeholder="搜索当前内容"/></label>
                <button class="primary-button" type="button" @click="bodyTab==='concerns'?openEditor('concern'):bodyTab==='metrics'?openEditor('metric'):bodyTab==='documents'?openImport():bodyTab==='regimens'?openEditor('regimen'):openEditor('event')">
                  <Plus :size="17"/>{{ bodyTab==='concerns'?'添加关注':bodyTab==='metrics'?'新增指标':bodyTab==='documents'?'添加资料':bodyTab==='regimens'?'新建方案':'记一件事' }}
                </button>
              </div>
              <div v-if="bodyTab==='timeline'" class="quick-actions slim"><button @click="openEditor('observation')" type="button"><ClipboardCheck :size="17"/> 测量</button><button @click="openEditor('event')" type="button"><CalendarDays :size="17"/> 事件</button><button @click="openEditor('assessment')" type="button"><BadgeCheck :size="17"/> 评估</button></div>
              <div class="list-panel">
                <template v-if="bodyTab==='concerns'"><button v-for="c in filteredConcerns" :key="c.id" class="list-row" type="button" @click="show('concern',c.id)"><span class="list-icon"><Heart :size="19"/></span><span class="row-main"><b>{{ c.name }}</b><small>{{ c.summary||'持续记录和回顾' }}</small></span><span class="status-chip">{{ c.status==='active'?'关注中':'已结束' }}</span><ChevronRight :size="18"/></button></template>
                <template v-if="bodyTab==='metrics'"><button v-for="m in filteredMetrics" :key="m.id" class="list-row" type="button" @click="show('metric',m.id)"><span class="list-icon"><Activity :size="19"/></span><span class="row-main"><b>{{ m.name }}</b><small>{{ labelFrom(valueTypes,m.valueType) }} {{ m.defaultUnit?' · '+m.defaultUnit:'' }}</small></span><strong class="list-value">{{ latestFor(m.id)?observationValue(latestFor(m.id)!,m):'—' }}</strong><ChevronRight :size="18"/></button></template>
                <template v-if="bodyTab==='timeline'"><button v-for="e in filteredTimeline" :key="e.kind+e.id" class="list-row" type="button" @click="show(e.kind,e.id)"><span class="list-icon"><component :is="kindIcon[e.kind]" :size="19"/></span><span class="row-main"><b>{{ e.title }}</b><small>{{ e.meta }} · {{ displayDate(e.date) }}</small></span><ChevronRight :size="18"/></button></template>
                <template v-if="bodyTab==='documents'"><button v-for="d in filteredDocuments" :key="d.id" class="list-row" type="button" @click="show('document',d.id)"><span class="list-icon"><FileText :size="19"/></span><span class="row-main"><b>{{ d.title }}</b><small>{{ docName(d) }} · {{ displayDate(d.issuedDate) }}</small></span><ChevronRight :size="18"/></button></template>
                <template v-if="bodyTab==='regimens'"><button v-for="r in filteredRegimens" :key="r.id" class="list-row" type="button" @click="show('regimen',r.id)"><span class="list-icon"><ListChecks :size="19"/></span><span class="row-main"><b>{{ r.name }}</b><small>{{ labelFrom(regimenTypes,r.regimenType) }} · {{ r.recurrence==='daily'?'每日':r.recurrence==='weekly'?'每周':'不重复' }}</small></span><span class="status-chip">{{ labelFrom(regimenStatuses,r.status) }}</span><ChevronRight :size="18"/></button></template>
                <div v-if="(bodyTab==='concerns'&&!filteredConcerns.length)||(bodyTab==='metrics'&&!filteredMetrics.length)||(bodyTab==='timeline'&&!filteredTimeline.length)||(bodyTab==='documents'&&!filteredDocuments.length)||(bodyTab==='regimens'&&!filteredRegimens.length)" class="empty-state"><Search :size="26"/><b>没有找到相关内容</b><span>试试其他关键词，或添加一条新记录。</span></div>
              </div>
              <p v-if="bodyTab==='documents'" class="below-hint"><ShieldCheck :size="16"/> 上传演示只模拟整理过程，不会读取或发送文件内容。</p>
            </template>
          </template>
        </section>

        <section v-else class="future-page"><span class="eyebrow">接下来还会逐步完善</span><h1>{{ activeTab==='food'?'饮食管理':'运动管理' }}</h1><p>{{ activeTab==='food'?'把日常饮食记录和身体变化联系起来。':'了解运动频率、训练表现和身体恢复。' }}</p><div class="future-card"><component :is="activeTab==='food'?Utensils:Activity" :size="36"/><h2>先把重要的健康记录整理好</h2><p>饮食和运动会继续沿用这套操作方式，提供各自更适合的记录和分析页面。</p><button class="quiet-button" type="button" @click="openBody('overview')">看看身体管理 <ArrowRight :size="16"/></button></div></section>
      </main>
    </div>
    <nav class="bottom-nav" aria-label="主导航"><button v-for="item in navItems" :key="item.id" :class="{active:activeTab===item.id}" type="button" @click="navigate(item.id)"><component :is="item.icon" :size="22" :stroke-width="1.8"/><span>{{ item.title }}</span></button></nav>

    <div v-if="sheet" class="modal-backdrop" @click.self="closeSheet">
      <section class="drawer" role="dialog" aria-modal="true" :aria-label="sheet==='edit'?'编辑健康记录':sheet==='import'?'整理报告':sheet==='agent'?'问问 Health':'应用菜单'">
        <div class="drawer-handle"></div>
        <header class="drawer-heading"><div><span class="eyebrow">{{ sheet==='edit'?'健康记录':sheet==='import'?'整理一份健康资料':'ALOHA Health' }}</span><h2>{{ sheet==='edit'?(editId?'修改':'添加')+kindLabel[editKind]:sheet==='import'?'整理健康报告':sheet==='agent'?'问问 Health':sheet==='switcher'?'切换应用':'个人与数据共享' }}</h2></div><button class="icon-button" aria-label="关闭" type="button" @click="closeSheet"><X :size="20"/></button></header>

        <form v-if="sheet==='edit'" class="editor-form" @submit.prevent="formSave">
          <p class="form-intro">填写你知道的内容即可，之后还可以修改。</p>
          <template v-if="editKind==='concern'">
            <label>关注事项名称 <span>*</span><input v-model="draft.name" maxlength="160" required placeholder="例如：睡眠调整"/></label>
            <label>情况说明<textarea v-model="draft.summary" rows="3" placeholder="为什么想持续关注这件事？"/></label>
            <label>当前状态<select v-model="draft.status"><option value="active">持续关注</option><option value="inactive">已结束</option></select></label>
            <div class="form-two"><label>开始日期<input v-model="draft.onsetDate" type="date"/></label><label>结束日期<input v-model="draft.resolvedDate" type="date"/></label></div>
            <label>备注<textarea v-model="draft.notes" rows="2"/></label>
          </template>
          <template v-else-if="editKind==='metric'">
            <label>指标名称 <span>*</span><input v-model="draft.name" maxlength="160" required placeholder="例如：静息心率"/></label>
            <label>记录方式 <select v-model="draft.valueType"><option v-for="[value,name] in valueTypes" :key="value" :value="value">{{ name }}</option></select></label>
            <label v-if="draft.valueType==='number'">单位<input v-model="draft.defaultUnit" placeholder="例如：次/分"/></label>
            <p class="helper-copy">同一种指标只需建一次，之后可以持续记录。</p>
          </template>
          <template v-else-if="editKind==='observation'">
            <label>记录哪一项 <span>*</span><select v-model="draft.metricId"><option v-for="m in demo.metrics" :key="m.id" :value="m.id">{{ m.name }}</option></select></label>
            <template v-if="demo.metrics.find(m=>m.id===draft.metricId)?.valueType==='boolean'"><label>本次结果 <span>*</span><select v-model="draft.value"><option value="">请选择</option><option value="true">是</option><option value="false">否</option></select></label></template>
            <template v-else><label>记录结果 <span>*</span><input v-model="draft.value" :type="demo.metrics.find(m=>m.id===draft.metricId)?.valueType==='number'?'number':'text'" :step="demo.metrics.find(m=>m.id===draft.metricId)?.valueType==='number'?'any':undefined" required placeholder="填写此次记录"/></label></template>
            <label v-if="demo.metrics.find(m=>m.id===draft.metricId)?.valueType==='number'">单位<input v-model="draft.unit" :placeholder="demo.metrics.find(m=>m.id===draft.metricId)?.defaultUnit||'选填'"/></label>
            <label>测量日期 <span>*</span><input v-model="draft.observedDate" type="date" required/></label>
            <div class="form-two"><label>记录状态<select v-model="draft.status"><option v-for="[value,name] in observationStatuses" :key="value" :value="value">{{ name }}</option></select></label><label>原报告标记<select v-model="draft.interpretation"><option v-for="[value,name] in interpretationTypes" :key="value" :value="value">{{ name }}</option></select></label></div>
            <label>参考资料<select v-model="draft.sourceDocumentId"><option value="">没有或稍后补充</option><option v-for="d in demo.documents" :key="d.id" :value="d.id">{{ d.title }}</option></select></label>
            <label>来源说明<input v-model="draft.sourceNote" placeholder="例如：家用设备"/></label>
            <label>备注<textarea v-model="draft.notes" rows="2"/></label>
          </template>
          <template v-else-if="editKind==='event'">
            <label>发生了什么 <span>*</span><input v-model="draft.summary" maxlength="200" required placeholder="例如：一次门诊咨询"/></label>
            <label>事件类型<select v-model="draft.eventType"><option v-for="[value,name] in eventTypes" :key="value" :value="value">{{ name }}</option></select></label>
            <label>发生日期 <span>*</span><input v-model="draft.date" type="date" required/></label>
            <label>地点<input v-model="draft.location" placeholder="例如：社区医院"/></label>
            <label>事情经过<textarea v-model="draft.description" rows="3"/></label>
            <label>状态<select v-model="draft.status"><option value="active">已记录</option><option value="cancelled">已取消</option></select></label>
          </template>
          <template v-else-if="editKind==='document'">
            <label>资料名称 <span>*</span><input v-model="draft.title" required placeholder="例如：年度检查报告"/></label>
            <label>资料类型<select v-model="draft.documentType"><option v-for="[value,name] in documentTypes" :key="value" :value="value">{{ name }}</option></select></label>
            <label>选择文件 <span>*</span><input type="file" accept=".pdf,.png,.jpg,.jpeg" @change="pickFile"/><small>只保留文件名，不读取内容。</small></label>
            <p v-if="draft.fileName" class="file-picked"><FileText :size="16"/>{{ draft.fileName }}</p>
            <div class="form-two"><label>资料日期<input v-model="draft.issuedDate" type="date"/></label><label>出具机构<input v-model="draft.issuerName" placeholder="选填"/></label></div>
            <label>相关健康事件<select v-model="draft.eventId"><option value="">不关联</option><option v-for="e in demo.events" :key="e.id" :value="e.id">{{ e.summary }}</option></select></label>
            <label>备注<textarea v-model="draft.notes" rows="2"/></label>
          </template>
          <template v-else-if="editKind==='assessment'">
            <label>评估标题 <span>*</span><input v-model="draft.title" required placeholder="例如：本次检查结果回顾"/></label>
            <label>评估内容 <span>*</span><textarea v-model="draft.content" rows="4" required placeholder="记录医生意见或经确认的总结，不要混作原始数据"/></label>
            <div class="form-two"><label>评估日期 <span>*</span><input v-model="draft.assessedDate" required type="date"/></label><label>状态<select v-model="draft.status"><option v-for="[value,name] in observationStatuses" :key="value" :value="value">{{ name }}</option></select></label></div>
            <fieldset class="check-group"><legend>依据哪些记录？</legend><label v-for="d in demo.documents" :key="d.id" class="checkbox-line"><input v-model="draft.basisIds" type="checkbox" :value="d.id"/>{{ d.title }}</label><label v-for="o in demo.observations.slice(0,5)" :key="o.id" class="checkbox-line"><input v-model="draft.basisIds" type="checkbox" :value="o.id"/>{{ observationTitle(o) }}</label></fieldset>
            <label>来源说明<input v-model="draft.sourceNote" placeholder="例如：医生意见、个人整理"/></label>
          </template>
          <template v-else-if="editKind==='regimen'">
            <label>方案名称 <span>*</span><input v-model="draft.name" required placeholder="例如：每周活动计划"/></label>
            <label>方案类型<select v-model="draft.regimenType"><option v-for="[value,name] in regimenTypes" :key="value" :value="value">{{ name }}</option></select></label>
            <label>怎么执行 <span>*</span><textarea v-model="draft.instructions" rows="3" required placeholder="记录具体可执行的安排"/></label>
            <label>状态<select v-model="draft.status"><option v-for="[value,name] in regimenStatuses" :key="value" :value="value">{{ name }}</option></select></label>
            <div class="form-two"><label>开始日期<input v-model="draft.startDate" type="date"/></label><label>结束日期<input v-model="draft.endDate" type="date"/></label></div>
            <label>需要重复提醒吗？<select v-model="draft.recurrence"><option value="none">不重复</option><option value="daily">每天</option><option value="weekly">每周</option></select></label>
            <label v-if="draft.recurrence!=='none'">首次执行日期 <span>*</span><input v-model="draft.firstDueDate" required type="date"/></label>
            <label>参考资料<select v-model="draft.sourceDocumentId"><option value="">无</option><option v-for="d in demo.documents" :key="d.id" :value="d.id">{{ d.title }}</option></select></label>
            <label>方案来源<input v-model="draft.sourceNote" placeholder="例如：个人计划"/></label>
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
            <div class="extract-card"><div class="extract-head"><ClipboardCheck :size="19"/><b>示例：一次血压测量</b></div><strong>118 <small>mmHg</small></strong><p>测量日期：今天 · 尚未确认</p><label class="checkbox-line"><input v-model="uploadIncludeResult" type="checkbox"/> 同时添加这条演示结果</label></div>
            <p class="helper-copy">未勾选时，只创建一份资料记录；不会凭空添加身体测量。</p>
          </template>
          <template v-else>
            <div class="flow-copy"><h3>确认本次整理</h3><p>你可以回到上一步修改，确认后将只向当前体验页添加临时演示记录。</p></div>
            <div class="summary-block"><p><CheckCircle2 :size="17"/> 资料：{{ uploadTitle }}</p><p><CheckCircle2 :size="17"/> 已选文件名：{{ uploadedName }}</p><p><CheckCircle2 :size="17"/> 示例测量：{{ uploadIncludeResult?'同时添加':'不添加' }}</p></div>
          </template>
          <p v-if="formError" class="form-error"><Info :size="16"/>{{ formError }}</p>
          <div class="form-actions"><button class="quiet-button" type="button" @click="uploadStage===1?closeSheet():uploadStage--">{{ uploadStage===1?'取消':'上一步' }}</button><button class="primary-button" type="button" @click="importNext">{{ uploadStage===3?'确认添加':'下一步' }} <ArrowRight :size="17"/></button></div>
        </div>

        <div v-else-if="sheet==='agent'" class="agent-flow">
          <div class="agent-welcome"><span class="agent-glow"><Sparkles :size="25"/></span><h3>你可以从这里提问</h3><p>正在查看：{{ contextName }}。正式版本会结合你已授权的记录给出有来源的解释。</p></div>
          <button class="suggestion" type="button" @click="agentQuestion='最近的健康记录有哪些变化？';sendAgent()">最近有哪些变化？ <ArrowUpRight :size="15"/></button>
          <button class="suggestion" type="button" @click="agentQuestion='这些资料分别记录了什么？';sendAgent()">帮我整理一下资料 <ArrowUpRight :size="15"/></button>
          <div v-if="agentReply" class="agent-reply"><Sparkles :size="18"/><span>{{ agentReply }}</span></div>
          <form class="agent-input" @submit.prevent="sendAgent"><textarea v-model="agentQuestion" rows="3" placeholder="想了解什么？"/><button class="primary-button" type="submit">模拟提问 <ArrowRight :size="16"/></button></form>
          <p class="privacy-note"><ShieldCheck :size="15"/> 此处为固定演示回复，未接入真实 AI 或健康数据。</p>
        </div>

        <div v-else-if="sheet==='switcher'" class="switcher-flow">
          <button v-for="item in ['Health','Assistant','Finance','Things']" :key="item" class="switcher-row" type="button" @click="item==='Health'?closeSheet():notice='其他应用入口尚未开放，本页仅演示切换样式。'"><span class="app-emblem"><Heart v-if="item==='Health'" :size="22"/><Sparkles v-else-if="item==='Assistant'" :size="22"/><Activity v-else-if="item==='Finance'" :size="22"/><LayoutGrid v-else :size="22"/></span><span><b>{{ item }}</b><small>{{ item==='Health'?'当前健康空间':'其他 ALOHA 应用' }}</small></span><Check v-if="item==='Health'" :size="19"/><ArrowUpRight v-else :size="18"/></button>
        </div>
        <div v-else class="account-flow"><ShieldCheck :size="32"/><h3>你的健康记录由你掌握</h3><p>正式版本会使用统一的 ALOHA 账号和数据共享设置。你可以决定是否向已授权的人或应用开放健康数据。</p><div class="account-note">当前是单人体验原型，没有连接账号，也不会展示其他家庭成员的数据。</div></div>
      </section>
    </div>
    <div v-if="notice" role="status" class="toast"><span>{{ notice }}</span><button type="button" aria-label="关闭提示" @click="notice=''"><X :size="17"/></button></div>
  </div>
</template>
