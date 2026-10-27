/** UX navigation/action policy for the first seven health models.
 * The labels describe what the user does; no database/model vocabulary is shown.
 */
export type BodySection = 'overview'|'concerns'|'metrics'|'timeline'|'documents'|'regimens'
export type CreationAction = 'observation'|'event'|'assessment'|'concern'|'metric'|'document'|'regimen'
export interface CreateChoice { id: CreationAction; label: string; hint: string }

export const recordChoices: ReadonlyArray<CreateChoice> = [
  { id:'observation', label:'测量记录', hint:'体重、血压等指标结果' },
  { id:'event', label:'健康事件', hint:'症状、检查或就诊经历' },
  { id:'assessment', label:'健康评估', hint:'整理已有资料和判断依据' },
]

export type PrimaryAction =
  | { mode:'menu'; label:string; choices:ReadonlyArray<CreateChoice> }
  | { mode:'direct'; label:string; action:CreationAction }

export function primaryAction(section:BodySection):PrimaryAction {
  switch(section) {
    case 'overview': return {mode:'menu',label:'记录',choices:recordChoices}
    case 'timeline': return {mode:'menu',label:'新增记录',choices:recordChoices}
    case 'concerns': return {mode:'direct',label:'添加健康问题',action:'concern'}
    case 'metrics': return {mode:'direct',label:'新增指标',action:'metric'}
    case 'documents': return {mode:'direct',label:'添加资料',action:'document'}
    case 'regimens': return {mode:'direct',label:'新建方案',action:'regimen'}
  }
}

/** Route history is UI-only. It avoids losing the originating concern/metric
 * when entering an observation or document and pressing Back. */
export interface HealthLocation {
  tab:'home'|'body'|'food'|'movement'
  section:BodySection
  record:null|{kind:CreationAction;id:string}
}
export function saveDestination(kind:CreationAction,id:string):HealthLocation['record'] {
  return {kind,id}
}
