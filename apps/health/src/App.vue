<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { editableSnapshot } from './health-editor'
import { selectedAuthorizedHealthSpace } from './health-space-entry'
import { newestFirst, pageOf, pageCount, recentMetricIds, searchMetrics } from './health-concern-view'
import {
  Activity, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, CalendarDays, Check, CheckCircle2,
  ChevronDown, ChevronRight, CircleHelp, ClipboardCheck, ClipboardList, Clock3, FileHeart,
  FilePlus2, FileText, FolderHeart, Heart, HeartPulse, Home, Info, LayoutGrid, Link2,
  ListChecks, Menu, MoreHorizontal, Pencil, Plus, Search, ShieldCheck, Sparkles,
  Stethoscope, Trash2, TrendingDown, Upload, Utensils, X, PanelLeftClose, PanelLeftOpen,
} from 'lucide-vue-next'
import { useDemoAgentSession } from './agent-demo'
import { createHealthRecord, deleteHealthRecord, deleteConcernPresentation,
  getAlohaWorkspace, getAlohaUserProfile, patchConcernPresentation,
  getHealthSnapshot as apiSnapshot, getHealthPage as apiPage, getMetricSummaries as apiSummaries, getSelectedHealthRecords as apiSelected, getOwnSpacePerson, HealthApiError, updateHealthRecord, uploadHealthDocument,
  listConcernRelations as apiRelations,linkConcernRecord,unlinkConcernRecord,
  type FileUploadProgress,
  type HealthRecord, type HealthSnapshot, type HealthModelKey } from './health-api'
import { decodeHealthRecord, emptyHealthData, encodeHealthFields, healthKinds, healthModelKey } from './health-live'
import {METRIC_PAGE_SIZE} from './health-page-query'
import {HealthQueryState,HealthReadCoordinator,HealthViewState,HEALTH_STALE_MS,HEALTH_REFRESH_PAGES,rebuildCursorWindow,type QueryKey,type QueryTag} from './health-query-state'
import { concernTargetHasRelation,concernTargetModels,
  type ConcernRelation,type ConcernTargetKind } from './health-concern-relations'
import AlohaHub from '@aloha/ui/AlohaHub.vue'
import HealthPageHeader from './components/HealthPageHeader.vue'
import HealthDocumentPreview from './components/HealthDocumentPreview.vue'
import HealthCreateMenu from './components/HealthCreateMenu.vue'
import ConcernPager from './components/ConcernPager.vue'
import ConcernLinkEditor from './components/ConcernLinkEditor.vue'
import HealthReferenceSelect from './components/HealthReferenceSelect.vue'
import BodyOverview from './components/BodyOverview.vue'
import HealthTimeline from './components/HealthTimeline.vue'
import MetricTrend from './components/MetricTrend.vue'
import ReferenceIndicator from './components/ReferenceIndicator.vue'
import HealthSkeleton from './components/HealthSkeleton.vue'
import { latestObservationIndex, concernContentState } from './health-loading-ux'
import {matchMetricReferenceFilter, metricReferenceState, type MetricReferenceFilter} from './metric-reference-filter'
import type { TimelineFilter, TimelineKind, TimelineEntry } from './health-timeline'
import {mergeTimelinePage,newTimelineStreams,type TimelineStream} from './health-timeline-page'
import { compareReference,formatReferenceRange,parseReferenceDraft,validateReferenceDraft } from './health-reference'
import { removeConcernPoint, seedBodyBindings, setConcernPoint, type BodyMapBinding, type BodyPoint, type BodyView } from './body-map'
import { concernAttentionOptions, attentionColor, parseConcernAttention, type ConcernAttention } from './concern-attention'
import { primaryAction, recordChoices, saveDestination, type HealthLocation } from './health-journeys'
import {
  buildObservationValue, documentTypes, eventTypes, labelFrom, makeEmpty,
  assessmentStatuses, observationValue, regimenStatuses, regimenTypes, seedDemo,
  validateConcern, validateObservation, validateRegimen, validateEventTime, valueTypes,
  type HealthKind, type Metric, type Observation, type Regimen,
} from './demo-model'

type Tab = 'home' | 'body' | 'food' | 'movement' | 'more'
type BodyTab = 'focus' | 'metrics' | 'timeline' | 'documents' | 'regimens'
type Sheet = '' | 'edit' | 'import'
type RecordView = { kind: HealthKind; id: string }
// External app URLs are public routing configuration; Identity profile is read
// from the trusted Health BFF, never from arbitrary client claims.
const alohaApps = [
  { id:'assistant', name:'Assistant', href:import.meta.env.VITE_ALOHA_ASSISTANT_URL || undefined },
  { id:'health', name:'Health', iconUrl:`${import.meta.env.BASE_URL}app-icon.svg` },
  { id:'finance', name:'Finance', href:import.meta.env.VITE_ALOHA_FINANCE_URL || undefined },
  { id:'things', name:'Things', href:import.meta.env.VITE_ALOHA_THINGS_URL || undefined },
]
const accountCenterUrl='https://account.aisr.online/'
// Production stays same-origin; Preview may supply the separately protected
// Settings Preview URL (public routing configuration, never a credential).
const hubSettingsRoot=import.meta.env.VITE_ALOHA_SETTINGS_URL||'/settings/'
const hubSettingsUrl=(hubSettingsRoot.endsWith('/')?hubSettingsRoot:hubSettingsRoot+'/')+'?from=health'
const hubProfile=ref<{displayName:string;avatarUrl:string|null}|null>(null)
const alohaPublicLinks=computed(()=>({
  accountUrl:accountCenterUrl,
  accountLabel:hubProfile.value?.displayName||'账号',
  avatarUrl:hubProfile.value?.avatarUrl||undefined,
  spaceName:liveSpaces.value.find(space=>space.id===selectedSpaceId.value)?.name,
  settingsUrl:hubSettingsUrl,
  privacyUrl:import.meta.env.VITE_ALOHA_PRIVACY_URL || undefined,
  helpUrl:import.meta.env.VITE_ALOHA_HELP_URL || undefined,
}))
const sidebarCollapsed = ref(false)
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
// Demo remains an explicitly opt-in development mode; live has no synthetic fallback.
const liveMode = import.meta.env.VITE_HEALTH_DATA_MODE === 'live'
const demo = reactive(liveMode ? emptyHealthData() : seedDemo())
type SpaceChoice = {id:string,name:string,role:string,timezone?:string}
const liveSpaces = ref<SpaceChoice[]>([])
const selectedSpaceId = ref('')
const subjectPersonId = ref('')
const liveStatus = ref<'idle'|'loading'|'ready'|'error'>('idle')
const liveMessage = ref('')
// The Home slot is reserved for a future cross-domain overview; land on Body for now.
const activeTab = ref<Tab>('body')
const bodyTab = ref<BodyTab>('focus')
const mapView = ref<BodyView>('front')
const mapSelectedConcern = ref<string|null>(null)
const bodyBindings = ref<BodyMapBinding[]>(liveMode ? [] : seedBodyBindings())
// App-only user priorities; this does not extend the LifeSpace HealthConcern schema.
const attentionByConcern = ref<Record<string,ConcernAttention>>(liveMode ? {} : {'c-1':'watch','c-2':'routine'})
const selected = ref<RecordView | null>(null)
const routeStack = ref<HealthLocation[]>([])
const sheet = ref<Sheet>('')
const editKind = ref<HealthKind>('concern')
const editId = ref('')
const draft = ref<Record<string,any>>({})
const formError = ref('')
const saving=ref(false)
const uploadProgress=ref<FileUploadProgress|null>(null)
const uploadFile=shallowRef<File|null>(null)
/** Searchable Metric chooser and an inline quick-create path.
 * The Observation draft is kept intact while its Metric is created.
 */
const metricPickerOpen=ref(false)
const metricSearch=ref('')
const quickMetricOpen=ref(false)
const quickMetricSaving=ref(false)
const quickMetricError=ref('')
const quickMetric=reactive({name:'',valueType:'number',defaultUnit:''})
const recentMetrics=computed(()=>recentMetricIds(demo.observations,demo.metrics).map(id=>
  demo.metrics.find(metric=>metric.id===id)!).filter(Boolean))
const metricMatches=computed(()=>liveMode?(formChoiceKind.value==='metric'?formChoiceItems.value as Metric[]:[]):searchMetrics(demo.metrics,metricSearch.value))
function chooseObservationMetric(metric:Metric) {
  if(draft.value.metricId!==metric.id){
    draft.value.value=''
    draft.value.unit=metric.defaultUnit
    draft.value.referenceLow=''
    draft.value.referenceHigh=''
    draft.value.referenceSource=''
  }
  draft.value.metricId=metric.id
  metricPickerOpen.value=false
  metricSearch.value=''
}
function openQuickMetric(){
  metricPickerOpen.value=false
  quickMetricOpen.value=true
  quickMetricError.value=''
  Object.assign(quickMetric,{name:metricSearch.value.trim(),valueType:'number',defaultUnit:''})
}
async function saveQuickMetric(){
  if(quickMetricSaving.value||saving.value)return
  const name=quickMetric.name.trim()
  if(!name){quickMetricError.value='请输入指标名称';return}
  if(!liveMode&&demo.metrics.some(metric=>metric.name.trim().toLocaleLowerCase()===name.toLocaleLowerCase())){
    quickMetricError.value='已有同名指标，请直接选择';return
  }
  quickMetricSaving.value=true;quickMetricError.value=''
  try{
    if(liveMode&&await metricNameExists(name)){quickMetricError.value='已有同名指标，请直接选择';return}
    const fields=encodeHealthFields('metric',{
      name,valueType:quickMetric.valueType,
      defaultUnit:quickMetric.valueType==='number'?quickMetric.defaultUnit:'',
      referenceLow:null,referenceHigh:null,referenceSource:'',
    },subjectPersonId.value)
    const record=liveMode
      ?await createHealthRecord<HealthRecord>(selectedSpaceId.value,'health_metric',fields)
      :({id:'demo-'+(++nextRecordId),version:1,...fields} as HealthRecord)
    const metric=decodeHealthRecord('metric',record) as Metric
    if(liveMode)invalidateHealth('metric')
    demo.metrics.unshift(metric)
    chooseObservationMetric(metric)
    quickMetricOpen.value=false
    quickMetric.name=''
  }catch(e){if(!optionDenied(e))quickMetricError.value=e instanceof Error?e.message:'指标创建失败'}
  finally{quickMetricSaving.value=false}
}
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
const noticeIsError=computed(()=>/失败|出错|错误|请先|无法|超时|未同步|未连接|拒绝|没有.*权限|不完整/.test(notice.value))
let noticeTimeout:ReturnType<typeof setTimeout>|undefined
watch(notice,(message)=>{
  if(noticeTimeout)clearTimeout(noticeTimeout)
  if(message)noticeTimeout=setTimeout(()=>{if(notice.value===message)notice.value=''},
    noticeIsError.value?7500:4200)
})
onBeforeUnmount(()=>{if(noticeTimeout)clearTimeout(noticeTimeout);cancelMetricDetail()})
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
const sectionKinds:Record<BodyTab,HealthKind[]>={
  focus:['concern'],metrics:['metric','observation'],
  timeline:['metric','observation','event','assessment'],
  documents:['document'],regimens:['regimen'],
}
const detailKinds:Record<HealthKind,HealthKind[]>={
  concern:['concern'],
  metric:['metric','observation'],
  observation:['observation','metric','document'],
  event:['event','document'],
  document:['document','observation','event'],
  regimen:['regimen','document'],
  assessment:['assessment','observation','document'],
}
const queryState=new HealthQueryState()
const readCoordinator=new HealthReadCoordinator()
let scopeGeneration=0
const scopeKey=(...parts:(string|number|null)[]):QueryKey=>[scopeGeneration,selectedSpaceId.value,subjectPersonId.value,...parts]
const readKey=(spaceId:string,...parts:(string|number|null)[]):QueryKey=>[scopeGeneration,spaceId,subjectPersonId.value,...parts]
const getHealthPage=(spaceId:string,model:Parameters<typeof apiPage>[1],params:URLSearchParams,signal?:AbortSignal)=>{
  const canonical=new URLSearchParams(params);canonical.sort()
  return readCoordinator.read(readKey(spaceId,'page',model,canonical.toString()),s=>apiPage(spaceId,model,canonical,s),signal)
}
const getMetricSummaries=(spaceId:string,ids:string[],signal?:AbortSignal)=>readCoordinator.read(readKey(spaceId,'summaries',...ids),s=>apiSummaries(spaceId,ids,s),signal)
const getSelectedHealthRecords=(spaceId:string,model:HealthModelKey,ids:string[],signal?:AbortSignal)=>readCoordinator.read(readKey(spaceId,'selected',model,...ids),s=>apiSelected(spaceId,model,ids,s),signal)
const getHealthSnapshot=(spaceId:string,models:HealthModelKey[],signal?:AbortSignal)=>readCoordinator.read(readKey(spaceId,'snapshot',...models),s=>apiSnapshot(spaceId,models,s),signal)
const listConcernRelations=(spaceId:string,id:string,signal?:AbortSignal)=>readCoordinator.read(readKey(spaceId,'relations',id),s=>apiRelations(spaceId,id,s),signal)
const pagedRefreshing=ref(false)
const viewRefreshing=ref(false)
const viewError=ref('')
const viewUpdatedAt=ref<number|null>(null)
const rebuildRequired=ref(false)
const viewStates=new HealthViewState<{search:string;timelineKind:TimelineFilter;metricFilter:MetricReferenceFilter;scroll:number;visibleLimit:number;trendRange:'1'|'3'|'5'|'all';mapView:BodyView;mapSelected:string|null;concernPages:Record<ConcernList,number>}>()
let restoringView=false
function invalidateHealth(...tags:QueryTag[]){
  queryState.invalidate(...tags)
  ++liveLoadSequence;++relationSequence
  cancelPage();cancelSnapshot();cancelMetricDetail();resetConcernReads()
}
function beginView(hit:{updatedAt:number}|undefined){
  viewError.value='';rebuildRequired.value=false;viewUpdatedAt.value=hit?.updatedAt??null
  liveStatus.value=hit?'ready':'loading';viewRefreshing.value=!!hit
}
function finishView(now=Date.now()){viewUpdatedAt.value=now;viewRefreshing.value=false;liveStatus.value='ready';liveMessage.value='已连接 LifeSpace'}
function failView(e:unknown,hasData:boolean){
  if(optionDenied(e))return
  viewError.value=(hasData?'更新失败，显示上次成功加载的数据：':'')+(e instanceof Error?e.message:'读取失败')
  viewRefreshing.value=false;liveStatus.value='ready'
}
let snapshotController:AbortController|null=null
function cancelSnapshot(){snapshotController?.abort();snapshotController=null}

const referenceMetrics=ref<Metric[]>([])
const referenceLatest=reactive(new Map<string,Observation>())
const referenceTerm=ref<string|null>(null)
const referenceError=ref('')
const metricSummariesReady=computed(()=>!liveMode||referenceTerm.value===search.value.trim())
function invalidateReferenceIndex(){referenceTerm.value=null;referenceMetrics.value=[];referenceLatest.clear();referenceError.value=''}
let metricHistoryController:AbortController|null=null
let metricTrendController:AbortController|null=null
const metricHistoryRows=ref<Observation[]>([])
const metricHistoryCursor=ref<string|null>(null)
const metricHistoryReady=ref(false)
const metricHistoryLoading=ref(false)
const metricHistoryError=ref('')
const metricTrendRows=ref<Observation[]>([])
const metricTrendLoading=ref(false)
const metricTrendReady=ref(false)
const metricTrendError=ref('')
const trendRange=ref<'1'|'3'|'5'|'all'>('3')
const metricDetailLatest=computed(()=>liveMode?metricHistoryRows.value[0]:latestFor(current.value?.id??''))
function cancelMetricDetail(){
  metricHistoryController?.abort();metricHistoryController=null
  metricTrendController?.abort();metricTrendController=null
  metricHistoryLoading.value=false;metricTrendLoading.value=false
}
function resetMetricDetail(){
  cancelMetricDetail()
  metricHistoryRows.value=[];metricHistoryCursor.value=null;metricHistoryReady.value=false;metricHistoryError.value=''
  metricTrendRows.value=[];metricTrendError.value='';metricTrendReady.value=false
}
function trendDateWindow(date:string,range:typeof trendRange.value){
  if(range==='all')return {}
  const end=new Date(date+'T00:00:00Z')
  if(!Number.isFinite(end.getTime()))throw Error('最新观测日期无效')
  const start=new Date(end);start.setUTCFullYear(start.getUTCFullYear()-Number(range))
  return {from:start.toISOString().slice(0,10),to:date}
}
const trendWindowLabel=computed(()=>{
  const date=metricDetailLatest.value?.observedDate
  if(trendRange.value==='all'||!date)return '全部历史'
  try{const window=trendDateWindow(date,trendRange.value);return window.from+' 至 '+window.to}catch{return '日期范围无效'}
})
type PagedSection='metrics'|'documents'|'regimens'
const pagedSectionKind={metrics:'metric',documents:'document',regimens:'regimen'} as const
const metricPageLatest=reactive(new Map<string,Observation>())
const metricPageReady=reactive(new Set<string>())
const metricSummaryError=ref('')
const metricSummaryLoading=ref(false)
const pagedIds=ref<string[]>([])
const pagedCursor=ref<string|null>(null)
let pagedPageCount=0
const pagedLoadingMore=ref(false)
const pagedError=ref('')
const timelineEntries=ref<TimelineEntry[]>([])
const timelineMore=ref(false)
const timelineLoading=ref(false)
const timelineError=ref('')
let timelineStreams:TimelineStream[]=[]
let timelineRounds=0
let pageController:AbortController|null=null
let pageSearchTimer:ReturnType<typeof setTimeout>|undefined
const isPagedSection=(section:string):section is PagedSection=>section==='metrics'||section==='documents'||section==='regimens'
const usesPagedSection=(section:string):section is PagedSection=>isPagedSection(section)&&(section!=='metrics'||metricReferenceFilter.value==='all')
function selectMetricReferenceFilter(filter:MetricReferenceFilter){
  if(metricReferenceFilter.value===filter)return
  metricReferenceFilter.value=filter
  if(liveMode)void loadLiveRecords('metrics')
}
function cancelPage(){
  pageController?.abort();pageController=null
  if(pageSearchTimer!==undefined){clearTimeout(pageSearchTimer);pageSearchTimer=undefined}
  pagedLoadingMore.value=false;metricSummaryLoading.value=false;pagedRefreshing.value=false;timelineLoading.value=false;viewRefreshing.value=false
}
onBeforeUnmount(()=>{cancelPage();cancelSnapshot();queryState.clear();viewStates.clear();readCoordinator.clear()})
watch(search,()=>{
  if(restoringView||!liveMode||selected.value||(!usesPagedSection(bodyTab.value)&&bodyTab.value!=='timeline'&&bodyTab.value!=='metrics')||activeTab.value!=='body')return
  cancelPage()
  ++liveLoadSequence
  pagedIds.value=[];pagedCursor.value=null;pagedError.value='';metricPageLatest.clear();metricPageReady.clear();metricSummaryError.value=''
  liveStatus.value='loading'
  pageSearchTimer=setTimeout(()=>{pageSearchTimer=undefined;if(bodyTab.value==='timeline')void loadTimeline();else if(bodyTab.value==='metrics'&&metricReferenceFilter.value!=='all')void loadReferenceIndex();else void loadPagedSection(bodyTab.value as PagedSection)},250)
},{flush:'sync'})
const concernLinks=ref<ConcernRelation[]>([])
const relationLoading=ref(false)
const relationReadState=ref<'idle'|'loading'|'ready'|'error'>('idle')
const relationReadError=ref('')
const concernContent=computed(()=>concernContentState(liveMode,liveStatus.value,relationReadState.value))
const metricVisibleLimit=ref(40)
watch([search,metricReferenceFilter],()=>{metricVisibleLimit.value=40})
const relationBusy=ref(false)
const relationError=ref('')
const relationKind=ref<ConcernTargetKind>('metric')
const relationTargetId=ref('')
type ConcernCard='status'|'regimens'|'events'|'evidence'
type ConcernList='metrics'|'observations'|'regimens'|'events'|'evidence'
const activeRelationCard=ref<ConcernCard|null>(null)
type CardReadState='idle'|'loading'|'ready'|'error'
const concernReads=reactive<Record<ConcernList,CardReadState>>({metrics:'idle',observations:'idle',regimens:'idle',events:'idle',evidence:'idle'})
const concernReadErrors=reactive<Record<ConcernList,string>>({metrics:'',observations:'',regimens:'',events:'',evidence:''})
const concernMetricDates=reactive(new Map<string,string>())
let concernAbort:AbortController|null=null
const concernGroupKinds:Record<ConcernList,ConcernTargetKind[]>={metrics:['metric'],observations:['observation'],regimens:['regimen'],events:['event'],evidence:['document','assessment']}
function concernSectionState(key:ConcernList){
  if(!liveMode)return 'ready'
  if(concernContent.value==='error'||concernReads[key]==='error')return 'error'
  return concernContent.value==='ready'&&concernReads[key]==='ready'?'ready':'loading'
}
function resetConcernReads(){
  concernAbort?.abort();concernAbort=null
  concernMetricDates.clear()
  for(const key of Object.keys(concernReads) as ConcernList[]){concernReads[key]='idle';concernReadErrors[key]=''}
}
onBeforeUnmount(resetConcernReads)
function mergeHealthRecords(kind:HealthKind,records:HealthRecord[]){
  const rows=getList(kind)
  for(const raw of records){
    const decoded=decodeHealthRecord(kind,raw),index=rows.findIndex(row=>row.id===decoded.id)
    if(index===-1)rows.push(decoded);else rows.splice(index,1,decoded)
  }
}
function assertOwnScope(personId:string){
  if(!personId||subjectPersonId.value&&personId!==subjectPersonId.value)throw new HealthApiError(403,null)
  subjectPersonId.value=personId
}
async function readSelectedRows(spaceId:string,kind:HealthKind,ids:string[],signal:AbortSignal,valid:()=>boolean){
  const unique=[...new Set(ids.filter(Boolean))]
  const records:HealthRecord[]=[]
  for(let offset=0;offset<unique.length;offset+=12){
    if(!valid()||signal.aborted)return []
    const batch=unique.slice(offset,offset+12)
    const result=await getSelectedHealthRecords(spaceId,healthModelKey[kind],batch,signal)
    if(!valid()||signal.aborted)return []
    assertOwnScope(result.personId)
    if(!Array.isArray(result.items)||result.items.length!==batch.length||
       result.items.some((item,index)=>item.id!==batch[index]))throw Error('关联记录响应不完整')
    records.push(...result.items)
  }
  if(valid()&&!signal.aborted)mergeHealthRecords(kind,records)
  return records
}
async function loadConcernGroup(key:ConcernList,spaceId:string,version:number,signal:AbortSignal){
  const valid=()=>version===relationSequence&&spaceId===selectedSpaceId.value&&!signal.aborted&&selected.value?.kind==='concern'
  concernReads[key]='loading';concernReadErrors[key]=''
  try{
    for(const kind of concernGroupKinds[key]){
      const ids=concernLinks.value.filter(edge=>edge.target.modelKey===concernTargetModels[kind]).map(edge=>edge.target.recordId)
      const records=await readSelectedRows(spaceId,kind,ids,signal,valid)
      if(!valid())return
      if(kind==='observation')await readSelectedRows(spaceId,'metric',records.map(record=>String(record.metricId??'')),signal,valid)
      if(kind==='metric'){
        for(let offset=0;offset<ids.length;offset+=METRIC_PAGE_SIZE){
          if(!valid())return
          const summary=await getMetricSummaries(spaceId,ids.slice(offset,offset+METRIC_PAGE_SIZE),signal)
          if(!valid())return
          assertOwnScope(summary.personId)
          for(const row of summary.items)concernMetricDates.set(String(row.metricId),String(row.observedDate))
        }
      }
    }
    if(valid())concernReads[key]='ready'
  }catch(e){
    if(!valid())return
    if(e instanceof HealthApiError&&[401,403].includes(e.status)){
      clearLiveRecords();subjectPersonId.value='';liveStatus.value='error';liveMessage.value=e.message;return
    }
    concernReads[key]='error';concernReadErrors[key]=e instanceof Error?e.message:'关联记录读取失败'
  }
}
function retryConcernGroup(key:ConcernList){
  if(relationReadState.value!=='ready'||!concernAbort||!selectedSpaceId.value){
    if(selected.value?.kind==='concern')void refreshConcernLinks(selected.value.id)
    return
  }
  void loadConcernGroup(key,selectedSpaceId.value,relationSequence,concernAbort.signal)
}
const concernPage=reactive<Record<ConcernList,number>>({
  metrics:0,observations:0,regimens:0,events:0,evidence:0,
})
const relationKindForCard:Record<ConcernCard,ConcernTargetKind[]>={
  status:['metric','observation'],regimens:['regimen'],
  events:['event'],evidence:['document','assessment'],
}
function toggleRelationCard(card:ConcernCard){
  if(activeRelationCard.value===card){activeRelationCard.value=null;return}
  activeRelationCard.value=card
  relationKind.value=relationKindForCard[card][0]!
  relationTargetId.value=''
  relationError.value=''
}
function resetConcernPages(){
  resetConcernReads();cancelRelationOptions()
  for(const key of Object.keys(concernPage) as ConcernList[])concernPage[key]=0
  activeRelationCard.value=null
  relationTargetId.value=''
}
function gotoConcernPage(kind:ConcernList,delta:number,total:number){
  concernPage[kind]=Math.min(pageCount(total)-1,Math.max(0,concernPage[kind]+delta))
}
let relationSequence=0
let liveLoadSequence=0
function clearLiveRecords() {
  ++liveLoadSequence
  resetMetricDetail();resetDocumentRelated()
  cancelPage();pagedIds.value=[];pagedCursor.value=null;pagedError.value='';metricPageLatest.clear();metricPageReady.clear();metricSummaryError.value=''
  ++relationSequence
  resetConcernReads();cancelRelationOptions()
  concernLinks.value=[]
  relationLoading.value=false
  relationReadState.value='idle';relationReadError.value=''
  relationError.value=''
  relationTargetId.value=''
  ++scopeGeneration;queryState.clear();viewStates.clear();readCoordinator.clear();cancelSnapshot();cancelFormChoices();cancelFormOptions();viewError.value='';viewUpdatedAt.value=null;viewRefreshing.value=false;rebuildRequired.value=false
  timelineEntries.value=[];timelineStreams=[];timelineMore.value=false;timelineError.value='';invalidateReferenceIndex()
  for(const kind of healthKinds) getList(kind).splice(0)
  // Never retain another Space/Person's coordinates or attention when switching.
  bodyBindings.value=[]
  attentionByConcern.value={}
  mapSelectedConcern.value=null
  selected.value=null;sheet.value='';draft.value={};editId.value='';formError.value='';uploadFile.value=null;uploadProgress.value=null
  quickMetricOpen.value=false;quickMetric.name='';metricSearch.value='';formReferenceOpen.value=false
  activeRelationCard.value=null;relationOptionIds.value=[];formChoiceIds.value=[]
  routeStack.value=[]
}
type ListProjection={ids:string[];cursor:string|null;latest:[string,Observation][];ready:string[];pages:number}
const listKey=(section:PagedSection)=>scopeKey('list',section,search.value.trim())
function applyList(projection:ListProjection){
  pagedIds.value=projection.ids;pagedCursor.value=projection.cursor;pagedPageCount=projection.pages
  metricPageLatest.clear();metricPageReady.clear()
  for(const [id,row] of projection.latest)metricPageLatest.set(id,row)
  for(const id of projection.ready)metricPageReady.add(id)
}
function listProjection():ListProjection{return {ids:[...pagedIds.value],cursor:pagedCursor.value,latest:[...metricPageLatest],ready:[...metricPageReady],pages:pagedPageCount}}
async function loadPagedSection(section:PagedSection,more=false,force=false,rebuild=false){
  if(!selectedSpaceId.value||more&&(!pagedCursor.value||pagedLoadingMore.value||pagedRefreshing.value||metricSummaryLoading.value||metricSummaryError.value))return
  cancelPage();cancelSnapshot();cancelMetricDetail()
  const spaceId=selectedSpaceId.value,requestId=++liveLoadSequence,term=search.value.trim(),kind=pagedSectionKind[section]
  const controller=new AbortController();pageController=controller
  const valid=()=>requestId===liveLoadSequence&&spaceId===selectedSpaceId.value&&!controller.signal.aborted
  const hit=queryState.get<ListProjection>(listKey(section))
  const previous=more?listProjection():hit?.data
  pagedError.value='';metricSummaryError.value=''
  if(!more){
    applyList(previous??{ids:[],cursor:null,latest:[],ready:[],pages:0})
    beginView(hit)
    if(hit?.fresh&&!force){finishView(hit.updatedAt);pageController=null;return}
    if(!rebuild&&previous&&previous.pages>HEALTH_REFRESH_PAGES){rebuildRequired.value=true;viewRefreshing.value=false;pageController=null;return}
    pagedRefreshing.value=!!previous
  }else pagedLoadingMore.value=true
  const pages=more||rebuild?1:Math.max(1,previous?.pages??1)
  const model=kind==='metric'?'health_metric':kind==='document'?'health_document':'health_regimen'
  const tags:QueryTag[]=kind==='metric'?['metric','observation']:[kind]
  try{
    const window=await rebuildCursorWindow(pages,async cursor=>{
      const params=new URLSearchParams({limit:String(kind==='metric'?METRIC_PAGE_SIZE:40)})
      if(term)params.set('search',term)
      if(cursor)params.set('cursor',cursor)
      const page=await getHealthPage(spaceId,model,params,controller.signal)
      if(!valid())throw Error('请求已取消')
      assertOwnScope(page.personId)
      if(!Array.isArray(page.items))throw Error('健康档案响应不完整')
      return page
    },more?previous?.cursor??null:null)
    if(!valid())return
    const ids=[...new Set(window.items.map(row=>row.id))]
    const latest=new Map(more?previous?.latest:[])
    const ready=new Set(more?previous?.ready:[])
    const projection:ListProjection={ids:[...new Set([...(more?previous?.ids??[]:[]),...ids])],cursor:window.cursor,latest:[],ready:[],pages:(more?previous?.pages??0:0)+window.pages}
    if(!previous||more){mergeHealthRecords(kind,window.items);applyList({...projection,latest:[...latest],ready:[...ready]});liveStatus.value='ready'}
    if(kind==='metric'&&ids.length){
      metricSummaryLoading.value=true
      for(let offset=0;offset<ids.length;offset+=METRIC_PAGE_SIZE){
        const batch=ids.slice(offset,offset+METRIC_PAGE_SIZE)
        const summary=await getMetricSummaries(spaceId,batch,controller.signal)
        if(!valid())return
        assertOwnScope(summary.personId)
        if(!Array.isArray(summary.items))throw Error('健康指标摘要响应不完整')
        for(const id of batch){latest.delete(id);ready.add(id)}
        for(const raw of summary.items){const row=decodeHealthRecord('observation',raw) as Observation;latest.set(row.metricId,row)}
      }
    }
    if(!valid())return
    mergeHealthRecords(kind,window.items)
    projection.latest=[...latest];projection.ready=[...ready]
    applyList(projection)
    const now=Date.now(),updatedAt=more?hit?.updatedAt??viewUpdatedAt.value??now:now
    queryState.set(listKey(section),projection,tags,projection.ids.length+projection.latest.length,now,updatedAt)
    finishView(updatedAt)
  }catch(e){
    if(!valid()||optionDenied(e))return
    if(!more&&previous){applyList(previous);failView(e,true)}
    else if(kind==='metric'&&metricSummaryLoading.value){metricSummaryError.value=e instanceof Error?e.message:'指标摘要读取失败';liveStatus.value='ready'}
    else{pagedError.value=e instanceof Error?e.message:'列表读取失败';liveStatus.value='ready'}
  }finally{if(valid()){pagedLoadingMore.value=false;metricSummaryLoading.value=false;pagedRefreshing.value=false;viewRefreshing.value=false;pageController=null}}
}
type TimelineProjection={entries:TimelineEntry[];streams:TimelineStream[];more:boolean;rounds:number}
function timelineKey(){return scopeKey('timeline',timelineKind.value,search.value.trim(),Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC')}
function applyTimeline(p:TimelineProjection){timelineEntries.value=p.entries;timelineStreams=p.streams;timelineMore.value=p.more;timelineRounds=p.rounds}
async function loadTimeline(more=false,force=false,rebuild=false){
  if(!selectedSpaceId.value||more&&(!timelineMore.value||timelineLoading.value))return
  cancelPage();cancelSnapshot();cancelMetricDetail()
  const controller=new AbortController();pageController=controller
  const spaceId=selectedSpaceId.value,requestId=++liveLoadSequence
  const valid=()=>requestId===liveLoadSequence&&spaceId===selectedSpaceId.value&&!controller.signal.aborted
  const hit=queryState.get<TimelineProjection>(timelineKey())
  const previous=more?{entries:timelineEntries.value,streams:timelineStreams,more:timelineMore.value,rounds:timelineRounds}:hit?.data
  if(!more){
    applyTimeline(previous??{entries:[],streams:newTimelineStreams(timelineKind.value),more:false,rounds:0})
    beginView(hit)
    if(hit?.fresh&&!force){finishView(hit.updatedAt);pageController=null;return}
    if(!rebuild&&previous&&previous.rounds>HEALTH_REFRESH_PAGES){rebuildRequired.value=true;viewRefreshing.value=false;pageController=null;return}
  }
  timelineLoading.value=true;timelineError.value=''
  const term=search.value.trim(),timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'
  try{
    let entries=more?[...timelineEntries.value]:[],streams=more?timelineStreams:newTimelineStreams(timelineKind.value)
    let rounds=more?timelineRounds:0,hasMore=true
    const count=more||rebuild?1:Math.max(1,previous?.rounds??1)
    for(let i=0;i<count&&hasMore;i++){
      const result=await mergeTimelinePage(streams,async(kind:TimelineKind,cursor:string|null)=>{
        if(!valid())throw Error('请求已取消')
        const params=new URLSearchParams({limit:'30'})
        if(cursor)params.set('cursor',cursor)
        if(kind==='observation')params.set('view','timeline')
        if(kind==='event')params.set('timezone',timezone)
        const model=kind==='observation'?'health_observation':kind==='event'?'health_event':'health_assessment'
        const page=await getHealthPage(spaceId,model,params,controller.signal)
        if(!valid())throw Error('请求已取消')
        assertOwnScope(page.personId)
        if(kind==='observation')await readSelectedRows(spaceId,'metric',page.items.map(row=>String(row.metricId??'')).filter(id=>!demo.metrics.some(metric=>metric.id===id)),controller.signal,valid)
        if(!valid())throw Error('请求已取消')
        mergeHealthRecords(kind,page.items)
        const items=page.items.map(raw=>{
          if(kind==='observation'){const o=decodeHealthRecord(kind,raw) as Observation;return {id:o.id,kind,date:o.observedDate,title:observationTitle(o),meta:'测量记录'}}
          const row=getList(kind).find(item=>item.id===raw.id)!
          return kind==='event'?{id:row.id,kind,date:row.date,title:row.summary,meta:eventName(row)+(row.timeStart?' · '+row.timeStart:'')}:{id:row.id,kind,date:row.assessedDate,title:row.title,meta:'评估记录'}
        })
        return {items,nextCursor:page.nextCursor}
      },term,new Set(entries.map(row=>row.kind+':'+row.id)))
      if(!valid())return
      streams=result.streams;hasMore=result.hasMore;entries.push(...result.items);rounds++
    }
    const projection={entries,streams,more:hasMore,rounds}
    applyTimeline(projection)
    const now=Date.now(),updatedAt=more?hit?.updatedAt??viewUpdatedAt.value??now:now
    queryState.set(timelineKey(),projection,['observation','event','assessment','metric'],entries.length+streams.reduce((n,x)=>n+x.buffer.length,0),now,updatedAt)
    finishView(updatedAt)
  }catch(e){
    if(!valid()||optionDenied(e))return
    if(!more&&previous)failView(e,true)
    else{timelineError.value=e instanceof Error?e.message:'时间线加载失败';liveStatus.value='ready'}
  }finally{if(valid()){timelineLoading.value=false;viewRefreshing.value=false;pageController=null}}
}
function changeTimelineKind(kind:TimelineFilter){
  if(timelineKind.value===kind)return
  timelineKind.value=kind
  if(liveMode)void loadTimeline()
}
type ReferenceProjection={metrics:Metric[];latest:[string,Observation][]}
async function loadReferenceIndex(force=false){
  if(!selectedSpaceId.value)return
  cancelPage();cancelSnapshot()
  cancelMetricDetail()
  const spaceId=selectedSpaceId.value,term=search.value.trim(),requestId=++liveLoadSequence
  pagedError.value='';pagedCursor.value=null;metricSummaryError.value=''
  const key=scopeKey('reference',term),hit=queryState.get<ReferenceProjection>(key)
  invalidateReferenceIndex()
  if(hit){referenceMetrics.value=hit.data.metrics;for(const [id,row] of hit.data.latest)referenceLatest.set(id,row);referenceTerm.value=term}
  beginView(hit)
  if(hit?.fresh&&!force){finishView(hit.updatedAt);return}
  const controller=new AbortController();pageController=controller
  const valid=()=>requestId===liveLoadSequence&&spaceId===selectedSpaceId.value&&!controller.signal.aborted
  try{
    const metrics:Metric[]=[],latest=new Map<string,Observation>()
    let cursor:string|null=null
    for(let pageIndex=0;pageIndex<40;pageIndex++){
      if(!valid())return
      const params=new URLSearchParams({limit:'50'})
      if(term)params.set('search',term)
      if(cursor)params.set('cursor',cursor)
      const page=await getHealthPage(spaceId,'health_metric',params,controller.signal)
      if(!valid())return
      assertOwnScope(page.personId)
      const rows=page.items.map(row=>decodeHealthRecord('metric',row) as Metric)
      metrics.push(...rows)
      // At most three scoped summary requests per 50-metric page, never the
      // global observation snapshot. Keep exact counts hidden until complete.
      const groups:string[][]=[]
      for(let i=0;i<rows.length;i+=METRIC_PAGE_SIZE)groups.push(rows.slice(i,i+METRIC_PAGE_SIZE).map(row=>row.id))
      const summaries=await Promise.all(groups.map(ids=>getMetricSummaries(spaceId,ids,controller.signal)))
      if(!valid())return
      for(const summary of summaries){
        assertOwnScope(summary.personId)
        for(const raw of summary.items){const row=decodeHealthRecord('observation',raw) as Observation;latest.set(row.metricId,row)}
      }
      mergeHealthRecords('metric',page.items)
      cursor=page.nextCursor
      if(!cursor)break
    }
    if(cursor)throw Error('指标数量超过本次完整统计上限，请缩小搜索范围')
    if(!valid())return
    referenceMetrics.value=[...new Map(metrics.map(metric=>[metric.id,metric])).values()]
    referenceLatest.clear()
    for(const [id,row] of latest)referenceLatest.set(id,row)
    referenceTerm.value=term
    queryState.set(scopeKey('reference',term),{metrics:referenceMetrics.value,latest:[...referenceLatest]},['metric','observation'],referenceMetrics.value.length+referenceLatest.size)
    finishView()
  }catch(e){
    if(!valid())return
    if(optionDenied(e))return
    if(hit)failView(e,true);else{referenceError.value=e instanceof Error?e.message:'参考范围统计失败';liveStatus.value='ready'}
  }finally{if(valid()){pageController=null;viewRefreshing.value=false}}
}
async function loadMetricTrend(metricId:string){
  metricTrendController?.abort()
  const controller=new AbortController();metricTrendController=controller
  const spaceId=selectedSpaceId.value,version=liveLoadSequence,range=trendRange.value
  const valid=()=>version===liveLoadSequence&&spaceId===selectedSpaceId.value&&selected.value?.kind==='metric'&&selected.value.id===metricId&&!controller.signal.aborted
  metricTrendRows.value=[];metricTrendError.value='';metricTrendReady.value=false;metricTrendLoading.value=true
  try{
    const latest=metricHistoryRows.value[0]
    if(!metricHistoryReady.value)throw Error('请先加载最新测量')
    if(!latest){metricTrendReady.value=true;return}
    const window=trendDateWindow(latest.observedDate,range)
    // A completed history page is a valid complete source for the selected window.
    if(metricHistoryCursor.value===null){
      metricTrendRows.value=metricHistoryRows.value.filter(row=>!window.from||row.observedDate>=window.from)
      metricTrendReady.value=true;return
    }
    let cursor:string|null=null
    const rows:Observation[]=[]
    for(let i=0;i<40;i++){
      const params=new URLSearchParams({limit:'50',metricId,...window})
      if(cursor)params.set('cursor',cursor)
      const page=await getHealthPage(spaceId,'health_observation',params,controller.signal)
      if(!valid())return
      assertOwnScope(page.personId)
      rows.push(...page.items.map(raw=>decodeHealthRecord('observation',raw) as Observation))
      mergeHealthRecords('observation',page.items)
      cursor=page.nextCursor
      if(!cursor)break
    }
    if(cursor)throw Error('该时间范围记录较多，请缩短趋势时间范围')
    if(valid()){metricTrendRows.value=[...new Map(rows.map(row=>[row.id,row])).values()];metricTrendReady.value=true}
  }catch(e){
    if(!valid()||optionDenied(e))return
    metricTrendError.value=e instanceof Error?e.message:'趋势读取失败'
  }finally{if(valid()){metricTrendLoading.value=false;metricTrendController=null}}
}
async function loadMetricHistory(metricId:string,more=false){
  if(!selectedSpaceId.value||more&&(!metricHistoryCursor.value||metricHistoryLoading.value))return
  metricHistoryController?.abort()
  const controller=new AbortController();metricHistoryController=controller
  const spaceId=selectedSpaceId.value,version=liveLoadSequence
  const valid=()=>version===liveLoadSequence&&spaceId===selectedSpaceId.value&&selected.value?.kind==='metric'&&selected.value.id===metricId&&!controller.signal.aborted
  if(!more){metricHistoryReady.value=false;metricHistoryRows.value=[];metricHistoryCursor.value=null;metricTrendRows.value=[];metricTrendError.value='';metricTrendReady.value=false}
  metricHistoryLoading.value=true;metricHistoryError.value=''
  try{
    const params=new URLSearchParams({limit:'30',metricId})
    if(more&&metricHistoryCursor.value)params.set('cursor',metricHistoryCursor.value)
    const page=await getHealthPage(spaceId,'health_observation',params,controller.signal)
    if(!valid())return
    assertOwnScope(page.personId)
    const rows=page.items.map(raw=>decodeHealthRecord('observation',raw) as Observation)
    mergeHealthRecords('observation',page.items)
    metricHistoryRows.value=[...new Map([...metricHistoryRows.value,...rows].map(row=>[row.id,row])).values()]
    metricHistoryCursor.value=page.nextCursor;metricHistoryReady.value=true
  }catch(e){
    if(!valid()||optionDenied(e))return
    metricHistoryError.value=e instanceof Error?e.message:'历史记录读取失败'
  }finally{if(valid()){metricHistoryLoading.value=false;metricHistoryController=null}}
}
async function retryMetricHistory(metricId:string){
  const more=metricHistoryReady.value&&!!metricHistoryCursor.value
  await loadMetricHistory(metricId,more)
  if(!more&&metricHistoryReady.value&&selected.value?.id===metricId&&current.value?.valueType==='number')void loadMetricTrend(metricId)
}
function changeTrendRange(){
  if(selected.value?.kind==='metric'&&metricHistoryReady.value)void loadMetricTrend(selected.value.id)
}
async function loadMetricDetail(metricId:string){
  cancelPage();cancelSnapshot();resetMetricDetail()
  const spaceId=selectedSpaceId.value,version=++liveLoadSequence
  const controller=new AbortController();snapshotController=controller
  const valid=()=>version===liveLoadSequence&&spaceId===selectedSpaceId.value&&selected.value?.kind==='metric'&&selected.value.id===metricId&&!controller.signal.aborted
  liveStatus.value=current.value?'ready':'loading'
  try{
    const header=readSelectedRows(spaceId,'metric',[metricId],controller.signal,valid).then(()=>{
      if(valid()){liveStatus.value='ready';liveMessage.value='已连接 LifeSpace'}
    })
    await Promise.all([header,loadMetricHistory(metricId)])
    if(valid()&&metricHistoryReady.value&&current.value?.valueType==='number')void loadMetricTrend(metricId)
  }catch(e){
    if(!valid()||optionDenied(e))return
    cancelMetricDetail()
    liveStatus.value='error';liveMessage.value=e instanceof Error?e.message:'指标读取失败'
  }finally{if(valid())snapshotController=null}
}
const documentRelatedState=ref<'idle'|'loading'|'ready'|'error'>('idle')
const documentRelatedError=ref('')
const documentRelatedIds=ref<string[]>([])
let documentRelatedController:AbortController|null=null
function resetDocumentRelated(){
  documentRelatedController?.abort();documentRelatedController=null
  documentRelatedState.value='idle';documentRelatedError.value='';documentRelatedIds.value=[]
}
onBeforeUnmount(resetDocumentRelated)
async function loadDocumentRelated(id:string){
  if(!selectedSpaceId.value||documentRelatedState.value==='loading')return
  resetDocumentRelated()
  const controller=new AbortController();documentRelatedController=controller
  const spaceId=selectedSpaceId.value,version=liveLoadSequence
  const valid=()=>version===liveLoadSequence&&spaceId===selectedSpaceId.value&&selected.value?.kind==='document'&&selected.value.id===id&&!controller.signal.aborted
  documentRelatedState.value='loading'
  try{
    // The candidate contract does not declare sourceDocumentId filterable.
    // Preserve exact inverse-link semantics; defer this collection read.
    const snapshot=await getHealthSnapshot(spaceId,['health_observation'],controller.signal)
    if(!valid())return
    assertOwnScope(snapshot.personId)
    if(!Array.isArray(snapshot.models.health_observation))throw Error('关联测量响应不完整')
    const records=snapshot.models.health_observation.filter(record=>record.sourceDocumentId===id)
    await readSelectedRows(spaceId,'metric',records.map(record=>String(record.metricId??'')).filter(metricId=>!demo.metrics.some(metric=>metric.id===metricId)),controller.signal,valid)
    if(!valid())return
    mergeHealthRecords('observation',records)
    documentRelatedIds.value=records.map(record=>record.id)
    documentRelatedState.value='ready'
  }catch(e){
    if(!valid()||optionDenied(e))return
    documentRelatedState.value='error';documentRelatedError.value=e instanceof Error?e.message:'关联测量读取失败'
  }finally{if(valid())documentRelatedController=null}
}
const documentRelatedRows=computed(()=>liveMode?documentRelatedIds.value.map(id=>demo.observations.find(row=>row.id===id)).filter((row):row is Observation=>!!row):demo.observations.filter(row=>row.sourceDocumentId===current.value?.id))
async function loadSelectedDetail(kind:'observation'|'regimen'|'assessment'|'event'|'document',id:string){
  cancelPage();cancelSnapshot();cancelMetricDetail();resetDocumentRelated()
  const spaceId=selectedSpaceId.value,version=++liveLoadSequence
  const controller=new AbortController();snapshotController=controller
  const valid=()=>version===liveLoadSequence&&spaceId===selectedSpaceId.value&&selected.value?.kind===kind&&selected.value.id===id&&!controller.signal.aborted
  liveStatus.value='loading'
  try{
    const records=await readSelectedRows(spaceId,kind,[id],controller.signal,valid)
    if(!valid())return
    const row=records[0]
    if(!row)throw Error('记录读取失败')
    await Promise.all([
      kind==='observation'?readSelectedRows(spaceId,'metric',[String(row.metricId??'')],controller.signal,valid):Promise.resolve([]),
      kind==='observation'||kind==='regimen'?readSelectedRows(spaceId,'document',[String(row.sourceDocumentId??'')],controller.signal,valid):Promise.resolve([]),
      kind==='document'?readSelectedRows(spaceId,'event',[String(row.eventId??'')],controller.signal,valid):Promise.resolve([]),
    ])
    if(valid()){liveStatus.value='ready';liveMessage.value='已连接 LifeSpace'}
  }catch(e){if(valid()&&!optionDenied(e)){liveStatus.value='error';liveMessage.value=e instanceof Error?e.message:'记录读取失败'}}
  finally{if(valid())snapshotController=null}
}
async function loadLiveRecords(section:BodyTab|'detail'='focus',force=false,rebuild=false) {
  if(!selectedSpaceId.value)return
  cancelSnapshot()
  if(section==='timeline'){await loadTimeline(false,force,rebuild);return}
  if(section==='detail'&&selected.value?.kind==='metric'){await loadMetricDetail(selected.value.id);return}
  if(section==='detail'&&selected.value&&['observation','regimen','assessment','event','document'].includes(selected.value.kind)){
    await loadSelectedDetail(selected.value.kind as 'observation'|'regimen'|'assessment'|'event'|'document',selected.value.id);return
  }
  if(section==='metrics'&&metricReferenceFilter.value!=='all'){await loadReferenceIndex(force);return}
  if(usesPagedSection(section)){await loadPagedSection(section,false,force,rebuild);return}
  cancelPage();cancelMetricDetail()
  const hit=queryState.get<HealthSnapshot>(scopeKey('focus'))
  const apply=(snapshot:HealthSnapshot)=>{
    assertOwnScope(snapshot.personId)
    const records=snapshot.models?.health_concern
    if(!Array.isArray(records)||!Array.isArray(snapshot.presentation?.items))throw Error('健康关注响应不完整')
    demo.concerns.splice(0,demo.concerns.length,...records.map(record=>decodeHealthRecord('concern',record) as typeof demo.concerns[number]))
    const ids=new Set(demo.concerns.map(c=>c.id))
    const items=snapshot.presentation.items.filter(p=>ids.has(p.concernId))
    attentionByConcern.value=Object.fromEntries(items.map(p=>[p.concernId,p.attention]))
    bodyBindings.value=items.filter(p=>p.placement!==null).map(p=>p.placement!)
  }
  beginView(hit)
  if(hit){apply(hit.data);if(hit.fresh&&!force){finishView(hit.updatedAt);return}}
  const spaceId=selectedSpaceId.value,requestId=++liveLoadSequence
  const controller=new AbortController();snapshotController=controller
  const valid=()=>requestId===liveLoadSequence&&spaceId===selectedSpaceId.value&&!controller.signal.aborted
  try{
    const snapshot=await getHealthSnapshot(spaceId,['health_concern'],controller.signal)
    if(!valid())return
    apply(snapshot)
    queryState.set(scopeKey('focus'),snapshot,['concern','presentation'],snapshot.models.health_concern?.length??1)
    finishView()
  }catch(e){if(valid())failView(e,!!hit)}
  finally{if(valid()){snapshotController=null;viewRefreshing.value=false}}
}
async function chooseLiveSpace(spaceId:string) {
  clearLiveRecords()
  subjectPersonId.value=''
  if(!liveSpaces.value.some(s=>s.id===spaceId)) {
    selectedSpaceId.value='';liveStatus.value='error';liveMessage.value='当前空间无权访问，请到应用设置重新选择';return
  }
  selectedSpaceId.value=spaceId
  await loadLiveRecords(bodyTab.value)
}
async function initializeLive() {
  clearLiveRecords();selectedSpaceId.value='';subjectPersonId.value='';liveSpaces.value=[]
  liveStatus.value='loading'; liveMessage.value='正在验证访问权限…'
  try {
    const view=await getAlohaWorkspace()
    liveSpaces.value=view.spaces
    const stored=selectedAuthorizedHealthSpace(view)
    if(!stored){
      if(view.status==='creating'){
        liveStatus.value='error';liveMessage.value='专属空间正在创建，请重新检查或进入应用设置查看。';return
      }
      // No browser storage and no fallback to an arbitrary current Space.
      window.location.replace(hubSettingsUrl)
      return
    }
    await chooseLiveSpace(stored)
  } catch(e) {
    liveStatus.value='error';liveMessage.value=e instanceof Error?e.message:'无法连接 LifeSpace'
  }
}
async function loadHubProfile(){
  try {hubProfile.value=await getAlohaUserProfile()}
  catch {hubProfile.value=null} // no synthetic identity or stale profile
}
let hiddenAt=0
function onHealthVisibility(){
  if(document.visibilityState==='hidden'){hiddenAt=Date.now();return}
  if(!liveMode||!hiddenAt||Date.now()-hiddenAt<60_000)return
  hiddenAt=0
  if(activeTab.value==='body'&&!sheet.value&&!saving.value&&liveStatus.value==='ready'&&selectedSpaceId.value){
    void loadLiveRecords(selected.value?'detail':bodyTab.value)
    if(selected.value?.kind==='concern')void refreshConcernLinks(selected.value.id)
  }
}
onBeforeUnmount(()=>document.removeEventListener('visibilitychange',onHealthVisibility))
onMounted(()=>{
  document.addEventListener('visibilitychange',onHealthVisibility)
  if(liveMode){void initializeLive();void loadHubProfile()}
})
const current = computed<any | null>(() => selected.value ? getList(selected.value.kind).find(item=>item.id===selected.value?.id) ?? null : null)
const selectedConcern = computed(() => selected.value?.kind === 'concern' ? selected.value.id : '')
const related = (record: {concernIds?:string[]},id:string) => (record.concernIds ?? []).includes(id)
const activeConcerns = computed(() => demo.concerns.filter(c=>c.status==='active'))
const latestObservations=computed(()=>latestObservationIndex(demo.observations))
const latestFor = (metricId:string) => latestObservations.value.get(metricId)
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
const metricState=(m:Metric)=>metricReferenceState(m,liveMode?referenceLatest.get(m.id):latestFor(m.id))
const metricReferenceCounts=computed(()=>{
 const result:Record<MetricReferenceFilter,number>={all:0,within:0,outside:0,unknown:0}
 if(!metricSummariesReady.value)return result
 for(const metric of (liveMode?referenceMetrics.value:demo.metrics)){
   if(!metric.name.toLowerCase().includes(search.value.trim().toLowerCase()))continue
   const state=metricState(metric)
   result.all++
   result[state]++
 }
 return result
})
const filteredMetrics=computed(()=>{
  if(liveMode&&usesPagedSection('metrics'))return pagedIds.value.map(id=>demo.metrics.find(row=>row.id===id)).filter((row):row is Metric=>!!row)
  if(!metricSummariesReady.value)return []
  return (liveMode?referenceMetrics.value:demo.metrics).filter(m=>m.name.toLowerCase().includes(search.value.trim().toLowerCase())&&matchMetricReferenceFilter(metricState(m),metricReferenceFilter.value))
})
const displayedMetrics=computed(()=>liveMode&&usesPagedSection('metrics')?filteredMetrics.value:filteredMetrics.value.slice(0,metricVisibleLimit.value))
const metricRowLatest=(id:string)=>!liveMode?latestFor(id):usesPagedSection('metrics')?metricPageLatest.get(id):referenceLatest.get(id)
const metricRowReady=(id:string)=>!liveMode||(usesPagedSection('metrics')?metricPageReady.has(id):metricSummariesReady.value)
const filteredDocuments = computed(()=>liveMode?pagedIds.value.map(id=>demo.documents.find(row=>row.id===id)).filter((row):row is NonNullable<typeof row>=>!!row):demo.documents.filter(d=>d.title.includes(search.value) || d.issuerName.includes(search.value)))
const filteredRegimens = computed(()=>liveMode?pagedIds.value.map(id=>demo.regimens.find(row=>row.id===id)).filter((row):row is NonNullable<typeof row>=>!!row):demo.regimens.filter(r=>r.name.includes(search.value)))
const filteredTimeline = computed(()=>liveMode?timelineEntries.value:timeline.value.filter(e=>e.title.includes(search.value) || e.meta.includes(search.value)))
const contextName = computed(()=>current.value ? (current.value.name || current.value.title || current.value.summary || nameOfMetric(current.value.metricId)) : activeTab.value === 'body' ? '身体' : navItems.find(n=>n.id===activeTab.value)?.title ?? '首页')
const concernRelated = computed(() => {
  const id=selectedConcern.value
  const matches=(kind:ConcernTargetKind,record:{id:string;concernIds?:string[]})=>
    liveMode ? concernTargetHasRelation(concernLinks.value,kind,record.id) : related(record as any,id)
  return {
    metrics:demo.metrics.filter(m=>liveMode?matches('metric',m):false),
    observations:demo.observations.filter(o=>matches('observation',o)),
    events:demo.events.filter(e=>matches('event',e)),
    documents:demo.documents.filter(d=>matches('document',d)),
    assessments:demo.assessments.filter(a=>matches('assessment',a)),
    regimens:demo.regimens.filter(r=>matches('regimen',r)),
  }
})
const evidenceEntries=computed(()=>newestFirst([
  ...concernRelated.value.documents.map(r=>({kind:'document' as const,id:r.id,title:r.title,date:r.issuedDate,subtitle:'健康资料'})),
  ...concernRelated.value.assessments.map(r=>({kind:'assessment' as const,id:r.id,title:r.title,date:r.assessedDate,subtitle:'健康评估'})),
],r=>r.date))
const concernLists=computed(()=>({
  metrics:newestFirst(concernRelated.value.metrics,m=>
    liveMode?(concernMetricDates.get(m.id)??''):demo.observations.filter(o=>o.metricId===m.id).reduce((latest,o)=>o.observedDate>latest?o.observedDate:latest,'')),
  observations:newestFirst(concernRelated.value.observations,r=>r.observedDate),
  regimens:newestFirst(concernRelated.value.regimens,r=>r.startDate),
  events:newestFirst(concernRelated.value.events,r=>r.date),
  evidence:evidenceEntries.value,
}))
const pagedConcern=computed(()=>({
  metrics:pageOf(concernLists.value.metrics,Math.min(concernPage.metrics,pageCount(concernLists.value.metrics.length)-1)),
  observations:pageOf(concernLists.value.observations,Math.min(concernPage.observations,pageCount(concernLists.value.observations.length)-1)),
  regimens:pageOf(concernLists.value.regimens,Math.min(concernPage.regimens,pageCount(concernLists.value.regimens.length)-1)),
  events:pageOf(concernLists.value.events,Math.min(concernPage.events,pageCount(concernLists.value.events.length)-1)),
  evidence:pageOf(concernLists.value.evidence,Math.min(concernPage.evidence,pageCount(concernLists.value.evidence.length)-1)),
}))
function concernEdge(kind:ConcernTargetKind,id:string){
  return concernLinks.value.find(edge=>edge.target.modelKey===concernTargetModels[kind]&&edge.target.recordId===id)
}
const relationChoices=[
  {kind:'metric' as const,label:'健康指标'},
  {kind:'observation' as const,label:'测量记录'},
  {kind:'event' as const,label:'健康事件'},
  {kind:'document' as const,label:'健康资料'},
  {kind:'assessment' as const,label:'健康评估'},
  {kind:'regimen' as const,label:'健康方案'},
]
const relationOptionsLoading=ref(false)
let optionsSequence=0
function optionDenied(e:unknown){
  if(e instanceof HealthApiError&&[401,403].includes(e.status)){
    clearLiveRecords();subjectPersonId.value='';sheet.value='';liveStatus.value='error';liveMessage.value=e.message;return true
  }
  return false
}
const relationOptionIds=ref<string[]>([])
const relationOptionCursor=ref<string|null>(null)
const relationOptionSearch=ref('')
const relationOptionsError=ref('')
let relationOptionsController:AbortController|null=null
let relationOptionsTimer:ReturnType<typeof setTimeout>|undefined
function cancelRelationOptions(){
  ++optionsSequence
  relationOptionsController?.abort();relationOptionsController=null
  if(relationOptionsTimer!==undefined){clearTimeout(relationOptionsTimer);relationOptionsTimer=undefined}
  relationOptionsLoading.value=false
}
onBeforeUnmount(cancelRelationOptions)
async function loadRelationOptions(more=false){
  if(!liveMode||!activeRelationCard.value||!selectedSpaceId.value||more&&(!relationOptionCursor.value||relationOptionsLoading.value))return
  cancelRelationOptions()
  const controller=new AbortController();relationOptionsController=controller
  const version=optionsSequence,kind=relationKind.value,spaceId=selectedSpaceId.value,concernId=selected.value?.id
  const valid=()=>version===optionsSequence&&spaceId===selectedSpaceId.value&&!!activeRelationCard.value&&selected.value?.kind==='concern'&&selected.value.id===concernId&&relationKind.value===kind&&!controller.signal.aborted
  if(!more){relationOptionIds.value=[];relationOptionCursor.value=null;relationTargetId.value=''}
  relationOptionsLoading.value=true;relationOptionsError.value=''
  try{
    const params=new URLSearchParams({limit:'30'})
    if(more&&relationOptionCursor.value)params.set('cursor',relationOptionCursor.value)
    if(kind==='observation')params.set('view','picker')
    else if(relationOptionSearch.value.trim())params.set('search',relationOptionSearch.value.trim())
    if(kind==='event')params.set('timezone',Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC')
    const page=await getHealthPage(spaceId,concernTargetModels[kind],params,controller.signal)
    if(!valid())return
    assertOwnScope(page.personId)
    if(kind==='observation'){
      await readSelectedRows(spaceId,'metric',page.items.map(row=>String(row.metricId??'')).filter(id=>!demo.metrics.some(metric=>metric.id===id)),controller.signal,valid)
    }
    if(!valid())return
    mergeHealthRecords(kind,page.items)
    relationOptionIds.value=[...new Set([...relationOptionIds.value,...page.items.map(row=>row.id)])]
    relationOptionCursor.value=page.nextCursor
  }catch(e){if(valid()&&!optionDenied(e))relationOptionsError.value=e instanceof Error?e.message:'选项加载失败'}
  finally{if(valid()){relationOptionsLoading.value=false;relationOptionsController=null}}
}
function changeRelationOptionSearch(term:string){
  relationOptionSearch.value=term
  cancelRelationOptions();relationOptionIds.value=[];relationOptionCursor.value=null;relationTargetId.value='';relationOptionsError.value='';relationOptionsLoading.value=true
  relationOptionsTimer=setTimeout(()=>{relationOptionsTimer=undefined;void loadRelationOptions()},250)
}
watch([activeRelationCard,relationKind],()=>{
  cancelRelationOptions();relationOptionSearch.value='';relationOptionIds.value=[];relationOptionCursor.value=null;relationTargetId.value=''
  if(activeRelationCard.value)void loadRelationOptions()
})
const relationCandidates=computed(()=>relationOptionIds.value.map(id=>getList(relationKind.value).find(row=>row.id===id)).filter(row=>row&&!concernTargetHasRelation(concernLinks.value,relationKind.value,row.id)))
function relationTargetKind(edge:ConcernRelation):ConcernTargetKind {
  return (Object.keys(concernTargetModels) as ConcernTargetKind[])
    .find(kind=>concernTargetModels[kind]===edge.target.modelKey)!
}
function relationRecordName(kind:ConcernTargetKind,id:string){
  const record=getList(kind).find(r=>r.id===id)
  return record?.name||record?.title||record?.summary||
    (kind==='observation'&&record?observationTitle(record):'记录已不可见')
}
async function refreshConcernLinks(concernId:string){
  if(!liveMode||!selectedSpaceId.value)return
  resetConcernReads()
  const controller=new AbortController();concernAbort=controller
  const spaceId=selectedSpaceId.value,version=++relationSequence
  relationLoading.value=true;relationReadState.value='loading';relationReadError.value='';relationError.value='';concernLinks.value=[]
  try{
    const response=await listConcernRelations(spaceId,concernId,controller.signal)
    if(version!==relationSequence||spaceId!==selectedSpaceId.value||
       selected.value?.kind!=='concern'||selected.value.id!==concernId)return
    concernLinks.value=response.items
    relationReadState.value='ready'
    await Promise.all((Object.keys(concernGroupKinds) as ConcernList[]).map(key=>loadConcernGroup(key,spaceId,version,controller.signal)))
  }catch(e){
    if(version===relationSequence){
      if(e instanceof HealthApiError&&[401,403].includes(e.status)){
        clearLiveRecords();subjectPersonId.value='';liveStatus.value='error';liveMessage.value=e.message
        return
      }
      relationReadState.value='error';relationReadError.value=e instanceof Error?e.message:'关联读取失败'
    }
  }finally{if(version===relationSequence)relationLoading.value=false}
}
async function addConcernLink(){
  const id=selected.value?.kind==='concern'?selected.value.id:null
  const spaceId=selectedSpaceId.value,targetId=relationTargetId.value,kind=relationKind.value
  if(!id||!spaceId||!targetId||relationBusy.value||relationOptionsLoading.value||!!relationOptionsError.value||concernContent.value!=='ready')return
  relationBusy.value=true;relationError.value=''
  try{
    const saved=await linkConcernRecord(spaceId,id,kind,targetId)
    if(spaceId===selectedSpaceId.value&&selected.value?.kind==='concern'&&selected.value.id===id){
      if(!concernLinks.value.some(r=>r.id===saved.id))concernLinks.value=[...concernLinks.value,saved]
      relationTargetId.value=''
      notice.value='已关联现有记录。'
      void refreshConcernLinks(id)
    }
  }catch(e){relationError.value=e instanceof Error?e.message:'关联失败'}
  finally{relationBusy.value=false}
}
async function removeConcernLink(edge:ConcernRelation){
  if(!window.confirm('确定解除与“'+relationRecordName(relationTargetKind(edge),edge.target.recordId)+'”的关联吗？\n原记录不会被删除。'))return
  const id=selected.value?.kind==='concern'?selected.value.id:null
  const spaceId=selectedSpaceId.value
  if(!id||!spaceId||relationBusy.value||concernContent.value!=='ready')return
  relationBusy.value=true;relationError.value=''
  try{
    await unlinkConcernRecord(spaceId,id,edge.id)
    if(spaceId===selectedSpaceId.value&&selected.value?.kind==='concern'&&selected.value.id===id){
      concernLinks.value=concernLinks.value.filter(r=>r.id!==edge.id)
      notice.value='关联已解除，原记录已保留。'
    }
  }catch(e){relationError.value=e instanceof Error?e.message:'解除关联失败'}
  finally{relationBusy.value=false}
}
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
function navigate(tab: Tab,loadDefault=true) {
  if(sheet.value==='edit'&&(saving.value||quickMetricSaving.value))return
  routeStack.value=[]
  ++liveLoadSequence;cancelMetricDetail();cancelPage();cancelSnapshot();resetDocumentRelated()
  ++relationSequence;resetConcernReads();cancelRelationOptions();activeRelationCard.value=null;relationLoading.value=false;relationReadState.value='idle'
  activeTab.value=tab==='home'?'body':tab; selected.value=null; sheet.value=''; bodyTab.value='focus'; search.value=''
  if(loadDefault&&liveMode&&selectedSpaceId.value&&activeTab.value==='body')void loadLiveRecords('focus')
  window.scrollTo({top:0,behavior:'smooth'})
}
function openBody(tab: BodyTab) { navigate('body',false);changeBodyTab(tab) }
function changeBodyTab(tab:BodyTab) {
  if(sheet.value==='edit'&&(saving.value||quickMetricSaving.value))return
  ++relationSequence;resetConcernReads();cancelRelationOptions();activeRelationCard.value=null;relationLoading.value=false;relationReadState.value='idle'
  selected.value=null;routeStack.value=[];bodyTab.value=tab;search.value='';metricVisibleLimit.value=40
  if(tab==='metrics'&&!metricSummariesReady.value)metricReferenceFilter.value='all'
  if(liveMode&&selectedSpaceId.value)void loadLiveRecords(tab)
}
function show(kind: HealthKind,id: string) {
  if(sheet.value==='edit'&&(saving.value||quickMetricSaving.value))return
  if (selected.value?.kind === kind && selected.value.id===id) return
  if(activeTab.value==='body' && bodyTab.value==='timeline' && !selected.value)
    timelineScrollPosition.value=window.scrollY
  routeStack.value.push(location())
  ++relationSequence;concernLinks.value=[];relationError.value='';relationReadState.value='idle';relationReadError.value='';relationLoading.value=false;resetConcernPages()
  activeTab.value='body'; selected.value=saveDestination(kind,id);sheet.value='';search.value=''
  if(liveMode&&selectedSpaceId.value){
    void loadLiveRecords('detail')
    if(kind==='concern')void refreshConcernLinks(id)
  }
  window.scrollTo({top:0,behavior:'smooth'})
}
function back() {
  if(sheet.value==='edit'&&(saving.value||quickMetricSaving.value))return
  const previous=routeStack.value.pop()
  if(previous) {
    activeTab.value=previous.tab
    bodyTab.value=previous.section
    ++relationSequence;concernLinks.value=[];relationError.value='';relationReadState.value='idle';relationReadError.value='';relationLoading.value=false;resetConcernPages()
    selected.value=previous.record
    if(liveMode&&selectedSpaceId.value){
      void loadLiveRecords(previous.record?'detail':previous.section)
      if(previous.record?.kind==='concern')void refreshConcernLinks(previous.record.id)
    }
  } else selected.value=null
  if(previous?.tab==='body' && previous.section==='timeline' && !previous.record)
    nextTick(()=>window.scrollTo({top:timelineScrollPosition.value,behavior:'auto'}))
  else window.scrollTo({top:0,behavior:'smooth'})
}
async function startCreate(kind: HealthKind) {
  if(liveMode && (!selectedSpaceId.value || !subjectPersonId.value || liveStatus.value!=='ready')) {
    notice.value='请先连接 Space 并选择档案人员。';return
  }
  if(kind==='document') openImport(selected.value?.kind==='concern' ? selected.value.id : '')
  else openEditor(kind,'', selected.value?.kind==='concern' ? selected.value.id : '')
}
function runBodyPrimary() {
  const action=bodyCreateAction.value
  if(action.mode==='direct') startCreate(action.action)
}
async function onAttentionChange(id:string,event:Event) {
  const input=event.target as HTMLSelectElement
  const previous=attentionByConcern.value[id]??'unset'
  const attention=parseConcernAttention(input.value)
  const spaceId=selectedSpaceId.value
  try {
    if(liveMode) {
      if(!spaceId || liveStatus.value!=='ready')throw new Error('尚未连接健康档案')
      await patchConcernPresentation(spaceId,id,{attention})
      if(selectedSpaceId.value!==spaceId)return
    }
    attentionByConcern.value={...attentionByConcern.value,[id]:attention}
    notice.value=liveMode?'关注度已同步。':'关注度已更新（仅本次演示）。'
  } catch(e) {
    input.value=previous
    notice.value=e instanceof Error?e.message:'关注度同步失败'
  }
}
async function assignConcernPoint(id:string,view:BodyView,point:BodyPoint) {
  let next:BodyMapBinding[]
  try { next=setConcernPoint(bodyBindings.value,id,view,point) }
  catch { notice.value='请点选人体轮廓内的位置。';return }
  const spaceId=selectedSpaceId.value
  try {
    if(liveMode) {
      if(!spaceId || liveStatus.value!=='ready')throw new Error('尚未连接健康档案')
      await patchConcernPresentation(spaceId,id,{placement:next.find(p=>p.concernId===id)!})
      if(selectedSpaceId.value!==spaceId)return
    }
    bodyBindings.value=next
    notice.value=liveMode?'人体位置已同步。':'已为关注事项标记位置（仅本次演示）。'
  } catch(e) {notice.value=e instanceof Error?e.message:'人体位置同步失败'}
}
async function clearConcernPoint(id:string) {
  const spaceId=selectedSpaceId.value
  try {
    if(liveMode) {
      if(!spaceId || liveStatus.value!=='ready')throw new Error('尚未连接健康档案')
      await patchConcernPresentation(spaceId,id,{placement:null})
      if(selectedSpaceId.value!==spaceId)return
    }
    bodyBindings.value=removeConcernPoint(bodyBindings.value,id)
    notice.value=liveMode?'人体定位已移除并同步。':'人体定位已移除（仅本次演示）。'
  } catch(e) {notice.value=e instanceof Error?e.message:'移除定位失败'}
}
const formOptionsLoading=ref(false)
const formOptionsError=ref('')
let formOptionsSequence=0
let formOptionsController:AbortController|null=null
function cancelFormOptions(){
  ++formOptionsSequence;formOptionsController?.abort();formOptionsController=null;formOptionsLoading.value=false
}
type FormChoiceKind='metric'|'document'|'event'
const formReferenceOpen=ref(false)
const formReferenceSearch=ref('')
const formChoiceIds=ref<string[]>([])
const formChoiceCursor=ref<string|null>(null)
const formChoiceLoading=ref(false)
const formChoiceError=ref('')
const formReferenceKind=computed<FormChoiceKind>(()=>editKind.value==='document'?'event':'document')
const formReferenceField=computed(()=>editKind.value==='document'?'eventId':'sourceDocumentId')
const formReferenceId=computed(()=>String(draft.value[formReferenceField.value]??''))
const formReferenceLabel=computed(()=>formReferenceId.value?relationRecordName(formReferenceKind.value,formReferenceId.value):'不关联')
const formChoiceKind=computed<FormChoiceKind|null>(()=>sheet.value!=='edit'?null:metricPickerOpen.value?'metric':formReferenceOpen.value?formReferenceKind.value:null)
const formChoiceTerm=computed(()=>formChoiceKind.value==='metric'?metricSearch.value:formReferenceSearch.value)
const formChoiceItems=computed(()=>formChoiceKind.value?formChoiceIds.value.map(id=>getList(formChoiceKind.value!).find(row=>row.id===id)).filter(Boolean):[])
const formReferenceCandidates=computed(()=>formChoiceItems.value.map(row=>({id:String(row.id),label:relationRecordName(formReferenceKind.value,row.id)})))
let formChoiceSequence=0
let formChoiceController:AbortController|null=null
let formChoiceTimer:ReturnType<typeof setTimeout>|undefined
function cancelFormChoices(){
  ++formChoiceSequence;formChoiceController?.abort();formChoiceController=null
  if(formChoiceTimer!==undefined){clearTimeout(formChoiceTimer);formChoiceTimer=undefined}
  formChoiceLoading.value=false
}
onBeforeUnmount(()=>{cancelFormChoices();cancelFormOptions()})
function toggleMetricPicker(){
  formReferenceOpen.value=false;metricPickerOpen.value=!metricPickerOpen.value;quickMetricOpen.value=false
}
function toggleFormReference(){
  metricPickerOpen.value=false;quickMetricOpen.value=false
  formReferenceSearch.value='';formReferenceOpen.value=!formReferenceOpen.value
}
function chooseFormReference(id:string){
  draft.value[formReferenceField.value]=id;formReferenceOpen.value=false
}
async function loadFormChoices(more=false){
  const kind=formChoiceKind.value,spaceId=selectedSpaceId.value
  if(!liveMode||!kind||!spaceId||more&&(!formChoiceCursor.value||formChoiceLoading.value))return
  cancelFormChoices()
  const controller=new AbortController();formChoiceController=controller
  const version=formChoiceSequence,term=formChoiceTerm.value.trim()
  const valid=()=>version===formChoiceSequence&&formChoiceKind.value===kind&&spaceId===selectedSpaceId.value&&!controller.signal.aborted
  if(!more){formChoiceIds.value=[];formChoiceCursor.value=null}
  formChoiceLoading.value=true;formChoiceError.value=''
  try{
    const params=new URLSearchParams({limit:'30'})
    if(more&&formChoiceCursor.value)params.set('cursor',formChoiceCursor.value)
    if(term)params.set('search',term)
    if(kind==='event')params.set('timezone',Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC')
    const page=await getHealthPage(spaceId,kind==='metric'?'health_metric':kind==='event'?'health_event':'health_document',params,controller.signal)
    if(!valid())return
    assertOwnScope(page.personId);mergeHealthRecords(kind,page.items)
    formChoiceIds.value=[...new Set([...formChoiceIds.value,...page.items.map(row=>row.id)])]
    formChoiceCursor.value=page.nextCursor
  }catch(e){if(valid()&&!optionDenied(e))formChoiceError.value=e instanceof Error?e.message:'选项读取失败'}
  finally{if(valid()){formChoiceLoading.value=false;formChoiceController=null}}
}
watch([formChoiceKind,formChoiceTerm],()=>{
  if(!liveMode)return
  cancelFormChoices();formChoiceIds.value=[];formChoiceCursor.value=null;formChoiceError.value=''
  if(formChoiceKind.value){
    formChoiceLoading.value=true
    formChoiceTimer=setTimeout(()=>{formChoiceTimer=undefined;void loadFormChoices()},250)
  }
},{flush:'sync'})
watch(sheet,()=>{if(sheet.value!=='edit'){cancelFormOptions();formReferenceOpen.value=false;metricPickerOpen.value=false}})
async function metricNameExists(name:string,exceptId=''){
  const spaceId=selectedSpaceId.value,personId=subjectPersonId.value
  const normalized=name.trim().toLocaleLowerCase()
  let cursor:string|null=null
  for(let i=0;i<40;i++){
    const params=new URLSearchParams({limit:'50',search:name.trim().slice(0,100)})
    if(cursor)params.set('cursor',cursor)
    const page=await getHealthPage(spaceId,'health_metric',params)
    if(spaceId!==selectedSpaceId.value||personId!==subjectPersonId.value)throw Error('健康档案已切换，请重新操作')
    assertOwnScope(page.personId)
    if(page.items.some(row=>row.id!==exceptId&&typeof row.name==='string'&&row.name.trim().toLocaleLowerCase()===normalized))return true
    cursor=page.nextCursor
    if(!cursor)return false
  }
  throw Error('同名指标查询未完成，请缩小名称范围后重试')
}
function openEditor(kind: HealthKind,id='',presetConcernId='') {
  if(saving.value)return
  const record=id ? getList(kind).find(r=>r.id===id) : null
  if (id && !record) {notice.value='这条记录已不存在，请刷新后重试。';return}
  const d=record ? editableSnapshot(record) : makeEmpty(kind,today)
  uploadFile.value=null
  uploadProgress.value=null
  if(kind==='concern') d.attention=attentionByConcern.value[id]??'unset'
  if(kind==='metric'||kind==='observation'){
    d.referenceLow=d.referenceLow??''
    d.referenceHigh=d.referenceHigh??''
    d.referenceSource=d.referenceSource??''
  }
  if (kind==='observation' && record) d.value = record.valueNumber !== null ? String(record.valueNumber) : record.valueBoolean !== null ? String(record.valueBoolean) : record.valueText
  if (presetConcernId && !record && kind!=='metric') d.concernIds=[presetConcernId]
  if (kind==='observation' && !d.metricId&&!liveMode) d.metricId=demo.metrics[0]?.id ?? ''
  metricPickerOpen.value=false;formReferenceOpen.value=false;formReferenceSearch.value='';metricSearch.value='';quickMetricOpen.value=false;quickMetricError.value=''
  editKind.value=kind;editId.value=id;draft.value=d;formError.value='';sheet.value='edit'
  if(liveMode)void loadFormOptions(kind)
}
async function loadFormOptions(kind:HealthKind){
  cancelFormOptions()
  const version=formOptionsSequence,spaceId=selectedSpaceId.value
  const controller=new AbortController();formOptionsController=controller
  const valid=()=>version===formOptionsSequence&&sheet.value==='edit'&&editKind.value===kind&&spaceId===selectedSpaceId.value&&!controller.signal.aborted
  formOptionsLoading.value=true;formOptionsError.value=''
  try{
    // Only resolve already-selected references; the chooser fetches candidates on opening.
    const tasks:Promise<HealthRecord[]>[]=[]
    if(kind==='observation'&&draft.value.metricId)tasks.push(readSelectedRows(spaceId,'metric',[String(draft.value.metricId)],controller.signal,valid))
    if((kind==='observation'||kind==='regimen')&&draft.value.sourceDocumentId)tasks.push(readSelectedRows(spaceId,'document',[String(draft.value.sourceDocumentId)],controller.signal,valid))
    if(kind==='document'&&draft.value.eventId)tasks.push(readSelectedRows(spaceId,'event',[String(draft.value.eventId)],controller.signal,valid))
    await Promise.all(tasks)
  }catch(e){if(valid()&&!optionDenied(e))formOptionsError.value=e instanceof Error?e.message:'表单选项加载失败'}
  finally{if(valid()){formOptionsLoading.value=false;formOptionsController=null}}
}
async function formSave() {
  if(saving.value||quickMetricSaving.value||formOptionsLoading.value||formOptionsError.value)return
  formError.value=''
  const v=draft.value, kind=editKind.value
  const mandatory: Record<HealthKind,string[]> = {
    concern:['name'],metric:['name'],observation:['metricId','observedDate'],event:['summary','date'],
    document:['title'],assessment:['title','content','assessedDate'],regimen:['name','instructions'],
  }
  if(kind==='document' && !editId.value && !uploadFile.value && liveMode) {
    formError.value='请先选择要上传的文件';return
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
  if(!liveMode&&kind==='metric' && demo.metrics.some(m=>m.name.trim()===String(v.name).trim() && m.id!==editId.value)) formError.value='已有同名指标，可直接使用现有指标'
  if(kind==='metric' && v.valueType==='number') formError.value=validateReferenceDraft(v.referenceLow,v.referenceHigh,v.referenceSource,'number')??formError.value
  if(kind==='observation' && demo.metrics.find(m=>m.id===v.metricId)?.valueType==='number') formError.value=validateReferenceDraft(v.referenceLow,v.referenceHigh,v.referenceSource,'number')??formError.value
  if(!liveMode&&kind==='metric' && editId.value && demo.metrics.find(m=>m.id===editId.value)?.valueType!==v.valueType && demo.observations.some(o=>o.metricId===editId.value)) formError.value='已经有历史记录的指标不能改动记录方式'
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
  if(liveMode) {
    if(!selectedSpaceId.value || !subjectPersonId.value || liveStatus.value!=='ready') {
      formError.value='尚未连接到有效的健康档案';return
    }
    if((payload.basisIds?.length??0)>0) {
      formError.value='评估依据关联尚未接入，请先单独保存评估记录。'
      return
    }
    saving.value=true
    uploadProgress.value=null
    notice.value=''
    try {
      const fields=kind==='document' && !editId.value
        ? null : encodeHealthFields(kind,payload,subjectPersonId.value)
      const rows=getList(kind)
      const previous=editId.value ? rows.find(r=>r.id===editId.value) : null
      if(editId.value&&!previous)throw Error('原记录不可见，请重新打开后再修改')
      if(kind==='metric'){
        if(await metricNameExists(String(payload.name),editId.value))throw Error('已有同名指标，可直接使用现有指标')
        if(previous&&previous.valueType!==payload.valueType){
          const history=await getHealthPage(selectedSpaceId.value,'health_observation',new URLSearchParams({limit:'1',metricId:previous.id}))
          assertOwnScope(history.personId)
          if(history.items.length||history.nextCursor)throw Error('已经有历史记录的指标不能改动记录方式')
        }
      }
      if(previous && fields) delete fields.subjectPersonId // immutable model ownership field
      const saved=kind==='document' && !previous
        ? await uploadHealthDocument(selectedSpaceId.value,uploadFile.value!,payload,
            state=>{uploadProgress.value=state})
        : previous
          ? await updateHealthRecord<HealthRecord>(selectedSpaceId.value,healthModelKey[kind],
              previous.id,previous.version,fields!)
          : await createHealthRecord<HealthRecord>(selectedSpaceId.value,healthModelKey[kind],fields!)
      invalidateHealth(kind,'relation')
      const mapped=decodeHealthRecord(kind,saved)
      if(kind==='document' && !previous) mapped.fileName=uploadFile.value?.name??'已上传原始资料'
      if(previous) rows.splice(rows.indexOf(previous),1,mapped)
      else rows.unshift(mapped)
      let presentationError=''
      if(kind==='concern') {
        const attention=parseConcernAttention(String(v.attention??'unset'))
        try {
          await patchConcernPresentation(selectedSpaceId.value,saved.id,{attention})
          attentionByConcern.value={...attentionByConcern.value,[saved.id]:attention}
        } catch(e) {
          presentationError=e instanceof Error?e.message:'关注度同步失败'
        }
      }
      let relationWarning=''
      if(!previous && kind!=='concern' && kind!=='metric') {
        for(const concernId of (v.concernIds||[]) as string[]) {
          try{await linkConcernRecord(selectedSpaceId.value,concernId,kind,saved.id)}
          catch(e){relationWarning=e instanceof Error?e.message:'关联失败'}
        }
      }
      sheet.value='';formError.value='';search.value=''
      notice.value=relationWarning?'健康记录已保存，但关联失败：'+relationWarning
        :presentationError?'健康记录已保存，但关注度未同步：'+presentationError
        :'已保存至 LifeSpace。'
      if(selected.value?.kind!==kind || selected.value.id!==saved.id) show(kind,saved.id)
    } catch(e) {if(!optionDenied(e))formError.value=e instanceof Error?e.message:'保存失败，请稍后重试'}
    finally {saving.value=false;uploadProgress.value=null;if(sheet.value!=='edit')uploadFile.value=null}
    return
  }
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
async function removeCurrent() {
  if(!selected.value||!current.value) return
  const kind=selected.value.kind,id=selected.value.id
  if(liveMode&&kind==='metric'&&(!metricHistoryReady.value||metricHistoryLoading.value||metricHistoryError.value)){notice.value='请先确认该指标的测量记录已加载。';return}
  if(kind==='metric' && (liveMode?(metricHistoryRows.value.length>0||!!metricHistoryCursor.value):demo.observations.some(o=>o.metricId===id))) {notice.value='该指标已有测量记录，请先保留指标与历史数据。';return}
  // Partial caches are not proof that references do not exist. Check on explicit deletion.
  if(!window.confirm(liveMode?'确定从 LifeSpace 删除这条健康记录吗？此操作会记录变更历史。':'要从本次演示中删除这条记录吗？')) return
  if(liveMode) {
    try {
      if(!selectedSpaceId.value || !Number.isInteger(current.value.version))
        throw new Error('缺少记录版本，无法安全删除')
      const spaceId=selectedSpaceId.value,personId=subjectPersonId.value,version=current.value.version
      const stillCurrent=()=>spaceId===selectedSpaceId.value&&personId===subjectPersonId.value&&selected.value?.kind===kind&&selected.value.id===id
      if(kind==='document'||kind==='event'){
        const result=await getHealthSnapshot(spaceId,kind==='document'?['health_observation','health_regimen']:['health_document'])
        if(!stillCurrent())return
        assertOwnScope(result.personId)
        if(kind==='document'){
          if(!Array.isArray(result.models.health_observation)||!Array.isArray(result.models.health_regimen))throw Error('引用检查响应不完整')
          if(result.models.health_observation.some(row=>row.sourceDocumentId===id)||result.models.health_regimen.some(row=>row.sourceDocumentId===id)||demo.assessments.some(a=>a.basisIds.includes(id)))throw Error('这份资料仍被其他健康记录引用，请先解除引用再删除。')
        }else{
          if(!Array.isArray(result.models.health_document))throw Error('引用检查响应不完整')
          if(result.models.health_document.some(row=>row.eventId===id))throw Error('该事件仍有关联资料，请先处理引用。')
        }
      }
      if(kind==='metric'){
        const result=await getHealthPage(spaceId,'health_observation',new URLSearchParams({limit:'1',metricId:id}))
        if(!stillCurrent())return
        assertOwnScope(result.personId)
        if(result.items.length||result.nextCursor)throw Error('该指标已有测量记录，请先保留指标与历史数据。')
      }
      if(!stillCurrent())return
      await deleteHealthRecord(spaceId,healthModelKey[kind],id,version)
      invalidateHealth(kind,'relation')
    } catch(e) {notice.value=e instanceof Error?e.message:'删除失败';return}
  }
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
  let presentationCleanupFailed=false
  if(liveMode && kind==='concern') {
    try { await deleteConcernPresentation(selectedSpaceId.value,id) }
    catch { presentationCleanupFailed=true }
  }
  if(kind==='concern') {
    if(mapSelectedConcern.value===id) mapSelectedConcern.value=null
    const next={...attentionByConcern.value};delete next[id];attentionByConcern.value=next
    bodyBindings.value=bodyBindings.value.filter(binding=>binding.concernId!==id)
    for(const collection of ['observations','events','documents','assessments','regimens'] as const)
      for(const record of demo[collection]) record.concernIds=record.concernIds.filter(x=>x!==id)
  }
  notice.value=liveMode
    ? presentationCleanupFailed?'健康记录已删除，展示设置清理失败（不会再显示旧定位）。':'已从 LifeSpace 删除。'
    :'已从演示页面移除。'
  back()
}
function togglePlan(id: string) {
  if(liveMode){notice.value='真实任务完成状态需要由 LifeSpace Task/Recurrence 管理，尚未接入。';return}
  completedPlanIds.value=completedPlanIds.value.includes(id) ? completedPlanIds.value.filter(x=>x!==id) : [...completedPlanIds.value,id]
}
function closeSheet() { if(saving.value||quickMetricSaving.value)return;sheet.value='';formError.value='';uploadFile.value=null }
function pickFile(e: Event) {
  const file=(e.target as HTMLInputElement).files?.[0]
  // Never read file contents; filename is held only in component memory.
  if(sheet.value==='edit') {uploadFile.value=file??null;draft.value.fileName=file?.name ?? ''}
  else uploadedName.value=file?.name ?? ''
}
function openImport(concernId='') {
  if(liveMode){openEditor('document','',concernId);return}
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
  if(liveMode)return // AI is tracked separately; do not expose demo as real Health
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
  <div :class="['aloha-surface', 'health-shell', { 'agent-open': agentOpen, 'sidebar-collapsed': sidebarCollapsed }]" data-aloha-surface="health" @keydown.esc="handleEscape">
    <aside class="desktop-sidebar" aria-label="主导航">
      <AlohaHub :apps="alohaApps" current-app="health" :compact="sidebarCollapsed"
        v-bind="alohaPublicLinks"/>
      <nav class="sidebar-nav" aria-label="Health 页面导航">
        <button v-for="item in navItems.filter(item=>item.id!=='more')" :key="item.id" :class="['nav-link',{selected:activeTab===item.id}]"
          type="button" :title="sidebarCollapsed ? item.title : undefined"
          :aria-label="item.title" @click="navigate(item.id)">
          <component :is="item.icon" :size="20" :stroke-width="1.9"/>
          <span v-if="!sidebarCollapsed">{{ item.title }}</span>
        </button>
      </nav>
      <div class="sidebar-bottom">
        <div v-if="!sidebarCollapsed" class="sidebar-note"><Info :size="16"/><span v-if="liveMode">健康档案<br>数据访问受保护</span><span v-else>体验版本<br>所有数据均为虚构示例</span></div>
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
        <div v-if="liveMode&&(liveStatus==='error'||!selectedSpaceId)" class="health-entry-state"
          :role="liveStatus==='error'?'alert':'status'">
          <template v-if="liveStatus==='error'">
            <h2>健康档案暂时无法加载</h2>
            <p>{{ liveMessage }}</p>
            <button type="button" class="quiet-button" @click="initializeLive">重新检查</button>
          </template>
          <HealthSkeleton v-else label="正在连接健康档案" :rows="4"/>
        </div>
        <template v-else>
        <section v-if="activeTab==='home'" class="home-view">
          <HealthPageHeader title="健康概览" subtitle="持续关注与最近变化"
            :agent-open="agentOpen" :agent-enabled="!liveMode"
            
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
                  <span class="row-main"><b :class="{struck:completedPlanIds.includes(r.id)}">{{ r.name }}</b><small>{{ r.recurrence==='daily'?'每日安排':r.recurrence==='weekly'?'每周安排':'自主安排' }} · {{ liveMode?'任务完成尚未接入':'点击体验完成状态' }}</small></span>
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
              can-back :agent-open="agentOpen" :agent-enabled="!liveMode"
            
            @ask="openAgent" @back="back">
              <template #actions>
                <button type="button" class="quiet-button detail-edit-button" aria-label="修改记录" title="修改记录" @click="openEditor(selected.kind,current.id)">
                  <Pencil :size="16"/><span class="detail-edit-label">修改</span>
                </button>
                <button type="button" class="icon-button destructive" :title="liveMode?'删除健康记录':'删除演示记录'"
                  :aria-label="liveMode?'删除健康记录':'删除演示记录'" @click="removeCurrent"><Trash2 :size="18"/></button>
              </template>
            </HealthPageHeader>
            <HealthSkeleton v-if="liveMode&&liveStatus==='loading'&&selected.kind!=='concern'" label="正在加载记录详情" :rows="5"/>
            <div v-else-if="selected.kind==='concern'" class="detail-columns concern-detail">
              <!-- Four product-purpose cards. Relation management is hidden by default,
                   and always scoped to the card's own record categories. -->
              <section class="ui-card detail-primary concern-status-card">
                <div class="card-heading"><h2>现在怎么样？</h2><span class="status-chip">{{ current.status==='active'?'持续关注':'已结束' }}</span></div>
                <p v-if="current.summary" class="body-copy concern-summary">{{ current.summary }}</p>
                <div class="concern-meta">
                  <label class="concern-attention-compact">
                    <span class="mini-label">关注度</span>
                    <span class="concern-attention-value">
                      <span class="concern-attention-dot" :style="{'--body-dot-color':attentionColor(attentionByConcern[current.id]??'unset')}" aria-hidden="true"/>
                      <select :value="attentionByConcern[current.id]??'unset'" class="concern-attention-select"
                        :aria-label="'设置'+current.name+'的关注度'" @change="onAttentionChange(current.id,$event)">
                        <option v-for="option in concernAttentionOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                      </select>
                    </span>
                  </label>
                  <span class="concern-meta-date"><span class="mini-label">开始关注</span><b>{{ displayDate(current.onsetDate) }}</b></span>
                  <span v-if="current.resolvedDate" class="concern-meta-date"><span class="mini-label">结束日期</span><b>{{ displayDate(current.resolvedDate) }}</b></span>
                </div>
                <p v-if="current.notes" class="helper-copy concern-note">{{ current.notes }}</p>

                <div class="concern-section-heading">
                  <h3>追踪指标 <span v-if="concernSectionState('metrics')==='ready'">{{ concernRelated.metrics.length }}</span></h3>
                  <span class="quiet-caption">看趋势</span>
                </div>
                <HealthSkeleton v-if="concernSectionState('metrics')==='loading'" label="正在加载追踪指标" :rows="2"/>
                <div v-else-if="concernSectionState('metrics')==='error'" role="alert" class="empty-inline">{{ concernReadErrors.metrics || relationReadError || '关联读取失败' }} <button class="inline-link" type="button" @click="retryConcernGroup('metrics')">重试</button></div>
                <div v-else-if="pagedConcern.metrics.length" class="concern-metric-list">
                  <div v-for="m in pagedConcern.metrics" :key="m.id" class="concern-record-row">
                    <button type="button" class="concern-metric-link" @click="show('metric',m.id)">
                      <Activity :size="17"/><span>{{ m.name }}</span><ChevronRight :size="15"/>
                    </button>
                    <button v-if="activeRelationCard==='status'&&concernEdge('metric',m.id)" type="button"
                      class="concern-unlink" :disabled="relationBusy" :aria-label="'解除指标关联：'+m.name"
                      title="解除指标关联" @click="removeConcernLink(concernEdge('metric',m.id)!)"><Link2 :size="15"/></button>
                  </div>
                </div>
                <p v-else class="empty-inline">尚未追踪指标，可从下方关联。</p>
                <ConcernPager v-if="concernSectionState('metrics')==='ready'" :page="concernPage.metrics" :total="concernLists.metrics.length" @change="concernPage.metrics=$event"/>

                <div class="concern-section-heading concern-section-separated">
                  <h3>近期测量 <span v-if="concernSectionState('observations')==='ready'">{{ concernRelated.observations.length }}</span></h3>
                  <span class="quiet-caption">最新在前</span>
                </div>
                <HealthSkeleton v-if="concernSectionState('observations')==='loading'" label="正在加载近期测量" :rows="2"/>
                <p v-else-if="concernSectionState('observations')==='error'" role="alert" class="empty-inline">{{ concernReadErrors.observations || relationReadError || '关联读取失败' }} <button class="inline-link" type="button" @click="retryConcernGroup('observations')">重试</button></p>
                <div v-for="o in (concernSectionState('observations')==='ready'?pagedConcern.observations:[])" :key="o.id" class="concern-record-row">
                  <button type="button" class="row-link" @click="show('observation',o.id)">
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
                    </span><ChevronRight :size="16"/>
                  </button>
                  <button v-if="activeRelationCard==='status'&&concernEdge('observation',o.id)" type="button"
                    class="concern-unlink" :disabled="relationBusy" :aria-label="'解除测量关联：'+nameOfMetric(o.metricId)"
                    title="解除测量关联" @click="removeConcernLink(concernEdge('observation',o.id)!)"><Link2 :size="15"/></button>
                </div>
                <p v-if="!concernRelated.observations.length&&concernSectionState('observations')==='ready'" class="empty-inline">尚无关联测量记录。</p>
                <ConcernPager v-if="concernSectionState('observations')==='ready'" :page="concernPage.observations" :total="concernLists.observations.length" @change="concernPage.observations=$event"/>
                <div class="concern-card-actions">
                  <button class="soft-button" type="button" @click="openEditor('observation','',current.id)"><Plus :size="16"/> 添加测量</button>
                  <button v-if="liveMode" class="concern-manage-toggle" type="button" :disabled="concernContent!=='ready'" :aria-expanded="activeRelationCard==='status'"
                    @click="toggleRelationCard('status')"><Link2 :size="15"/>{{ activeRelationCard==='status'?'完成管理':'管理关联' }}</button>
                </div>
                <ConcernLinkEditor v-if="liveMode&&activeRelationCard==='status'"
                  :kinds="relationChoices.filter(c=>relationKindForCard.status.includes(c.kind))"
                  :kind="relationKind" :target-id="relationTargetId"
                  :candidates="relationCandidates.map(r=>({id:r.id,label:relationRecordName(relationKind,r.id)}))"
                  :busy="relationBusy" :error="relationError" :loading="relationOptionsLoading" :load-error="relationOptionsError"
                   :search="relationOptionSearch" :has-more="!!relationOptionCursor"
                   @search="changeRelationOptionSearch" @more="loadRelationOptions(true)" @retry="loadRelationOptions(!!relationOptionCursor)"
                  @change-kind="relationKind=$event;relationTargetId=''" @change-target="relationTargetId=$event" @add="addConcernLink"/>
              </section>

              <section class="ui-card concern-business-card">
                <div class="card-heading"><h2>正在做什么？</h2><span v-if="concernSectionState('regimens')==='ready'" class="quiet-caption">{{ concernRelated.regimens.length }} 项方案</span></div>
                <HealthSkeleton v-if="concernSectionState('regimens')==='loading'" label="正在加载健康方案" :rows="2"/>
                <p v-else-if="concernSectionState('regimens')==='error'" role="alert" class="empty-inline">{{ concernReadErrors.regimens || relationReadError || '关联读取失败' }} <button class="inline-link" type="button" @click="retryConcernGroup('regimens')">重试</button></p>
                <div v-for="r in (concernSectionState('regimens')==='ready'?pagedConcern.regimens:[])" :key="r.id" class="concern-record-row">
                  <button type="button" class="row-link" @click="show('regimen',r.id)">
                    <span class="list-icon"><ListChecks :size="18"/></span>
                    <span class="row-main"><b>{{ r.name }}</b><small>{{ labelFrom(regimenStatuses,r.status) }} · {{ displayDate(r.startDate) }}</small></span>
                    <ChevronRight :size="17"/>
                  </button>
                  <button v-if="activeRelationCard==='regimens'&&concernEdge('regimen',r.id)" class="concern-unlink" type="button"
                    :aria-label="'解除方案关联：'+r.name" :disabled="relationBusy" @click="removeConcernLink(concernEdge('regimen',r.id)!)"><Link2 :size="15"/></button>
                </div>
                <p v-if="!concernRelated.regimens.length&&concernSectionState('regimens')==='ready'" class="empty-inline">还没有关联的健康方案。</p>
                <ConcernPager v-if="concernSectionState('regimens')==='ready'" :page="concernPage.regimens" :total="concernLists.regimens.length" @change="concernPage.regimens=$event"/>
                <div class="concern-card-actions">
                  <button class="soft-button" type="button" @click="openEditor('regimen','',current.id)"><Plus :size="16"/> 添加方案</button>
                  <button v-if="liveMode" class="concern-manage-toggle" type="button" :disabled="concernContent!=='ready'" :aria-expanded="activeRelationCard==='regimens'"
                    @click="toggleRelationCard('regimens')"><Link2 :size="15"/>{{ activeRelationCard==='regimens'?'完成管理':'管理关联' }}</button>
                </div>
                <ConcernLinkEditor v-if="liveMode&&activeRelationCard==='regimens'"
                  :kinds="relationChoices.filter(c=>relationKindForCard.regimens.includes(c.kind))"
                  :kind="relationKind" :target-id="relationTargetId"
                  :candidates="relationCandidates.map(r=>({id:r.id,label:relationRecordName(relationKind,r.id)}))"
                  :busy="relationBusy" :error="relationError" :loading="relationOptionsLoading" :load-error="relationOptionsError"
                   :search="relationOptionSearch" :has-more="!!relationOptionCursor"
                   @search="changeRelationOptionSearch" @more="loadRelationOptions(true)" @retry="loadRelationOptions(!!relationOptionCursor)"
                  @change-kind="relationKind=$event;relationTargetId=''" @change-target="relationTargetId=$event" @add="addConcernLink"/>
              </section>

              <section class="ui-card concern-business-card">
                <div class="card-heading"><h2>最近发生了什么？</h2><span v-if="concernSectionState('events')==='ready'" class="quiet-caption">{{ concernRelated.events.length }} 条事件</span></div>
                <HealthSkeleton v-if="concernSectionState('events')==='loading'" label="正在加载健康事件" :rows="2"/>
                <p v-else-if="concernSectionState('events')==='error'" role="alert" class="empty-inline">{{ concernReadErrors.events || relationReadError || '关联读取失败' }} <button class="inline-link" type="button" @click="retryConcernGroup('events')">重试</button></p>
                <div v-for="e in (concernSectionState('events')==='ready'?pagedConcern.events:[])" :key="e.id" class="concern-record-row">
                  <button type="button" class="row-link" @click="show('event',e.id)">
                    <span class="list-icon"><CalendarDays :size="18"/></span>
                    <span class="row-main"><b>{{ e.summary }}</b><small>{{ displayDate(e.date) }}</small></span><ChevronRight :size="17"/>
                  </button>
                  <button v-if="activeRelationCard==='events'&&concernEdge('event',e.id)" class="concern-unlink" type="button"
                    :aria-label="'解除事件关联：'+e.summary" :disabled="relationBusy" @click="removeConcernLink(concernEdge('event',e.id)!)"><Link2 :size="15"/></button>
                </div>
                <p v-if="!concernRelated.events.length&&concernSectionState('events')==='ready'" class="empty-inline">还没有关联的健康事件。</p>
                <ConcernPager v-if="concernSectionState('events')==='ready'" :page="concernPage.events" :total="concernLists.events.length" @change="concernPage.events=$event"/>
                <div class="concern-card-actions">
                  <button class="soft-button" type="button" @click="openEditor('event','',current.id)"><Plus :size="16"/> 记录事件</button>
                  <button v-if="liveMode" class="concern-manage-toggle" type="button" :disabled="concernContent!=='ready'" :aria-expanded="activeRelationCard==='events'"
                    @click="toggleRelationCard('events')"><Link2 :size="15"/>{{ activeRelationCard==='events'?'完成管理':'管理关联' }}</button>
                </div>
                <ConcernLinkEditor v-if="liveMode&&activeRelationCard==='events'"
                  :kinds="relationChoices.filter(c=>relationKindForCard.events.includes(c.kind))"
                  :kind="relationKind" :target-id="relationTargetId"
                  :candidates="relationCandidates.map(r=>({id:r.id,label:relationRecordName(relationKind,r.id)}))"
                  :busy="relationBusy" :error="relationError" :loading="relationOptionsLoading" :load-error="relationOptionsError"
                   :search="relationOptionSearch" :has-more="!!relationOptionCursor"
                   @search="changeRelationOptionSearch" @more="loadRelationOptions(true)" @retry="loadRelationOptions(!!relationOptionCursor)"
                  @change-kind="relationKind=$event;relationTargetId=''" @change-target="relationTargetId=$event" @add="addConcernLink"/>
              </section>

              <section class="ui-card concern-business-card">
                <div class="card-heading"><h2>有哪些依据？</h2><span v-if="concernSectionState('evidence')==='ready'" class="quiet-caption">{{ concernLists.evidence.length }} 份资料与评估</span></div>
                <HealthSkeleton v-if="concernSectionState('evidence')==='loading'" label="正在加载资料与评估" :rows="2"/>
                <p v-else-if="concernSectionState('evidence')==='error'" role="alert" class="empty-inline">{{ concernReadErrors.evidence || relationReadError || '关联读取失败' }} <button class="inline-link" type="button" @click="retryConcernGroup('evidence')">重试</button></p>
                <div v-for="e in (concernSectionState('evidence')==='ready'?pagedConcern.evidence:[])" :key="e.kind+e.id" class="concern-record-row">
                  <button type="button" class="row-link" @click="show(e.kind,e.id)">
                    <span class="list-icon"><FileText v-if="e.kind==='document'" :size="18"/><BadgeCheck v-else :size="18"/></span>
                    <span class="row-main"><b>{{ e.title }}</b><small>{{ e.subtitle }} · {{ displayDate(e.date) }}</small></span><ChevronRight :size="17"/>
                  </button>
                  <button v-if="activeRelationCard==='evidence'&&concernEdge(e.kind,e.id)" class="concern-unlink" type="button"
                    :aria-label="'解除资料关联：'+e.title" :disabled="relationBusy" @click="removeConcernLink(concernEdge(e.kind,e.id)!)"><Link2 :size="15"/></button>
                </div>
                <p v-if="!concernLists.evidence.length&&concernSectionState('evidence')==='ready'" class="empty-inline">还没有报告或评估记录。</p>
                <ConcernPager v-if="concernSectionState('evidence')==='ready'" :page="concernPage.evidence" :total="concernLists.evidence.length" @change="concernPage.evidence=$event"/>
                <div class="concern-card-actions">
                  <div class="action-row">
                    <button class="soft-button" type="button" @click="openImport(current.id)"><Plus :size="16"/> 添加资料</button>
                    <button class="soft-button" type="button" @click="openEditor('assessment','',current.id)"><Plus :size="16"/> 新建评估</button>
                  </div>
                  <button v-if="liveMode" class="concern-manage-toggle" type="button" :disabled="concernContent!=='ready'" :aria-expanded="activeRelationCard==='evidence'"
                    @click="toggleRelationCard('evidence')"><Link2 :size="15"/>{{ activeRelationCard==='evidence'?'完成管理':'管理关联' }}</button>
                </div>
                <ConcernLinkEditor v-if="liveMode&&activeRelationCard==='evidence'"
                  :kinds="relationChoices.filter(c=>relationKindForCard.evidence.includes(c.kind))"
                  :kind="relationKind" :target-id="relationTargetId"
                  :candidates="relationCandidates.map(r=>({id:r.id,label:relationRecordName(relationKind,r.id)}))"
                  :busy="relationBusy" :error="relationError" :loading="relationOptionsLoading" :load-error="relationOptionsError"
                   :search="relationOptionSearch" :has-more="!!relationOptionCursor"
                   @search="changeRelationOptionSearch" @more="loadRelationOptions(true)" @retry="loadRelationOptions(!!relationOptionCursor)"
                  @change-kind="relationKind=$event;relationTargetId=''" @change-target="relationTargetId=$event" @add="addConcernLink"/>
              </section>
            </div>

            <div v-else-if="selected.kind==='metric'" class="detail-columns metric-detail-layout">
              <section class="ui-card detail-primary">
                <div class="metric-summary">
                  <div class="metric-hero">
                    <span class="metric-value-row"><strong>{{ liveMode&&!metricHistoryReady?(metricHistoryError?'读取失败':'加载中…'):metricDetailLatest ? observationValue(metricDetailLatest,current) : '暂无记录' }}</strong>
                      <ReferenceIndicator v-if="metricDetailLatest&&(!liveMode||metricHistoryReady)" :comparison="referenceFor(metricDetailLatest,current)?.comparison"/>
                    </span>
                    <span>{{ liveMode&&!metricHistoryReady?'正在确认最新记录':metricDetailLatest ? '最新记录 · '+displayDate(metricDetailLatest.observedDate) : '还没有观测记录' }}</span>
                  </div>
                  <button class="primary-button metric-add-button" type="button" @click="openEditor('observation');draft.metricId=current.id;draft.unit=current.defaultUnit"><Plus :size="17"/> 记录一次</button>
                </div>
                <div class="card-heading metric-chart-heading"><h2>变化趋势</h2>
                   <label v-if="liveMode&&current.valueType==='number'" class="quiet-caption">时间范围
                     <select v-model="trendRange" aria-label="趋势时间范围" :disabled="!metricHistoryReady" @change="changeTrendRange">
                       <option value="1">近1年</option><option value="3">近3年</option><option value="5">近5年</option><option value="all">全部历史</option>
                     </select>
                   </label>
                 </div>
                 <p v-if="liveMode&&metricHistoryReady&&current.valueType==='number'" class="helper-copy">截至最新观测日 · {{ trendWindowLabel }}</p>
                <p v-if="current.valueType==='number' && (current.referenceLow!=null || current.referenceHigh!=null)" class="reference-range-note">
                  参考范围：{{ metricRangeLabel(current) }} · {{ current.referenceSource||'来源未注明' }}
                  <span>仅用于比较，不代表医学诊断。</span>
                </p>
                <HealthSkeleton v-if="liveMode&&current.valueType==='number'&&(metricHistoryReady?!metricTrendReady&&!metricTrendError:!metricHistoryError)" label="正在加载完整趋势区间" :rows="3"/>
                 <p v-else-if="liveMode&&current.valueType==='number'&&(metricTrendError||metricHistoryError&&!metricHistoryReady)" role="alert" class="empty-inline">{{ metricTrendError||metricHistoryError }} <button class="inline-link" type="button" @click="metricHistoryReady?loadMetricTrend(current.id):retryMetricHistory(current.id)">重试</button></p>
                 <MetricTrend v-else-if="current.valueType==='number'"
                  :metric-name="current.name" :unit="current.defaultUnit"
                  :reference-low="current.referenceLow" :reference-high="current.referenceHigh"
                  :reference-source="current.referenceSource"
                  :observations="(liveMode?metricTrendRows:demo.observations).filter(o=>o.metricId===current.id && (o.unit||current.defaultUnit)===current.defaultUnit)"
                  @open-observation="show('observation',$event)"/>
                <p v-else class="helper-copy">该指标记录的是{{ current.valueType==='text'?'文字':'是或否' }}，可在右侧查看历史记录，不适合用数值趋势图展示。</p>
              </section>
              <section class="ui-card metric-history"><div class="card-heading"><h2>历史记录</h2><span v-if="!liveMode||metricHistoryReady" class="quiet-caption">{{ liveMode&&metricHistoryCursor?'已加载 ':'' }}{{ liveMode?metricHistoryRows.length:demo.observations.filter(o=>o.metricId===current.id).length }} 条</span></div>
                <button v-for="o in (liveMode?metricHistoryRows:demo.observations.filter(o=>o.metricId===current.id).sort((a,b)=>b.observedDate.localeCompare(a.observedDate)))" :key="o.id" type="button" class="row-link" @click="show('observation',o.id)"><span class="row-main"><span class="metric-reading-inline"><b>{{ observationValue(o,current) }}</b><ReferenceIndicator :comparison="referenceFor(o,current)?.comparison"/></span><small>{{ displayDate(o.observedDate) }}</small></span><ChevronRight :size="16"/></button>
                <HealthSkeleton v-if="liveMode&&metricHistoryLoading&&!metricHistoryReady" label="正在加载历史记录" :rows="3"/>
                 <p v-else-if="liveMode&&metricHistoryError" role="alert" class="empty-inline">{{ metricHistoryError }} <button class="inline-link" type="button" @click="retryMetricHistory(current.id)">重试</button></p>
                 <p v-else-if="liveMode?metricHistoryReady&&!metricHistoryRows.length:!demo.observations.some(o=>o.metricId===current.id)" class="empty-inline">暂时没有历史记录。</p>
                 <button v-if="liveMode&&metricHistoryCursor&&!metricHistoryError" type="button" class="quiet-button" :disabled="metricHistoryLoading" @click="loadMetricHistory(current.id,true)">{{ metricHistoryLoading?'正在加载…':'加载更早记录' }}</button>
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
                <template v-else-if="selected.kind==='document'"><div class="document-preview"><FileHeart :size="40"/><span>{{ current.fileName }}</span><HealthDocumentPreview v-if="liveMode && current.artifactRef" :key="selectedSpaceId+':'+current.id" :space-id="selectedSpaceId" :record-id="current.id" :title="current.title || current.fileName"/><small v-if="liveMode">文件安全保存于 LifeSpace</small><small v-else>体验版仅保存文件名</small></div><dl class="detail-fields"><div><dt>资料类型</dt><dd>{{ docName(current) }}</dd></div><div><dt>资料日期</dt><dd>{{ displayDate(current.issuedDate) }}</dd></div><div><dt>出具机构</dt><dd>{{ current.issuerName||'未填写' }}</dd></div></dl></template>
                <template v-else-if="selected.kind==='assessment'"><p class="body-copy">{{ current.content }}</p><dl class="detail-fields"><div><dt>评估日期</dt><dd>{{ displayDate(current.assessedDate) }}</dd></div><div><dt>来源说明</dt><dd>{{ current.sourceNote||'未填写' }}</dd></div><div v-if="current.notes"><dt>备注</dt><dd>{{ current.notes }}</dd></div></dl></template>
                <template v-else-if="selected.kind==='regimen'"><p class="body-copy">{{ current.instructions }}</p><dl class="detail-fields"><div><dt>方案类型</dt><dd>{{ labelFrom(regimenTypes,current.regimenType) }}</dd></div><div><dt>安排</dt><dd>{{ current.recurrence==='daily'?'每日':current.recurrence==='weekly'?'每周':'不重复' }}</dd></div><div><dt>首次执行</dt><dd>{{ displayDate(current.firstDueDate) }}</dd></div><div><dt>开始日期</dt><dd>{{ displayDate(current.startDate) }}</dd></div><div><dt>结束日期</dt><dd>{{ displayDate(current.endDate) }}</dd></div><div v-if="current.notes"><dt>备注</dt><dd>{{ current.notes }}</dd></div></dl></template>
                <div class="relation-tags" v-if="current.concernIds?.length"><span class="mini-label">相关健康问题</span><button v-for="cid in current.concernIds" :key="cid" type="button" class="relation-pill" @click="show('concern',cid)"><Link2 :size="13"/>{{ nameOfConcern(cid) }}</button></div>
              </section>
              <section class="ui-card"><div class="card-heading"><h2>{{ selected.kind==='assessment'?'判断依据':selected.kind==='document'?'由这份资料整理':'关联资料' }}</h2></div>
                <template v-if="selected.kind==='document'">
                  <button v-if="liveMode&&documentRelatedState==='idle'" type="button" class="quiet-button" @click="loadDocumentRelated(current.id)">加载从这份资料整理的测量</button>
                  <HealthSkeleton v-if="liveMode&&documentRelatedState==='loading'" label="正在查询关联测量" :rows="3"/>
                  <p v-else-if="liveMode&&documentRelatedState==='error'" class="empty-inline" role="alert">{{ documentRelatedError }} <button type="button" class="inline-link" @click="loadDocumentRelated(current.id)">重试</button></p>
                  <button v-for="o in documentRelatedRows" :key="o.id"
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
                  <p v-if="(!liveMode||documentRelatedState==='ready')&&!documentRelatedRows.length&&!current.eventId" class="empty-inline">
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

          <template v-else-if="selected&&liveMode">
            <HealthPageHeader title="记录详情" can-back :agent-open="agentOpen" :agent-enabled="false" @back="back"/>
            <HealthSkeleton v-if="liveStatus==='loading'" label="正在加载记录详情" :rows="4"/>
            <p v-else class="empty-inline">此记录当前不可见或已删除。</p>
          </template>
          <template v-else>
            <HealthPageHeader title="身体健康" subtitle="健康问题、指标、事件与资料"
              :agent-open="agentOpen" :agent-enabled="!liveMode"
              
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
            <HealthSkeleton v-if="liveMode&&liveStatus!=='ready'&&!isPagedSection(bodyTab)" label="正在加载当前页面的数据" :rows="6"/>
            <div v-else-if="bodyTab==='focus'" class="body-overview">
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
                @remove-point="clearConcernPoint"
              />
            </div>
            <template v-else>
              <div class="list-toolbar">
                <label class="search-field"><Search :size="17"/><input v-model="search" maxlength="100"
                  aria-label="搜索当前内容" placeholder="搜索当前内容"/></label>
              </div>
              <div v-if="liveMode&&pagedRefreshing" class="save-progress" role="status"><span class="saving-spinner" aria-hidden="true"/>正在后台刷新…</div>
              <div v-else-if="liveMode&&liveStatus==='loading'" class="save-progress" role="status"><span class="saving-spinner" aria-hidden="true"/>正在加载当前页面的数据…</div>
              <div class="list-panel">
                <template v-if="bodyTab==='metrics'">
                  <div class="metric-reference-filters" role="group" aria-label="按参考范围筛选健康指标">
                    <button v-for="option in metricReferenceChoices" :key="option.value" type="button"
                      :class="{active:metricReferenceFilter===option.value}"
                      :aria-pressed="metricReferenceFilter===option.value"
                      @click="selectMetricReferenceFilter(option.value)">
                      {{ option.label }} <small v-if="metricSummariesReady">{{ metricReferenceCounts[option.value] }}</small>
                    </button>
                  </div><HealthSkeleton v-if="liveMode&&liveStatus==='loading'" :label="metricReferenceFilter==='all'?'正在加载指标':'正在计算全部指标的参考范围'" :rows="5"/><button v-for="m in displayedMetrics" :key="m.id" class="list-row" type="button" @click="show('metric',m.id)"><span class="list-icon"><Activity :size="19"/></span><span class="row-main"><b>{{ m.name }}</b><small>{{ labelFrom(valueTypes,m.valueType) }} {{ m.defaultUnit?' · '+m.defaultUnit:'' }}</small></span><span class="metric-list-result"><strong class="list-value">{{ !metricRowReady(m.id)?(metricSummaryError?'读取失败':'加载中…'):metricRowLatest(m.id)?observationValue(metricRowLatest(m.id)!,m):'—' }}</strong>
                    <ReferenceIndicator v-if="metricRowReady(m.id)&&metricRowLatest(m.id)"
                      :comparison="referenceFor(metricRowLatest(m.id)!,m)?.comparison"/>
                  </span><ChevronRight :size="18"/></button>
                  <div v-if="(!liveMode||!usesPagedSection('metrics'))&&metricVisibleLimit<filteredMetrics.length" class="list-toolbar"><button class="quiet-button" type="button" @click="metricVisibleLimit+=40">显示更多指标（{{ Math.min(metricVisibleLimit,filteredMetrics.length) }} / {{ filteredMetrics.length }}）</button></div>
                  <p v-if="(!liveMode||liveStatus==='ready')&&!pagedError&&!referenceError&&!pagedCursor&&!filteredMetrics.length" class="empty-inline metric-reference-empty">
                    {{ search.trim()?'没有找到符合条件的指标。':metricReferenceFilter==='all'?'还没有指标，添加后可以查看测量变化。':'目前没有这类指标，可以切换其他筛选。' }}
                  </p>
                </template>
                <template v-if="bodyTab==='timeline'">
                  <HealthTimeline :entries="filteredTimeline" :selected-kind="timelineKind" :search-active="Boolean(search.trim())"
                    :partial="liveMode" :has-more="timelineMore" :loading="timelineLoading" :error="timelineError"
                    @update:selected-kind="changeTimelineKind" @open="show"/>
                  <div v-if="liveMode&&timelineError" class="list-toolbar"><button class="quiet-button" type="button" @click="loadTimeline(timelineMore)">重试</button></div>
                  <div v-else-if="liveMode&&timelineMore" class="list-toolbar"><button class="quiet-button" type="button" :disabled="timelineLoading" @click="loadTimeline(true)">{{ timelineLoading?'正在加载…':search.trim()?'继续搜索更早记录':'加载更多' }}</button></div>
                </template>
                <HealthSkeleton v-if="liveMode&&bodyTab!=='metrics'&&usesPagedSection(bodyTab)&&liveStatus==='loading'" label="正在加载列表" :rows="5"/>
                <template v-if="bodyTab==='documents'"><button v-for="d in filteredDocuments" :key="d.id" class="list-row" type="button" @click="show('document',d.id)"><span class="list-icon"><FileText :size="19"/></span><span class="row-main"><b>{{ d.title }}</b><small>{{ docName(d) }} · {{ displayDate(d.issuedDate) }}</small></span><ChevronRight :size="18"/></button></template>
                <template v-if="bodyTab==='regimens'"><button v-for="r in filteredRegimens" :key="r.id" class="list-row" type="button" @click="show('regimen',r.id)"><span class="list-icon"><ListChecks :size="19"/></span><span class="row-main"><b>{{ r.name }}</b><small>{{ labelFrom(regimenTypes,r.regimenType) }} · {{ r.recurrence==='daily'?'每日':r.recurrence==='weekly'?'每周':'不重复' }}</small></span><span class="status-chip">{{ labelFrom(regimenStatuses,r.status) }}</span><ChevronRight :size="18"/></button></template>
                <div v-if="liveMode&&usesPagedSection(bodyTab)&&pagedError" role="alert" class="empty-inline">{{ pagedError }} <button type="button" class="inline-link" @click="loadPagedSection(bodyTab,Boolean(pagedCursor)&&!pagedError.startsWith('刷新失败'))">重试</button></div>
                <div v-if="liveMode&&bodyTab==='metrics'&&metricReferenceFilter!=='all'&&referenceError" role="alert" class="empty-inline">{{ referenceError }} <button type="button" class="inline-link" @click="loadReferenceIndex">重试统计</button></div>
                <div v-if="liveMode&&bodyTab==='metrics'&&metricSummaryError" role="alert" class="empty-inline">{{ metricSummaryError }} <button class="inline-link" type="button" @click="loadPagedSection('metrics')">重新加载指标</button></div>
                <div v-if="liveMode&&usesPagedSection(bodyTab)&&pagedCursor&&!pagedError&&!metricSummaryError" class="list-toolbar"><button class="quiet-button" type="button"  :disabled="pagedLoadingMore||metricSummaryLoading||pagedRefreshing" @click="loadPagedSection(bodyTab,true)">{{ pagedLoadingMore?'正在加载更多…':metricSummaryLoading?'正在读取最新值…':'加载更多' }}</button></div>
                <div v-if="liveStatus!=='loading'&&!pagedError&&!pagedCursor&&((bodyTab==='documents'&&!filteredDocuments.length)||(bodyTab==='regimens'&&!filteredRegimens.length))" class="empty-state"><Search :size="26"/><b>没有找到相关内容</b><span>试试其他关键词，或添加一条新记录。</span></div>
              </div>
              <p v-if="bodyTab==='documents'&&!liveMode" class="below-hint"><ShieldCheck :size="16"/> 上传演示只模拟整理过程，不会读取或发送文件内容。</p>
            </template>
          </template>
        </section>

        <section v-else-if="activeTab==='food'||activeTab==='movement'" class="future-page">
          <HealthPageHeader :title="activeTab==='food'?'饮食管理':'运动管理'"
              subtitle="逐步连接日常习惯与身体变化"
              :agent-open="agentOpen" :agent-enabled="!liveMode"
            
            @ask="openAgent"/>
          <div class="future-card"><component :is="activeTab==='food'?Utensils:Activity" :size="36"/><h2>先把重要的健康记录整理好</h2><p>饮食和运动会继续沿用这套操作方式，提供各自更适合的记录和分析页面。</p><button class="quiet-button" type="button" @click="openBody('focus')">看看身体管理 <ArrowRight :size="16"/></button></div></section>
        <section v-else class="more-view">
          <AlohaHub page :apps="alohaApps" current-app="health" v-bind="alohaPublicLinks"/>
        </section>
        </template>
      </main>
    </div>

    <!-- Persistent side workspace: no backdrop, no modal focus trap, no nav reset. -->
    <aside v-if="!liveMode&&agentOpen" id="health-agent-panel" class="agent-dock" aria-label="Health 助手对话">
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
        <header class="drawer-heading"><div><span class="eyebrow">{{ sheet==='edit'?'健康记录':'整理一份健康资料' }}</span><h2>{{ sheet==='edit'?(editId?'修改':'添加')+kindLabel[editKind]:'整理健康报告' }}</h2></div><button class="icon-button" aria-label="关闭" type="button" :disabled="saving||quickMetricSaving" @click="closeSheet"><X :size="20"/></button></header>

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
            <div class="metric-selector-field">
              <span class="field-label">记录哪一项 <span class="required-mark" aria-hidden="true">*</span></span>
              <button type="button" class="metric-picker-toggle" :aria-expanded="metricPickerOpen" aria-controls="health-metric-options"
                :disabled="quickMetricSaving||formOptionsLoading||!!formOptionsError" @click="toggleMetricPicker">
                <span>{{ demo.metrics.find(m=>m.id===draft.metricId)?.name||'选择健康指标' }}</span><ChevronDown :size="17"/>
              </button>
              <div v-if="metricPickerOpen" id="health-metric-options" class="metric-picker-panel">
                <label class="metric-picker-search"><Search :size="16"/><input v-model="metricSearch" type="search" maxlength="100" autocomplete="off"
                  placeholder="搜索指标名称" aria-label="搜索健康指标" @keydown.enter.prevent/></label>
                <div class="metric-picker-scroll">
                  <template v-if="!liveMode&&!metricSearch.trim()&&recentMetrics.length">
                    <div class="metric-picker-heading">最近使用 · 最多 5 项</div>
                    <button v-for="m in recentMetrics" :key="'recent-'+m.id" type="button" class="metric-picker-option" @click="chooseObservationMetric(m)">
                      <Clock3 :size="15"/><span>{{ m.name }}</span><Check v-if="draft.metricId===m.id" :size="15"/>
                    </button>
                  </template>
                  <div class="metric-picker-heading">{{ metricSearch.trim()?'搜索结果':'全部指标' }} · {{ liveMode?'已加载 ':'' }}{{ metricMatches.length }}</div>
                  <button v-for="m in metricMatches" :key="m.id" type="button" class="metric-picker-option" @click="chooseObservationMetric(m)">
                    <Activity :size="15"/><span>{{ m.name }}</span><Check v-if="draft.metricId===m.id" :size="15"/>
                  </button>
                  <p v-if="liveMode&&formChoiceLoading" class="helper-copy" role="status">正在读取指标…</p><p v-else-if="liveMode&&formChoiceError" role="alert" class="form-error">{{ formChoiceError }} <button class="inline-link" type="button" @click="loadFormChoices(!!formChoiceCursor)">重试</button></p><p v-else-if="!metricMatches.length&&!formChoiceCursor" class="empty-inline">没有匹配的指标，可以直接新建。</p><button v-if="liveMode&&formChoiceCursor&&!formChoiceError" class="quiet-button" type="button" :disabled="formChoiceLoading" @click="loadFormChoices(true)">加载更多指标</button>
                </div>
                <button type="button" class="metric-create-link" @click="openQuickMetric"><Plus :size="16"/> 新建指标</button>
              </div>
              <div v-if="quickMetricOpen" class="quick-metric">
                <div class="quick-metric-heading"><b>快速新建指标</b><button type="button" class="inline-link" :disabled="quickMetricSaving" @click="quickMetricOpen=false">取消</button></div>
                <label>指标名称<input v-model="quickMetric.name" maxlength="160" placeholder="例如：静息心率" :disabled="quickMetricSaving" @keydown.enter.stop.prevent="saveQuickMetric"/></label>
                <label>记录方式<select v-model="quickMetric.valueType" :disabled="quickMetricSaving"><option v-for="[value,name] in valueTypes" :key="value" :value="value">{{ name }}</option></select></label>
                <label v-if="quickMetric.valueType==='number'">单位（可选）<input v-model="quickMetric.defaultUnit" placeholder="例如：次/分" :disabled="quickMetricSaving" @keydown.enter.stop.prevent="saveQuickMetric"/></label>
                <p v-if="quickMetricError" class="form-error" role="alert">{{ quickMetricError }}</p>
                <button type="button" class="soft-button" :disabled="quickMetricSaving" @click="saveQuickMetric">
                  <span v-if="quickMetricSaving" class="saving-spinner" aria-hidden="true"/><Plus v-else :size="16"/>
                  {{ quickMetricSaving?'正在创建…':'创建并选择' }}
                </button>
              </div>
            </div>
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
            <HealthReferenceSelect v-if="liveMode" :label="formReferenceField==='eventId'?'相关健康事件':'参考资料'"
              :selected-label="formReferenceLabel" :selected-id="formReferenceId" :open="formReferenceOpen"
              :disabled="formOptionsLoading||!!formOptionsError" :search="formReferenceSearch"
              :candidates="formReferenceCandidates" :loading="formChoiceLoading" :error="formChoiceError" :has-more="!!formChoiceCursor"
              @toggle="toggleFormReference" @search="formReferenceSearch=$event" @choose="chooseFormReference"
              @more="loadFormChoices(true)" @retry="loadFormChoices(!!formChoiceCursor)"/>
            <label v-else>参考资料<select v-model="draft.sourceDocumentId" :disabled="formOptionsLoading||!!formOptionsError"><option value="">没有或稍后补充</option><option v-for="d in demo.documents" :key="d.id" :value="d.id">{{ d.title }}</option></select></label>
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
            <label v-if="!editId"><span class="field-label">原始文件 <span class="required-mark" aria-hidden="true">*</span></span><input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" @change="pickFile"/><small v-if="liveMode">支持 PDF、PNG、JPEG、WebP，单个文件最多 15 MB。保存时会安全上传到 LifeSpace。</small><small v-else>仅演示文件名。</small></label><p v-else-if="liveMode" class="helper-copy">原文件已保存，无法在修改资料时替换。如需另一份文件，请新建资料。</p>
            <p v-if="draft.fileName" class="file-picked"><FileText :size="16"/>{{ draft.fileName }}</p>
            <div class="form-two"><label>资料日期<input v-model="draft.issuedDate" type="date"/></label><label>出具机构<input v-model="draft.issuerName" placeholder="选填"/></label></div>
            <HealthReferenceSelect v-if="liveMode" :label="formReferenceField==='eventId'?'相关健康事件':'参考资料'"
              :selected-label="formReferenceLabel" :selected-id="formReferenceId" :open="formReferenceOpen"
              :disabled="formOptionsLoading||!!formOptionsError" :search="formReferenceSearch"
              :candidates="formReferenceCandidates" :loading="formChoiceLoading" :error="formChoiceError" :has-more="!!formChoiceCursor"
              @toggle="toggleFormReference" @search="formReferenceSearch=$event" @choose="chooseFormReference"
              @more="loadFormChoices(true)" @retry="loadFormChoices(!!formChoiceCursor)"/>
            <label v-else>相关健康事件<select v-model="draft.eventId" :disabled="formOptionsLoading||!!formOptionsError"><option value="">不关联</option><option v-for="e in demo.events" :key="e.id" :value="e.id">{{ e.summary }}</option></select></label>
            <label>备注<textarea v-model="draft.notes" rows="2"/></label>
          </template>
          <template v-else-if="editKind==='assessment'">
            <label><span class="field-label">评估标题 <span class="required-mark" aria-hidden="true">*</span></span><input v-model="draft.title" required placeholder="例如：本次检查结果回顾"/></label>
            <label><span class="field-label">评估内容 <span class="required-mark" aria-hidden="true">*</span></span><textarea v-model="draft.content" rows="4" required placeholder="记录医生意见或经确认的总结，不要混作原始数据"/></label>
            <div class="form-two"><label><span class="field-label">评估日期 <span class="required-mark" aria-hidden="true">*</span></span><input v-model="draft.assessedDate" required type="date"/></label><label>状态<select v-model="draft.status"><option v-for="[value,name] in assessmentStatuses" :key="value" :value="value">{{ name }}</option></select></label></div>
            <fieldset v-if="!liveMode" class="check-group"><legend>依据哪些记录？</legend><label v-for="d in demo.documents" :key="d.id" class="checkbox-line"><input v-model="draft.basisIds" type="checkbox" :value="d.id"/>{{ d.title }}</label><label v-for="o in demo.observations.slice(0,5)" :key="o.id" class="checkbox-line"><input v-model="draft.basisIds" type="checkbox" :value="o.id"/>{{ observationTitle(o) }}</label></fieldset>
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
            <HealthReferenceSelect v-if="liveMode" :label="formReferenceField==='eventId'?'相关健康事件':'参考资料'"
              :selected-label="formReferenceLabel" :selected-id="formReferenceId" :open="formReferenceOpen"
              :disabled="formOptionsLoading||!!formOptionsError" :search="formReferenceSearch"
              :candidates="formReferenceCandidates" :loading="formChoiceLoading" :error="formChoiceError" :has-more="!!formChoiceCursor"
              @toggle="toggleFormReference" @search="formReferenceSearch=$event" @choose="chooseFormReference"
              @more="loadFormChoices(true)" @retry="loadFormChoices(!!formChoiceCursor)"/>
            <label v-else>参考资料<select v-model="draft.sourceDocumentId" :disabled="formOptionsLoading||!!formOptionsError"><option value="">无</option><option v-for="d in demo.documents" :key="d.id" :value="d.id">{{ d.title }}</option></select></label>
            <label>方案来源<input v-model="draft.sourceNote" placeholder="例如：个人计划"/></label>
            <label>备注<textarea v-model="draft.notes" rows="2"/></label>
            <p v-if="!liveMode" class="helper-copy">重复提醒尚未接入演示任务。</p>
          </template>
          <fieldset v-if="!liveMode&&editKind!=='metric'&&editKind!=='concern'" class="check-group"><legend>相关健康问题（可多选）</legend><label v-for="c in demo.concerns" :key="c.id" class="checkbox-line"><input v-model="draft.concernIds" type="checkbox" :value="c.id"/>{{ c.name }}</label><p v-if="!demo.concerns.length" class="helper-copy">可以先创建健康问题，后续再关联。</p></fieldset>
          <p v-if="formOptionsLoading" class="helper-copy" role="status">正在读取可选关联记录…</p><p v-if="formOptionsError" class="form-error" role="alert">{{ formOptionsError }} <button type="button" class="inline-link" @click="loadFormOptions(editKind)">重试选项加载</button></p><p v-if="formError" class="form-error" role="alert"><Info :size="16"/>{{ formError }}</p>
          <div v-if="saving && uploadProgress" class="upload-progress" role="status" aria-live="polite" aria-label="文档上传状态">
            <div class="upload-progress-text">
              <span>{{ uploadProgress.phase==='uploading'?'正在上传文件':'文件已发送，正在保存资料' }}</span>
              <strong v-if="uploadProgress.phase==='uploading' && uploadProgress.percent!==null">{{ uploadProgress.percent }}%</strong>
              <span v-else-if="uploadProgress.phase==='processing'"><Check :size="15"/> 已传输 100%</span>
            </div>
            <progress v-if="uploadProgress.phase==='uploading' && uploadProgress.percent!==null" :value="uploadProgress.percent" max="100" aria-label="文件传输百分比"/>
            <progress v-else-if="uploadProgress.phase==='processing'" value="100" max="100" aria-label="文件已传输，正在保存"/>
            <p v-else class="helper-copy">正在传输文件，等待浏览器报告字节进度…</p>
          </div>
          <div class="form-actions"><button type="button" class="quiet-button" :disabled="saving" @click="closeSheet">取消</button><button type="submit" class="primary-button" :disabled="saving||formOptionsLoading||!!formOptionsError" :aria-busy="saving"><span v-if="saving" class="saving-spinner" aria-hidden="true"/><Check v-else :size="17"/> {{ saving?'正在保存…':editId?'保存修改':'保存记录' }}</button></div>
          <p v-if="!liveMode" class="privacy-note"><ShieldCheck :size="15"/> 当前是演示数据，刷新后将恢复示例。</p>
        </form>

        <div v-else-if="sheet==='import' && !liveMode" class="import-flow">
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
    <div v-if="notice" :role="noticeIsError?'alert':'status'" :class="['toast',{'toast-error':noticeIsError}]"><span>{{ notice }}</span><button type="button" aria-label="关闭提示" @click="notice=''"><X :size="17"/></button></div>
  </div>
</template>
