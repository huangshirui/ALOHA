import {describe,expect,it} from 'vitest'
import {dateTimestamp,trendReadings,referenceBounds,trendDomain,type NumericObservation} from './metric-trend'
const reading=(id:string,observedDate:string,valueNumber:number|null,status='final'):NumericObservation=>({id,observedDate,valueNumber,status})
describe('Health trend projection',()=>{
 it('preserves each same-day reading, gaps and actual dates without mutation',()=>{
  const input=[reading('c','2024-03-01',12),reading('b','2022-01-01',8),reading('a','2022-01-01',6)]
  const before=JSON.stringify(input),points=trendReadings(input)
  expect(points.map(p=>[p.id,p.date,p.value])).toEqual([['a','2022-01-01',6],['b','2022-01-01',8],['c','2024-03-01',12]])
  expect(JSON.stringify(input)).toBe(before)
 })
 it('excludes invalid dates, nonfinite, null and entered-in-error readings',()=>{
  expect(trendReadings([reading('a','2023-02-29',1),reading('b','2024-02-29',null),reading('c','2024-02-29',Infinity),reading('d','2024-02-29',1,'entered_in_error'),reading('e','2024-02-29',0)])).toMatchObject([{id:'e',value:0}])
  expect(dateTimestamp('2024-02-29')).toBe(Date.UTC(2024,1,29))
 })
 it('uses calendar dates and requested extent, including empty calendar periods',()=>{
  const points=trendReadings([reading('a','2024-01-02',7),reading('b','2024-03-04',8)])
  expect(trendDomain(points,'2023-03-04','2024-03-04')).toEqual({min:Date.UTC(2023,2,4),max:Date.UTC(2024,2,4)})
  expect(trendDomain(points)).toEqual({min:Date.UTC(2024,0,2),max:Date.UTC(2024,2,4)})
  expect(trendDomain([])).toBeUndefined()
  expect(trendDomain(points.slice(0,1))).toEqual({min:Date.UTC(2024,0,1),max:Date.UTC(2024,0,3)})
 })
 it('handles valid, missing, equal, inverted and nonfinite reference limits',()=>{
  expect(referenceBounds(3,5)).toEqual({low:3,high:5})
  expect(referenceBounds(undefined,5)).toEqual({low:undefined,high:5})
  expect(referenceBounds(3,3)).toEqual({low:3,high:3})
  expect(referenceBounds(5,3)).toEqual({})
  expect(referenceBounds(Infinity,5)).toEqual({low:undefined,high:5})
 })
})
