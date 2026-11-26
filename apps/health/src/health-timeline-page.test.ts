import {describe,it,expect} from 'vitest'
import {mergeTimelinePage,newTimelineStreams} from './health-timeline-page'
import type {TimelineKind,TimelineEntry} from './health-timeline'
const row=(kind:TimelineKind,id:string,date:string,title=id):TimelineEntry=>({kind,id,date,title,meta:''})
describe('timeline merge',()=>{
  it('keeps each cursor and buffered records across globally ordered pages',async()=>{
    const obs=[row('observation','o1','2026-04-01'),row('observation','o2','2026-02-01')]
    const event=[row('event','e1','2026-03-01'),row('event','e2','2026-01-01')]
    const assessment=[row('assessment','a1','2026-04-01')]
    const read=async(kind:TimelineKind,cursor:string|null)=>kind==='observation'?
      {items:cursor?[obs[1]!]:[obs[0]!],nextCursor:cursor?null:'next'}:
      {items:kind==='event'?event:assessment,nextCursor:null}
    const original=newTimelineStreams('all')
    const first=await mergeTimelinePage(original,read,'',new Set(),2)
    expect(first.items.map(x=>x.id)).toEqual(['o1','a1'])
    expect(first.hasMore).toBe(true)
    expect(original.every(s=>!s.started)).toBe(true)
    const second=await mergeTimelinePage(first.streams,read,'',new Set(first.items.map(x=>x.kind+':'+x.id)),10)
    expect(second.items.map(x=>x.id)).toEqual(['e1','o2','e2'])
    expect(second.hasMore).toBe(false)
  })
  it('does not report exhausted search after a bounded scan with no matches',async()=>{
    const read=async(_kind:TimelineKind,cursor:string|null)=>({items:cursor?[row('event','b','2026-01-01','match')]:[row('event','a','2026-02-01')],nextCursor:cursor?null:'next'})
    const first=await mergeTimelinePage(newTimelineStreams('event'),read,'match',new Set(),30,1)
    expect(first.items).toEqual([]);expect(first.hasMore).toBe(true)
    const second=await mergeTimelinePage(first.streams,read,'match',new Set())
    expect(second.items.map(x=>x.id)).toEqual(['b']);expect(second.hasMore).toBe(false)
  })
  it('keeps original continuation on a failed stream',async()=>{
    const streams=newTimelineStreams('all')
    await expect(mergeTimelinePage(streams,async()=>{throw Error('failed')},'',new Set())).rejects.toThrow('failed')
    expect(streams.every(s=>!s.started&&s.buffer.length===0)).toBe(true)
  })
})
