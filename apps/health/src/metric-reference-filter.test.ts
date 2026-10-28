import {describe,expect,it} from 'vitest'
import {matchMetricReferenceFilter,metricReferenceState} from './metric-reference-filter'
const metric={valueType:'number',defaultUnit:'cm',referenceLow:100,referenceHigh:150,referenceSource:'虚构演示'}
const reading={valueNumber:120,unit:'cm',status:'final'}
describe('Metric status filters represent range comparisons, not medical diagnoses',()=>{
 it('classifies the latest comparable reading as within or outside',()=>{
  expect(metricReferenceState(metric,reading)).toBe('within')
  expect(metricReferenceState(metric,{...reading,valueNumber:90})).toBe('outside')
  expect(metricReferenceState(metric,{...reading,valueNumber:170})).toBe('outside')
 })
 it('separates unknown from both normal-like and abnormal-like filters',()=>{
  expect(metricReferenceState(metric,null)).toBe('unknown')
  expect(metricReferenceState({...metric,referenceLow:null,referenceHigh:null},reading)).toBe('unknown')
  expect(metricReferenceState(metric,{...reading,unit:'inch'})).toBe('unknown')
  expect(metricReferenceState(metric,{...reading,status:'entered_in_error'})).toBe('unknown')
  expect(metricReferenceState({...metric,valueType:'text'},reading)).toBe('unknown')
 })
 it('matches only its selected filter, all includes unknown',()=>{
  expect(matchMetricReferenceFilter('outside','outside')).toBe(true)
  expect(matchMetricReferenceFilter('outside','within')).toBe(false)
  expect(matchMetricReferenceFilter('unknown','outside')).toBe(false)
  expect(matchMetricReferenceFilter('unknown','unknown')).toBe(true)
  expect(matchMetricReferenceFilter('unknown','all')).toBe(true)
 })
})
