/** One bounded Health view; browser cannot supply authority or arbitrary filters. */
export const pageModels=['health_metric','health_document','health_regimen','health_observation'] as const
export type PageModel=typeof pageModels[number]
export const isPageModel=(value:string):value is PageModel=>pageModels.some(model=>model===value)
export function healthPageQuery(model:PageModel,personId:string,params:URLSearchParams){
  const allowed=model==='health_observation'?['limit','cursor','metricId']:['limit','cursor','search']
  if([...params.keys()].some(key=>!allowed.includes(key)||params.getAll(key).length!==1))throw Error('invalid parameters')
  if(!/^per_[A-Za-z0-9_-]+$/.test(personId))throw Error('invalid person')
  const limit=params.get('limit')??'40'
  if(!/^\d{1,2}$/.test(limit)||Number(limit)<1||Number(limit)>50)throw Error('invalid limit')
  const cursor=params.get('cursor')
  if(cursor!==null&&(!cursor||cursor.length>4096))throw Error('invalid cursor')
  const search=params.get('search')?.trim()
  if(search&&search.length>100)throw Error('invalid search')
  const own={field:'subjectPersonId',op:'contains',value:personId}
  const metricId=params.get('metricId')
  if(model==='health_observation'&&(!metricId||! /^[A-Za-z][A-Za-z0-9_-]{2,127}$/.test(metricId)))throw Error('invalid metric')
  const filter=model==='health_metric'?undefined:model==='health_observation'?{and:[own,{field:'metricId',op:'contains',value:metricId}]}:own
  const field=model==='health_metric'?'name':model==='health_document'?'issuedDate':model==='health_regimen'?'startDate':'observedDate'
  return {...(filter?{filter}:{}),...(search?{search:{text:search}}:{}),
    sort:[{field,direction:model==='health_metric'?'asc':'desc'},{field:'updatedAt',direction:'desc'}],
    page:{limit:Number(limit),cursor}}
}
