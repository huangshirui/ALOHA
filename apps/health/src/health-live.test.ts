import { describe, expect, it } from 'vitest'
import { decodeHealthRecord, emptyHealthData, encodeHealthFields, healthModelKey } from './health-live'
import type { HealthRecord } from './health-api'

const rec = (modelKey: keyof typeof healthModelKey, fields:Record<string,unknown>): HealthRecord => ({
  id:'rec_synthetic',spaceId:'spc_synthetic',modelKey:healthModelKey[modelKey],version:3,...fields,
})
describe('LifeSpace Health projection (synthetic only)', () => {
  it('starts with empty data and never seeds pretend records in live mode', () => {
    const data=emptyHealthData()
    expect(Object.values(data).every(rows=>rows.length===0)).toBe(true)
  })
  it('maps real Metric data with version for update concurrency', () => {
    const m=decodeHealthRecord('metric',rec('metric',{
      name:'示例指标',valueType:'number',defaultUnit:'kg',referenceLow:5,referenceHigh:10,
    }))
    expect(m).toMatchObject({id:'rec_synthetic',version:3,name:'示例指标',referenceLow:5})
    expect(encodeHealthFields('metric',{name:'示例指标',valueType:'number',defaultUnit:'kg',
      referenceLow:0,referenceHigh:10,referenceSource:''},'per_synthetic')).toMatchObject({
        referenceLow:0,referenceHigh:10,referenceSource:null,
      })
  })
  it('preserves false as an actual Observation value', () => {
    const raw=encodeHealthFields('observation',{
      metricId:'rec_metric',observedDate:'2026-10-20',valueNumber:null,valueText:'',
      valueBoolean:false,unit:'',referenceLow:'',referenceHigh:'',sourceDocumentId:'',
    },'per_synthetic')
    expect(raw).toMatchObject({subjectPersonId:'per_synthetic',valueNumber:null,
      valueText:null,valueBoolean:false,sourceDocumentId:null})
    const dto=decodeHealthRecord('observation',rec('observation',{
      metricId:'rec_metric',observedDate:'2026-10-20',valueBoolean:false,
    }))
    expect(dto).toMatchObject({valueBoolean:false,valueNumber:null,concernIds:[]})
  })
  it('maps the canonical date-only half-open TemporalRange', () => {
    const fields=encodeHealthFields('event',{
      eventType:'visit',summary:'示例事件',date:'2026-12-31',timeStart:'',timeEnd:'',
      status:'active',location:'示例地点',description:'',
    },'per_synthetic')
    expect(fields.when).toEqual({kind:'date',start:'2026-12-31',endExclusive:'2027-01-01'})
    expect(fields.location).toEqual({name:'示例地点'})
  })
  it('maps repeat plans to real structured recurrence rules', () => {
    const fields=encodeHealthFields('regimen',{
      name:'每周示例',regimenType:'wellness',instructions:'测试用途',
      recurrence:'weekly',firstDueDate:'2026-10-26',status:'active',
    },'per_synthetic')
    expect(fields.recurrence).toEqual({mode:'calendar',frequency:'weekly',
      interval:1,weekdays:['MO']})
    const loaded=decodeHealthRecord('regimen',rec('regimen',{recurrence:fields.recurrence,
      name:'每周示例',status:'active'}))
    expect(loaded).toMatchObject({recurrence:'weekly',version:3})
  })
  it('rejects fake file references rather than claiming upload success', () => {
    expect(()=>encodeHealthFields('document',{title:'Fake',fileName:'fake.pdf'},'per_fake'))
      .toThrow(/文件/)
  })

  it('round-trips Instant event dates/times across different local timezones',()=>{
    const originalTimezone=process.env.TZ
    try {
      for(const timezone of ['UTC','America/Los_Angeles','Europe/Amsterdam','Asia/Shanghai']) {
        process.env.TZ=timezone
        const original={kind:'instant',start:'2026-10-28T08:15:00.000Z',
          endExclusive:'2026-10-28T09:45:00.000Z'}
        const dto=decodeHealthRecord('event',rec('event',{
          eventType:'visit',summary:'Synthetic timezone test',when:original,status:'active',
        }))
        const fields=encodeHealthFields('event',{
          ...dto,eventType:'visit',summary:'Synthetic timezone test',status:'active',
        },'per_synthetic')
        expect(fields.when).toEqual(original)
      }
    } finally {
      if(originalTimezone===undefined)delete process.env.TZ
      else process.env.TZ=originalTimezone
    }
  })
  it('never displays raw UTC hours as local time in offset timezones',()=>{
    const originalTimezone=process.env.TZ
    try {
      process.env.TZ='Asia/Shanghai'
      const dto=decodeHealthRecord('event',rec('event',{
        eventType:'visit',summary:'Synthetic',status:'active',
        when:{kind:'instant',start:'2026-10-28T08:15:00.000Z',
          endExclusive:'2026-10-28T09:45:00.000Z'},
      }))
      expect(dto).toMatchObject({date:'2026-10-28',timeStart:'16:15',timeEnd:'17:45'})
    } finally {
      if(originalTimezone===undefined)delete process.env.TZ
      else process.env.TZ=originalTimezone
    }
  })

})
