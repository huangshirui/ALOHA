/** UI-only projection of the three dated Health record types.
 * Timeline does not create or own another LifeSpace record/model.
 */
export type TimelineKind = 'observation' | 'event' | 'assessment'
export type TimelineFilter = 'all' | TimelineKind

export interface TimelineEntry {
  id: string
  kind: TimelineKind
  date: string // YYYY-MM-DD in the source record; date-only, not an invented time
  title: string
  meta: string
}

export interface TimelineDay {
  date: string
  day: string
  weekday: string
  entries: TimelineEntry[]
}
export interface TimelineMonth {
  key: string
  label: string
  count: number
  days: TimelineDay[]
}

const datePattern=/^(\d{4})-(\d{2})-(\d{2})$/
const weekdayNames=['周日','周一','周二','周三','周四','周五','周六'] as const

function dateParts(date:string):{key:string;day:string;weekday:string}|null {
  const match=datePattern.exec(date)
  if(!match)return null
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3])
  const utc=new Date(Date.UTC(year,month-1,day))
  if(utc.getUTCFullYear()!==year||utc.getUTCMonth()!==month-1||utc.getUTCDate()!==day)return null
  return {key:date.slice(0,7),day:String(day),weekday:weekdayNames[utc.getUTCDay()]!}
}

/** Newest dates first, same-day records in stable source order. */
export function groupTimeline(entries:ReadonlyArray<TimelineEntry>,selected:TimelineFilter='all'):TimelineMonth[] {
  const sorted=entries
    .filter(e=>selected==='all'||e.kind===selected)
    .map((entry,order)=>({entry,order}))
    .sort((a,b)=>{
      const ad=dateParts(a.entry.date)?a.entry.date:''
      const bd=dateParts(b.entry.date)?b.entry.date:''
      return bd.localeCompare(ad)||a.order-b.order
    })
  const months:TimelineMonth[]=[]
  for(const {entry} of sorted){
    const date=dateParts(entry.date)
    const monthKey=date?.key??'undated'
    let month=months[months.length-1]
    if(!month||month.key!==monthKey){
      month={
        key:monthKey,
        label:date?`${Number(date.key.slice(0,4))}年${Number(date.key.slice(5,7))}月`:'未填写日期',
        count:0,
        days:[],
      }
      months.push(month)
    }
    month.count++
    const dayKey=date?entry.date:'undated'
    let day=month.days[month.days.length-1]
    if(!day||day.date!==dayKey){
      day={date:dayKey,day:date?.day??'—',weekday:date?.weekday??'',entries:[]}
      month.days.push(day)
    }
    day.entries.push(entry)
  }
  return months
}
