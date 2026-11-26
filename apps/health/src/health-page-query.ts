/** One bounded Health view; browser cannot supply authority or arbitrary filters. */
export const pageModels=['health_metric','health_document','health_regimen','health_observation','health_event','health_assessment'] as const
export type PageModel=typeof pageModels[number]
export const isPageModel=(value:string):value is PageModel=>pageModels.some(model=>model===value)
export function healthPageQuery(model:PageModel,personId:string,params:URLSearchParams){
  const allowed=model==='health_observation'?['limit','cursor','metricId','view','from','to']:model==='health_event'?['limit','cursor','search','timezone']:['limit','cursor','search']
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
  const view=params.get('view'),from=params.get('from'),to=params.get('to')
  const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value
  if(model==='health_observation'){
    if(view!==null&&view!=='timeline'&&view!=='picker')throw Error('invalid observation view')
    if(view===null&&(!metricId||! /^[A-Za-z][A-Za-z0-9_-]{2,127}$/.test(metricId)))throw Error('invalid metric')
    if(view!==null&&(metricId||from||to))throw Error('conflicting observation view')
    if((from!==null&&!validDate(from))||(to!==null&&!validDate(to))||(from&&to&&from>to))throw Error('invalid date window')
  }
  const predicates=[own]
  if(metricId)predicates.push({field:'metricId',op:'contains',value:metricId})
  if(from)predicates.push({field:'observedDate',op:'gte',value:from})
  if(to)predicates.push({field:'observedDate',op:'lte',value:to})
  const filter=model==='health_metric'?undefined:predicates.length===1?own:{and:predicates}
  const field=model==='health_metric'?'name':model==='health_document'?'issuedDate':model==='health_regimen'?'startDate':model==='health_event'?'when':model==='health_assessment'?'assessedDate':'observedDate'
  const timezone=params.get('timezone')
  if(model==='health_event'){
    if(!timezone||timezone.length>80)throw Error('viewing timezone required')
    try{new Intl.DateTimeFormat('en',{timeZone:timezone})}catch{throw Error('invalid viewing timezone')}
  }
  return {...(filter?{filter}:{}),...(search?{search:{text:search}}:{}),
    ...(model==='health_event'?{context:{viewingTimezone:timezone}}:{}),
    sort:[{field,direction:model==='health_metric'?'asc':'desc'},{field:'updatedAt',direction:'desc'}],
    page:{limit:Number(limit),cursor}}
}

/** 20 relation predicates leave room for Core's 100-binding limit and cursor tuple. */
export const METRIC_PAGE_SIZE=20
export function summaryMetricIds(params:URLSearchParams):string[]{
  if([...params.keys()].some(key=>key!=='metricIds')||params.getAll('metricIds').length!==1)throw Error('invalid parameters')
  const ids=(params.get('metricIds')??'').split(',')
  if(ids.length>METRIC_PAGE_SIZE||new Set(ids).size!==ids.length||ids.some(id=>! /^[A-Za-z][A-Za-z0-9_-]{2,127}$/.test(id)))throw Error('invalid metrics')
  return ids
}
export function metricSummaryQuery(personId:string,ids:string[],cursor:string|null){
  return {filter:{and:[
    {field:'subjectPersonId',op:'contains',value:personId},
    {or:ids.map(id=>({field:'metricId',op:'contains',value:id}))},
  ]},sort:[{field:'observedDate',direction:'desc'},{field:'updatedAt',direction:'desc'}],
    page:{limit:200,cursor}}
}
