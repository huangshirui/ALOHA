import {describe,expect,it} from 'vitest'
import {chooseReferenceRange,compareReference,formatReferenceRange,parseReferenceDraft,validateReferenceDraft} from './health-reference'
const metric={valueType:'number',defaultUnit:'mmol/L',referenceLow:2,referenceHigh:4,referenceSource:'演示报告的范围'}
const observation={valueNumber:3,unit:'mmol/L'}
describe('Health reference range comparisons (not medical diagnoses)',()=>{
 it('shows lower/inside/upper comparisons without inventing original report interpretations',()=>{
  expect(compareReference(metric,{...observation,valueNumber:1.9}).comparison?.position).toBe('below')
  expect(compareReference(metric,observation).comparison?.position).toBe('within')
  expect(compareReference(metric,{...observation,valueNumber:4.1}).comparison?.position).toBe('above')
  expect(compareReference(metric,{...observation,valueNumber:2}).comparison?.position).toBe('within')
  expect(compareReference(metric,{...observation,valueNumber:4}).comparison?.position).toBe('within')
  expect(compareReference(metric,observation).comparison).not.toHaveProperty('interpretation')
 })
 it('uses one-sided observations as full overrides, never mixes boundaries',()=>{
  const changed={...observation,valueNumber:3,referenceLow:null,referenceHigh:2.5,referenceSource:'演示本次报告'}
  expect(chooseReferenceRange(metric,changed)?.source).toBe('observation')
  expect(compareReference(metric,changed).comparison?.position).toBe('above')
  expect(compareReference(metric,{...changed,valueNumber:1.1}).comparison?.position).toBe('within')
  expect(formatReferenceRange(changed,'mmol/L')).toBe('≤ 2.5 mmol/L')
 })
 it('stops rather than converts unlike units, unless the report supplies its own range',()=>{
  expect(compareReference(metric,{...observation,unit:'mg/dL'}).reason).toBe('unit_mismatch')
  expect(compareReference(metric,{...observation,unit:'mg/dL',referenceHigh:120}).comparison?.source).toBe('observation')
 })
 it('returns not evaluated for nonnumeric values and no configured range',()=>{
  expect(compareReference(metric,{...observation,valueNumber:null}).reason).toBe('non_numeric')
  expect(compareReference({valueType:'number',defaultUnit:'kg'}, {...observation,unit:'kg'}).reason).toBe('no_range')
  expect(compareReference({...metric,valueType:'text'},observation).reason).toBe('non_numeric')
 })
 it('validates numeric interval input and does not allow a source with empty bounds',()=>{
  expect(validateReferenceDraft('5','2','','number')).toContain('不能高于')
  expect(validateReferenceDraft('x','2','','number')).toContain('有效数值')
  expect(validateReferenceDraft('','','化验报告','number')).toContain('至少一项')
  expect(validateReferenceDraft('2','','','number')).toBeNull()
  expect(validateReferenceDraft('2','','','boolean')).toContain('只有数值型')
  expect(parseReferenceDraft('0','','  示范数据  ')).toEqual({referenceLow:0,referenceHigh:null,referenceSource:'示范数据'})
 })
 it('does not use invalid bounds and never infers a severity level',()=>{
  expect(compareReference({...metric,referenceLow:5,referenceHigh:2},observation).reason).toBe('invalid_range')
  const result=compareReference(metric,observation)
  expect(result.comparison?.label).toBe('在参考范围内')
  expect(result.comparison).not.toHaveProperty('diagnosis')
 })
})
