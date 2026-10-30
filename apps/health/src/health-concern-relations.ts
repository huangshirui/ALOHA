/** ALOHA Health's narrow projection of LifeSpace Semantic Relation.
 * An edge is shared reality in LifeSpace; it is never a Health model field.
 * Always create directed edges FROM HealthConcern to the selected record.
 */
export const concernTargetModels = {
  metric:'health_metric',
  observation:'health_observation',
  event:'health_event',
  document:'health_document',
  assessment:'health_assessment',
  regimen:'health_regimen',
} as const

export type ConcernTargetKind=keyof typeof concernTargetModels
export const concernTargetKinds=Object.keys(concernTargetModels) as ConcernTargetKind[]

export interface ConcernRelation {
  id:string
  spaceId:string
  source:{kind:'record';modelKey:'health_concern';recordId:string}
  predicate:'monitors'|'relates_to'
  target:{kind:'record';modelKey:typeof concernTargetModels[ConcernTargetKind];recordId:string}
  createdAt:string
}

export function isConcernTargetKind(value:unknown):value is ConcernTargetKind {
  return typeof value==='string' && Object.hasOwn(concernTargetModels,value)
}
export function concernRelationInput(concernId:string,kind:ConcernTargetKind,targetId:string){
  if(!/^rec_[A-Za-z0-9_-]+$/.test(concernId)||!/^rec_[A-Za-z0-9_-]+$/.test(targetId))
    throw new Error('Invalid relation record ID')
  return {
    source:{kind:'record' as const,modelKey:'health_concern' as const,recordId:concernId},
    predicate:kind==='metric'?'monitors' as const:'relates_to' as const,
    target:{kind:'record' as const,modelKey:concernTargetModels[kind],recordId:targetId},
  }
}
export function isConcernRelation(value:unknown,concernId:string):value is ConcernRelation{
  if(!value||typeof value!=='object')return false
  const edge=value as Partial<ConcernRelation>
  if(typeof edge.id!=='string'||!/^rel_[A-Za-z0-9_-]+$/.test(edge.id)||
     !edge.source||!edge.target||
     edge.source.kind!=='record'||edge.source.modelKey!=='health_concern'||
     edge.source.recordId!==concernId||
     edge.target.kind!=='record'||typeof edge.target.recordId!=='string')return false
  const kind=concernTargetKinds.find(k=>concernTargetModels[k]===edge.target!.modelKey)
  return !!kind&&edge.predicate===(kind==='metric'?'monitors':'relates_to')
}
export function concernTargetHasRelation(
  relations:readonly ConcernRelation[],kind:ConcernTargetKind,targetId:string,
):boolean {
  return relations.some(r=>r.target.modelKey===concernTargetModels[kind]&&r.target.recordId===targetId)
}
