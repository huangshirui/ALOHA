import {describe,expect,it} from 'vitest'
import {
 aggregateTrend,buildTrendChart,smoothPath,selectedTrendPoint,
 type NumericObservation,
} from './metric-trend'

const readings:NumericObservation[]=[
 {id:'o1',observedDate:'2025-01-02',valueNumber:80,status:'final'},
 {id:'o2',observedDate:'2025-01-04',valueNumber:100,status:'final'},
 {id:'o3',observedDate:'2025-03-10',valueNumber:120,status:'final'},
 {id:'o4',observedDate:'2026-02-01',valueNumber:140,status:'final'},
]

describe('Health metric trends — true observation dates',()=>{
 it('groups actual numeric readings per day, month and year',()=>{
   expect(aggregateTrend(readings,'day').map(p=>p.key))
    .toEqual(['2025-01-02','2025-01-04','2025-03-10','2026-02-01'])
   const months=aggregateTrend(readings,'month')
   expect(months.map(p=>p.key)).toEqual(['2025-01','2025-03','2026-02'])
   expect(months[0]).toMatchObject({value:90,count:2,recordIds:['o1','o2']})
   const years=aggregateTrend(readings,'year')
   expect(years.map(p=>p.key)).toEqual(['2025','2026'])
   expect(years[0]).toMatchObject({value:100,count:3})
   expect(years[1]?.value).toBe(140)
 })
 it('never fills missing calendar buckets with synthetic points',()=>{
   const months=buildTrendChart(readings,'month')
   expect(months.points.map(p=>p.key)).toEqual(['2025-01','2025-03','2026-02'])
   expect(months.points.some(p=>p.key==='2025-02')).toBe(false)
   expect(months.points[1]!.x-months.points[0]!.x).toBeLessThan(months.points[2]!.x-months.points[1]!.x)
   expect((months.path.match(/ C /g)||[]).length).toBe(2)
   expect(months.points[1]!.count).toBe(1)
 })
 it('ignores invalid, entered-in-error, missing, and non-numeric observations',()=>{
   const bad:NumericObservation[]=[
     {id:'a',observedDate:'2026-02-30',valueNumber:10,status:'final'},
     {id:'b',observedDate:'2026-02-01',valueNumber:null,status:'final'},
     {id:'c',observedDate:'2026-02-01',valueNumber:Infinity,status:'final'},
     {id:'d',observedDate:'2026-02-01',valueNumber:200,status:'entered_in_error'},
   ]
   expect(aggregateTrend(bad,'day')).toEqual([])
   expect(buildTrendChart(bad,'month')).toMatchObject({points:[],path:'',domain:null})
 })
 it('one point creates no interpolated line or future extrapolation',()=>{
   const points=buildTrendChart(readings.slice(0,1),'year').points
   expect(points).toHaveLength(1)
   expect(smoothPath(points)).toMatch(/^M /)
   expect(smoothPath(points)).not.toContain(' C ')
   expect(smoothPath([])).toBe('')
 })
 it('a smoothed connection preserves control values and has no overshoot',()=>{
   expect(smoothPath([{x:0,y:10},{x:30,y:90}]))
     .toBe('M 0 10 C 10 10, 20 90, 30 90')
   expect(smoothPath([{x:0,y:90},{x:30,y:10}]))
     .toBe('M 0 90 C 10 90, 20 10, 30 10')
 })
 it('shows an observation readout only after an explicit point selection',()=>{
   const points=buildTrendChart(readings,'day').points
   // Latest reading already appears in the hero. Never repeat it under the chart by default.
   expect(selectedTrendPoint(points,'')).toBeNull()
   expect(selectedTrendPoint(points,'2026-02-01')).toMatchObject({
     key:'2026-02-01',value:140,count:1,recordIds:['o4'],
   })
   expect(selectedTrendPoint(points,'2099-01-01')).toBeNull()
   // After changing from day to month, an old day-level selection must be cleared.
   const monthly=buildTrendChart(readings,'month').points
   expect(selectedTrendPoint(monthly,'2026-02-01')).toBeNull()
 })
 it('does not mutate the source readings',()=>{
   const before=JSON.stringify(readings)
   buildTrendChart(readings,'day')
   expect(JSON.stringify(readings)).toBe(before)
 })
})
