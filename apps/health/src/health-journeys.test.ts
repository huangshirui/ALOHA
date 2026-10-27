import { describe, expect, it } from 'vitest'
import { primaryAction, recordChoices, saveDestination, type BodySection } from './health-journeys'

describe('Health six-journey interaction policy', () => {
  it('provides one type picker, without duplicate shortcuts, for home and timeline', () => {
    expect(recordChoices.map(x=>x.id)).toEqual(['observation','event','assessment'])
    const timeline=primaryAction('timeline')
    expect(timeline.mode).toBe('menu')
    if (timeline.mode==='menu') {
      expect(timeline.label).toBe('新增记录')
      expect(new Set(timeline.choices.map(x=>x.id)).size).toBe(timeline.choices.length)
    }
  })
  it('gives each body tab exactly one relevant primary action', () => {
    const sections:BodySection[] = ['overview','concerns','metrics','timeline','documents','regimens']
    const actions=sections.map(primaryAction)
    expect(actions.map(a=>a.mode)).toEqual(['menu','direct','direct','menu','direct','direct'])
    expect(actions.filter(a=>a.mode==='direct').map(a=>a.action)).toEqual(['concern','metric','document','regimen'])
  })
  it('a created object is shown as a detail, with its origin retained by the page stack', () => {
    expect(saveDestination('observation','new-1')).toEqual({kind:'observation',id:'new-1'})
    expect(saveDestination('document','new-2')).toEqual({kind:'document',id:'new-2'})
  })
})
