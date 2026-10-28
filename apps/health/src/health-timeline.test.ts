import { describe, expect, it } from 'vitest'
import { groupTimeline, type TimelineEntry } from './health-timeline'

const entries:TimelineEntry[]=[
  {id:'o-1',kind:'observation',date:'2026-09-14',title:'体重 · 67.8 kg',meta:'测量记录'},
  {id:'e-1',kind:'event',date:'2026-10-16',title:'年度检查',meta:'检查'},
  {id:'o-2',kind:'observation',date:'2026-10-20',title:'体重 · 67.2 kg',meta:'测量记录'},
  {id:'a-1',kind:'assessment',date:'2026-10-20',title:'阶段记录回顾',meta:'评估记录'},
  {id:'o-3',kind:'observation',date:'2026-10-18',title:'收缩压 · 117 mmHg',meta:'测量记录'},
]

describe('Health timeline — date-only source facts',()=>{
  it('groups newest month/day first, retaining same-day source order',()=>{
    const result=groupTimeline(entries)
    expect(result.map(m=>m.key)).toEqual(['2026-10','2026-09'])
    expect(result[0]?.label).toBe('2026年10月')
    expect(result[0]?.count).toBe(4)
    expect(result[0]?.days.map(d=>d.date)).toEqual(['2026-10-20','2026-10-18','2026-10-16'])
    expect(result[0]?.days[0]?.entries.map(e=>e.id)).toEqual(['o-2','a-1'])
    expect(result[1]?.days[0]?.entries.map(e=>e.id)).toEqual(['o-1'])
    expect(entries[0]?.id).toBe('o-1') // not mutated by sorting
  })
  it('filters by record kind without changing the source records',()=>{
    expect(groupTimeline(entries,'observation').flatMap(m=>m.days.flatMap(d=>d.entries)).map(e=>e.id))
      .toEqual(['o-2','o-3','o-1'])
    expect(groupTimeline(entries,'event')[0]?.days[0]?.entries[0]?.kind).toBe('event')
    expect(groupTimeline(entries,'assessment')[0]?.days[0]?.entries[0]?.title).toBe('阶段记录回顾')
    expect(groupTimeline([], 'all')).toEqual([])
  })
  it('shows valid weekdays and keeps unknown date in a separate last group',()=>{
    const records:TimelineEntry[]=[
      {id:'bad',kind:'event',date:'2026-02-30',title:'无效日期',meta:'事件'},
      {id:'missing',kind:'event',date:'',title:'日期未填写',meta:'事件'},
      {id:'ok',kind:'event',date:'2024-02-29',title:'示例日期',meta:'事件'},
    ]
    const result=groupTimeline(records)
    expect(result[0]?.label).toBe('2024年2月')
    expect(result[0]?.days[0]?.day).toBe('29')
    expect(result[0]?.days[0]?.weekday).toBe('周四')
    expect(result[1]?.label).toBe('未填写日期')
    expect(result[1]?.count).toBe(2)
    expect(result[1]?.days[0]?.entries.map(e=>e.id)).toEqual(['bad','missing'])
  })
})
