import type { DemoData, HealthKind, HealthEvent, Observation, Regimen } from './demo-model'
import type { HealthModelKey, HealthRecord } from './health-api'

/**
 * ALOHA UI projection only. LifeSpace Model Registry remains the schema authority.
 * Relations, file bytes and task completion are NOT represented by these local arrays.
 */
export const healthModelKey: Record<HealthKind, HealthModelKey> = {
  metric:'health_metric', concern:'health_concern', observation:'health_observation',
  event:'health_event', document:'health_document', assessment:'health_assessment',
  regimen:'health_regimen',
}
export const healthKinds: HealthKind[] =
  ['metric','concern','event','document','observation','regimen','assessment']
export function emptyHealthData(): DemoData {
  return { concerns:[], metrics:[], observations:[], events:[], documents:[], assessments:[], regimens:[] }
}
const str = (v: unknown) => typeof v === 'string' ? v : ''
const optional = (v: unknown) => v === '' || v === undefined ? null : v
const numeric = (v: unknown) => v === '' || v === undefined || v === null ? null : Number(v)
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
const withVersion = (r: HealthRecord) => ({ id:r.id, version:r.version })
const dateOnly = (date: string): string => {
  const d = new Date(date + 'T00:00:00.000Z')
  if (Number.isNaN(d.getTime())) throw new Error('日期无效')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0,10)
}
// Core Instant values are UTC instants. Display them in the viewer's local
// timezone and convert back on save. Never slice UTC ISO strings for form time.
function localDateAndTime(instant:string):{date:string;time:string} {
  const date=new Date(instant)
  if(!Number.isFinite(date.getTime()))throw new Error('事件时间无效')
  const pad=(n:number)=>String(n).padStart(2,'0')
  return {
    date:`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`,
    time:`${pad(date.getHours())}:${pad(date.getMinutes())}`,
  }
}
const recurrenceKind = (v: unknown): Regimen['recurrence'] => {
  const r = record(v)
  return r.mode === 'calendar' && (r.frequency === 'daily' || r.frequency === 'weekly')
    ? r.frequency : 'none'
}

export function decodeHealthRecord(kind: HealthKind, r: HealthRecord): DemoData[keyof DemoData][number] {
  const extra = { ...withVersion(r), concernIds:[] as string[] }
  switch(kind) {
    case 'metric':
      return { ...withVersion(r), name:str(r.name), valueType:r.valueType as 'number'|'text'|'boolean',
        defaultUnit:str(r.defaultUnit), referenceLow:r.referenceLow as number|null|undefined,
        referenceHigh:r.referenceHigh as number|null|undefined, referenceSource:str(r.referenceSource) }
    case 'concern':
      return { ...extra, name:str(r.name), status:r.status as 'active'|'inactive',
        summary:str(r.summary), onsetDate:str(r.onsetDate), resolvedDate:str(r.resolvedDate), notes:str(r.notes) }
    case 'observation':
      return { ...extra, metricId:str(r.metricId), observedDate:str(r.observedDate),
        valueNumber:typeof r.valueNumber === 'number'?r.valueNumber:null, valueText:str(r.valueText),
        valueBoolean:typeof r.valueBoolean==='boolean'?r.valueBoolean:null, unit:str(r.unit),
        referenceLow:r.referenceLow as number|null|undefined, referenceHigh:r.referenceHigh as number|null|undefined,
        referenceSource:str(r.referenceSource), sourceDocumentId:str(r.sourceDocumentId),notes:str(r.notes) }
    case 'event': {
      const when = record(r.when)
      const stamp = str(when.start)
      const instant = when.kind === 'instant'
      const localStart=instant?localDateAndTime(stamp):null
      const localEnd=instant?localDateAndTime(str(when.endExclusive)):null
      return { ...extra, eventType:str(r.eventType), summary:str(r.summary),
        date:localStart?.date??stamp,
        timeStart:localStart?.time??'', timeEnd:localEnd?.time??'',
        location:str(record(r.location).name), description:str(r.description), status:r.status as 'active'|'cancelled' }
    }
    case 'document':
      return { ...extra, title:str(r.title), documentType:str(r.documentType), issuedDate:str(r.issuedDate),
        issuerName:str(r.issuerName), eventId:str(r.eventId), fileName:'已关联 LifeSpace 文件',
        artifactRef:r.artifactRef, notes:str(r.notes) }
    case 'assessment':
      return { ...extra, title:str(r.title), content:str(r.content), assessedDate:str(r.assessedDate),
        status:r.status as 'preliminary'|'final'|'corrected'|'entered_in_error',
        sourceNote:str(r.sourceNote), notes:str(r.notes), basisIds:[] }
    case 'regimen':
      return { ...extra, name:str(r.name), regimenType:str(r.regimenType),
        instructions:str(r.instructions), startDate:str(r.startDate), endDate:str(r.endDate),
        status:r.status as 'active'|'paused'|'completed'|'stopped',
        sourceDocumentId:str(r.sourceDocumentId), sourceNote:str(r.sourceNote), notes:str(r.notes),
        recurrence:recurrenceKind(r.recurrence), firstDueDate:str(r.firstDueDate) }
  }
}

function regimenRecurrence(v: Record<string,unknown>) {
  if (v.recurrence === 'none') return null
  if (v.recurrence === 'daily') return { mode:'calendar',frequency:'daily',interval:1 }
  if (v.recurrence === 'weekly') {
    const day = new Date(String(v.firstDueDate)+'T00:00:00Z').getUTCDay()
    if (!Number.isFinite(day)) throw new Error('请选择有效首次执行日期')
    return { mode:'calendar',frequency:'weekly',interval:1,
      weekdays:[['SU','MO','TU','WE','TH','FR','SA'][day]] }
  }
  throw new Error('当前方案重复规则暂不支持')
}

function eventWhen(v: Record<string,unknown>) {
  const date = str(v.date)
  if (!v.timeStart && !v.timeEnd) return { kind:'date',start:date,endExclusive:dateOnly(date) }
  if (!v.timeStart || !v.timeEnd) throw new Error('请填写完整的时间范围')
  // An absolute instant is required by LifeSpace. Explicit offset conversion
  // uses the browser local timezone; no naive local datetime is sent to Core.
  const start = new Date(date+'T'+v.timeStart+':00')
  const end = new Date(date+'T'+v.timeEnd+':00')
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start)
    throw new Error('健康事件时间范围无效')
  return { kind:'instant',start:start.toISOString(),endExclusive:end.toISOString() }
}
export function encodeHealthFields(
  kind: HealthKind, raw: Record<string,unknown>, subjectPersonId:string,
): Record<string,unknown> {
  const v = raw
  const subject = {subjectPersonId}
  switch(kind) {
    case 'metric':return {
      name:v.name,valueType:v.valueType,defaultUnit:optional(v.defaultUnit),
      referenceLow:numeric(v.referenceLow),referenceHigh:numeric(v.referenceHigh),
      referenceSource:optional(v.referenceSource),
    }
    case 'concern':return {
      ...subject,name:v.name,summary:optional(v.summary),status:v.status,
      onsetDate:optional(v.onsetDate),resolvedDate:optional(v.resolvedDate),notes:optional(v.notes),
    }
    case 'observation':return {
      ...subject,metricId:v.metricId,observedDate:v.observedDate,
      valueNumber:v.valueNumber ?? null,valueText:optional(v.valueText),
      valueBoolean:v.valueBoolean ?? null,unit:optional(v.unit),
      referenceLow:numeric(v.referenceLow),referenceHigh:numeric(v.referenceHigh),
      referenceSource:optional(v.referenceSource),sourceDocumentId:optional(v.sourceDocumentId),
      notes:optional(v.notes),
    }
    case 'event':return {
      ...subject,eventType:v.eventType,summary:v.summary,when:eventWhen(v),status:v.status,
      location:v.location ? {name:v.location} : null,description:optional(v.description),
    }
    case 'document':throw new Error('真实文件上传尚未接入，不能只保存文件名作为健康资料')
    case 'assessment':return {
      ...subject,title:v.title,content:v.content,assessedDate:v.assessedDate,
      status:v.status,sourceNote:optional(v.sourceNote),notes:optional(v.notes),
    }
    case 'regimen':return {
      ...subject,name:v.name,regimenType:v.regimenType,instructions:v.instructions,
      startDate:optional(v.startDate),endDate:optional(v.endDate),status:v.status,
      sourceDocumentId:optional(v.sourceDocumentId),sourceNote:optional(v.sourceNote),
      notes:optional(v.notes),recurrence:regimenRecurrence(v),
      firstDueDate:optional(v.firstDueDate),
    }
  }
}
