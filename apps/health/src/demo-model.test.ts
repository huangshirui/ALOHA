import { describe, expect, it } from 'vitest'
import {
  buildObservationValue, makeEmpty, observationValue, seedDemo,
  validateConcern, validateObservation, validateRegimen, validateEventTime,
} from './demo-model'

describe('健康原型：第一批模型的基础验证', () => {
  const data = seedDemo()
  it('七种业务模型均具备演示数据或空白表单', () => {
    for (const kind of ['concern','metric','observation','event','document','assessment','regimen'] as const)
      expect(makeEmpty(kind,'2026-10-27')).toBeDefined()
    expect(data.concerns.length).toBeGreaterThan(0)
    expect(data.metrics.length).toBeGreaterThan(0)
    expect(data.observations.length).toBeGreaterThan(0)
    expect(data.events.length).toBeGreaterThan(0)
    expect(data.documents.length).toBeGreaterThan(0)
    expect(data.assessments.length).toBeGreaterThan(0)
    expect(data.regimens.length).toBeGreaterThan(0)
  })
  it('一次观测只有与指标类型匹配的单一值', () => {
    const numberMetric = { id: 'num', name: '指标', valueType: 'number' as const, defaultUnit: 'kg' }
    const textMetric = { id: 'text', name: '感觉', valueType: 'text' as const, defaultUnit: '' }
    const boolMetric = { id: 'bool', name: '不适', valueType: 'boolean' as const, defaultUnit: '' }
    expect(validateObservation(numberMetric,'')).toContain('有效')
    expect(validateObservation(numberMetric,'abc')).toContain('有效')
    expect(validateObservation(numberMetric,'0')).toBeNull()
    expect(validateObservation(textMetric,'  ')).toContain('输入')
    expect(validateObservation(boolMetric,'')).toContain('是或否')
    expect(validateObservation(boolMetric,'false')).toBeNull()
    expect(buildObservationValue(numberMetric,'66.5')).toEqual({valueNumber:66.5,valueText:'',valueBoolean:null})
    expect(buildObservationValue(textMetric,'疲惫')).toEqual({valueNumber:null,valueText:'疲惫',valueBoolean:null})
    expect(buildObservationValue(boolMetric,'false')).toEqual({valueNumber:null,valueText:'',valueBoolean:false})
  })
  it('观测数据不再包含状态、原报告标记和自由文本来源说明', () => {
    const observation = makeEmpty('observation','2026-10-28')
    for (const key of ['status','interpretation','sourceNote']) {
      expect(observation).not.toHaveProperty(key)
      expect(data.observations.every(record => !Object.hasOwn(record,key))).toBe(true)
    }
    expect(observation).toHaveProperty('sourceDocumentId','')
    expect(observation).toHaveProperty('referenceSource','')
  })
  it('已有观测可被格式化为普通人可读的值', () => {
    expect(observationValue(data.observations[0]!, data.metrics[1])).toContain('mmHg')
  })
  it('健康问题不能设置倒置的开始结束日期', () => {
    expect(validateConcern('2026-10-27','2026-10-26')).not.toBeNull()
    expect(validateConcern('2026-10-26','2026-10-27')).toBeNull()
  })
  it('健康事件允许只记日期，也支持有效的时间段', () => {
    expect(validateEventTime('','')).toBeNull()
    expect(validateEventTime('09:00','')).not.toBeNull()
    expect(validateEventTime('15:00','14:00')).not.toBeNull()
    expect(validateEventTime('09:00','10:30')).toBeNull()
  })
  it('重复健康方案必须有首次执行日，且不晚于结束日', () => {
    expect(validateRegimen('','', 'daily','')).not.toBeNull()
    expect(validateRegimen('2026-10-01','2026-10-10','weekly','2026-10-11')).not.toBeNull()
    expect(validateRegimen('2026-10-01','2026-10-10','weekly','2026-10-05')).toBeNull()
    expect(validateRegimen('2026-10-02','2026-10-01','none','')).not.toBeNull()
  })
})
