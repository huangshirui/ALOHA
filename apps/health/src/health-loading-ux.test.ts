import {describe,it,expect} from 'vitest'
import {concernContentState,latestObservationIndex} from './health-loading-ux'
import type {Observation} from './demo-model'
const sample=(id:string,metricId:string,observedDate:string)=>({id,metricId,observedDate} as Observation)
describe('Health loading UX',()=>{
  it('never interprets unfinished or failed dependencies as empty records',()=>{
    expect(concernContentState(true,'idle','idle')).toBe('loading')
    expect(concernContentState(true,'loading','ready')).toBe('loading')
    expect(concernContentState(true,'ready','loading')).toBe('loading')
    expect(concernContentState(true,'ready','error')).toBe('error')
    expect(concernContentState(true,'error','ready')).toBe('error')
    expect(concernContentState(true,'ready','ready')).toBe('ready')
    expect(concernContentState(false,'idle','idle')).toBe('ready')
  })
  it('indexes latest observations independently, preserving same-date first entry',()=>{
    const old=sample('old','a','2020-01-01'),latest=sample('new','a','2021-01-01'),tie=sample('tie','a','2021-01-01'),other=sample('other','b','2020-02-02')
    const rows=[old,latest,tie,other]
    const result=latestObservationIndex(rows)
    expect(result.get('a')).toBe(latest)
    expect(result.get('b')).toBe(other)
    expect(result.get('missing')).toBeUndefined()
    expect(rows).toEqual([old,latest,tie,other])
  })
})
