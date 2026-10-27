/**
 * ALOHA Health demo domain.
 * Synthetic UI records only; never persist, upload or treat as authoritative health data.
 * Canonical LifeSpace health schemas remain owned by the platform, not this prototype.
 */
export type HealthKind = 'concern' | 'metric' | 'observation' | 'event' | 'document' | 'assessment' | 'regimen'
export type HealthStatus = 'active' | 'inactive'
export type MetricValueType = 'number' | 'text' | 'boolean'
export type ObservationStatus = 'preliminary' | 'final' | 'corrected' | 'entered_in_error'
export type RegimenStatus = 'active' | 'paused' | 'completed' | 'stopped'

export interface SharedRecord {
  id: string
  concernIds: string[] // UI-only semantic relation indexes, not LifeSpace model fields
}
export interface Concern extends SharedRecord {
  name: string
  summary: string
  status: HealthStatus
  onsetDate: string
  resolvedDate: string
  notes: string
}
export interface Metric {
  id: string
  name: string
  valueType: MetricValueType
  defaultUnit: string
}
export interface Observation extends SharedRecord {
  metricId: string
  observedDate: string
  valueNumber: number | null
  valueText: string
  valueBoolean: boolean | null
  unit: string
  interpretation: string
  status: ObservationStatus
  sourceDocumentId: string
  sourceNote: string
  notes: string
}
export interface HealthEvent extends SharedRecord {
  eventType: string
  summary: string
  date: string // UI demo; canonical HealthEvent.when is temporal_range
  timeStart: string // optional start time; blank means date-only
  timeEnd: string // optional end time; blank means date-only
  location: string // UI demo; canonical HealthEvent.location is a structured location
  description: string
  status: 'active' | 'cancelled'
}
export interface HealthDocument extends SharedRecord {
  title: string
  documentType: string
  issuedDate: string
  issuerName: string
  eventId: string
  fileName: string // demo filename only; canonical artifactRef is a platform File reference
  notes: string
}
export interface Assessment extends SharedRecord {
  title: string
  content: string
  assessedDate: string
  status: ObservationStatus
  sourceNote: string
  notes: string
  basisIds: string[] // UI-only based_on relation indexes
}
export interface Regimen extends SharedRecord {
  name: string
  regimenType: string
  instructions: string
  startDate: string
  endDate: string
  status: RegimenStatus
  sourceDocumentId: string
  sourceNote: string
  notes: string
  recurrence: 'none' | 'daily' | 'weekly' // UI facade for platform recurrence_rule
  firstDueDate: string
}
export interface DemoData {
  concerns: Concern[]
  metrics: Metric[]
  observations: Observation[]
  events: HealthEvent[]
  documents: HealthDocument[]
  assessments: Assessment[]
  regimens: Regimen[]
}
export const eventTypes = [
  ['symptom','不适症状'],['injury','受伤'],['visit','就诊'],['examination','检查'],['procedure','医疗操作'],
  ['treatment','治疗'],['medication_intake','服药记录'],['vaccination','疫苗接种'],['rehabilitation','康复'],['other','其他'],
] as const
export const documentTypes = [
  ['lab_report','化验报告'],['imaging_report','影像报告'],['physical_exam','体检报告'],
  ['prescription','处方'],['visit_note','门诊记录'],['discharge_summary','出院记录'],
  ['rehabilitation_plan','康复计划'],['other','其他资料'],
] as const
export const regimenTypes = [
  ['medication','用药'],['rehabilitation','康复'],['therapy','治疗'],['device','辅助设备'],['wellness','生活方式'],['other','其他'],
] as const
export const observationStatuses = [
  ['preliminary','待核实'],['final','已确认'],['corrected','已更正'],['entered_in_error','无效记录'],
] as const
export const regimenStatuses = [
  ['active','进行中'],['paused','已暂停'],['completed','已完成'],['stopped','已停止'],
] as const
export const valueTypes = [['number','数值'],['text','文本'],['boolean','是 / 否']] as const
export const interpretationTypes = [
  ['','不标记'],['low','偏低'],['normal','正常'],['high','偏高'],['borderline','临界'],
  ['abnormal','异常'],['critical','危急'],['positive','阳性'],['negative','阴性'],['indeterminate','不确定'],['unknown','未知'],
] as const

export function labelFrom(options: ReadonlyArray<readonly [string,string]>, value: string) {
  return options.find(([key]) => key === value)?.[1] ?? value
}
export function observationValue(item: Observation, metric?: Metric): string {
  if (item.valueNumber !== null) return item.valueNumber + (item.unit || metric?.defaultUnit ? ' ' + (item.unit || metric?.defaultUnit || '') : '')
  if (item.valueBoolean !== null) return item.valueBoolean ? '是' : '否'
  return item.valueText
}
export function validateObservation(metric: Metric | undefined, raw: string): string | null {
  if (!metric) return '请先选择指标'
  if (metric.valueType === 'number') {
    if (!raw.trim() || !Number.isFinite(Number(raw.trim()))) return '请输入有效的数值'
  } else if (metric.valueType === 'text' && !raw.trim()) return '请输入记录内容'
  else if (metric.valueType === 'boolean' && raw !== 'true' && raw !== 'false') return '请选择是或否'
  return null
}
export function validatePeriod(start: string, end: string): string | null {
  if (start && end && end < start) return '结束日期不能早于开始日期'
  return null
}
export function validateEventTime(start: string, end: string): string | null {
  if (!start && !end) return null
  if (!start || !end) return '如需记录具体时间，请填写开始和结束时间'
  if (end <= start) return '结束时间必须晚于开始时间'
  return null
}
export function validateRegimen(start: string, end: string, repeat: Regimen['recurrence'], first: string): string | null {
  const periodError = validatePeriod(start, end)
  if (periodError) return periodError
  if (repeat !== 'none' && !first) return '设置重复计划时，请选择首次执行日期'
  if (repeat !== 'none' && first && end && first > end) return '首次执行日期不能晚于结束日期'
  return null
}
export function validateConcern(onset: string, resolved: string): string | null {
  return validatePeriod(onset, resolved)
}
export function buildObservationValue(metric: Metric, raw: string): Pick<Observation,'valueNumber'|'valueText'|'valueBoolean'> {
  return {
    valueNumber: metric.valueType === 'number' ? Number(raw) : null,
    valueText: metric.valueType === 'text' ? raw.trim() : '',
    valueBoolean: metric.valueType === 'boolean' ? raw === 'true' : null,
  }
}
export function makeEmpty(kind: HealthKind, date: string): Record<string, unknown> {
  switch (kind) {
    case 'concern': return { name:'',summary:'',status:'active',onsetDate:'',resolvedDate:'',notes:'',concernIds:[] }
    case 'metric': return { name:'',valueType:'number',defaultUnit:'' }
    case 'observation': return { metricId:'',observedDate:date,value:'',unit:'',interpretation:'',status:'final',sourceDocumentId:'',sourceNote:'',notes:'',concernIds:[] }
    case 'event': return { eventType:'visit',summary:'',date,timeStart:'',timeEnd:'',location:'',description:'',status:'active',concernIds:[] }
    case 'document': return { title:'',documentType:'lab_report',issuedDate:date,issuerName:'',eventId:'',fileName:'',notes:'',concernIds:[] }
    case 'assessment': return { title:'',content:'',assessedDate:date,status:'final',sourceNote:'',notes:'',basisIds:[],concernIds:[] }
    case 'regimen': return { name:'',regimenType:'wellness',instructions:'',startDate:date,endDate:'',status:'active',sourceDocumentId:'',sourceNote:'',notes:'',recurrence:'none',firstDueDate:'',concernIds:[] }
  }
}

export function seedDemo(): DemoData {
  return {
    concerns: [
      { id:'c-1',name:'血压观察',summary:'定期记录血压，关注长期变化。',status:'active',onsetDate:'2026-08-01',resolvedDate:'',notes:'',concernIds:[] },
      { id:'c-2',name:'运动恢复',summary:'观察训练与恢复的关系，逐步增加活动量。',status:'active',onsetDate:'2026-09-10',resolvedDate:'',notes:'',concernIds:[] },
    ],
    metrics: [
      { id:'m-1',name:'体重',valueType:'number',defaultUnit:'kg' },
      { id:'m-2',name:'收缩压',valueType:'number',defaultUnit:'mmHg' },
      { id:'m-3',name:'舒适程度',valueType:'text',defaultUnit:'' },
      { id:'m-4',name:'今日不适',valueType:'boolean',defaultUnit:'' },
    ],
    observations: [
      { id:'o-1',metricId:'m-2',observedDate:'2026-08-11',valueNumber:123,valueText:'',valueBoolean:null,unit:'mmHg',interpretation:'',status:'final',sourceDocumentId:'',sourceNote:'手动记录',notes:'',concernIds:['c-1'] },
      { id:'o-2',metricId:'m-2',observedDate:'2026-09-12',valueNumber:119,valueText:'',valueBoolean:null,unit:'mmHg',interpretation:'',status:'final',sourceDocumentId:'',sourceNote:'手动记录',notes:'',concernIds:['c-1'] },
      { id:'o-3',metricId:'m-2',observedDate:'2026-10-18',valueNumber:117,valueText:'',valueBoolean:null,unit:'mmHg',interpretation:'',status:'final',sourceDocumentId:'',sourceNote:'手动记录',notes:'',concernIds:['c-1'] },
      { id:'o-4',metricId:'m-1',observedDate:'2026-09-14',valueNumber:67.8,valueText:'',valueBoolean:null,unit:'kg',interpretation:'',status:'final',sourceDocumentId:'',sourceNote:'',notes:'',concernIds:[] },
      { id:'o-5',metricId:'m-1',observedDate:'2026-10-20',valueNumber:67.2,valueText:'',valueBoolean:null,unit:'kg',interpretation:'',status:'final',sourceDocumentId:'',sourceNote:'',notes:'',concernIds:[] },
    ],
    events: [
      { id:'e-1',eventType:'examination',summary:'年度检查',date:'2026-10-16',timeStart:'',timeEnd:'',location:'演示健康中心',description:'留存检查资料，回顾整体情况。',status:'active',concernIds:['c-1'] },
    ],
    documents: [
      { id:'d-1',title:'年度检查记录（示例）',documentType:'physical_exam',issuedDate:'2026-10-16',issuerName:'演示健康中心',eventId:'e-1',fileName:'sample-checkup.pdf',notes:'虚构示例，没有实际文件。',concernIds:['c-1'] },
    ],
    assessments: [
      { id:'a-1',title:'阶段记录回顾',content:'这是一段演示文字，用于展示评估和来源记录的区别；不构成医学建议。',assessedDate:'2026-10-20',status:'final',sourceNote:'仅用于产品演示',notes:'',basisIds:['d-1','o-3'],concernIds:['c-1'] },
    ],
    regimens: [
      { id:'r-1',name:'每周轻活动计划',regimenType:'rehabilitation',instructions:'根据当天身体感受安排轻量活动，必要时调整。',startDate:'2026-10-01',endDate:'',status:'active',sourceDocumentId:'',sourceNote:'演示计划',notes:'',recurrence:'weekly',firstDueDate:'2026-10-02',concernIds:['c-2'] },
    ],
  }
}
