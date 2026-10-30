/** Contract-aligned Core Canonical Query projection for the Health Snapshot.
 * Models and query operands are exclusively selected by the trusted BFF.
 * Do not replace Core's current Space/Grant/Application authorization.
 */
export const snapshotModelKeys = [
  'health_metric','health_concern','health_event','health_document',
  'health_observation','health_regimen','health_assessment',
] as const
export type SnapshotModelKey = typeof snapshotModelKeys[number]

export function healthSnapshotQuery(model:SnapshotModelKey,personId:string,cursor:string|null) {
  const personScoped = model!=='health_metric'
  if(personScoped&&!/^per_[A-Za-z0-9_-]+$/.test(personId))
    throw new Error('Invalid verified Space Person')
  return {
    ...(personScoped?{filter:{field:'subjectPersonId',op:'contains' as const,value:personId}}:{}),
    sort:[{field:'updatedAt',direction:'desc' as const}],
    page:{limit:200,cursor},
  }
}
