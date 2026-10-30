import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { editableSnapshot } from './health-editor'

describe('Health edit form',()=>{
  it('opens a reactive Observation with nested proxy relations without DataCloneError',()=>{
    const saved=reactive({id:'rec_synthetic',version:2,valueNumber:42,concernIds:['rec_one'],
      details:{reference:{low:10,high:60}}})
    const draft=editableSnapshot(saved)
    expect(draft).toEqual({
      id:'rec_synthetic',version:2,valueNumber:42,concernIds:['rec_one'],
      details:{reference:{low:10,high:60}},
    })
    draft.valueNumber=43
    draft.concernIds.push('rec_two')
    draft.details.reference.low=15
    expect(saved.valueNumber).toBe(42)
    expect(saved.concernIds).toEqual(['rec_one'])
    expect(saved.details.reference.low).toBe(10)
  })
})
