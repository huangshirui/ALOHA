import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

/* ALOHA-owned candidate guard; LifeSpace Model Validator/Console remains authoritative. */
const expected = {
  health_metric: ['name','valueType','defaultUnit','referenceLow','referenceHigh','referenceSource'],
  health_concern: ['subjectPersonId','name','summary','status','onsetDate','resolvedDate','notes'],
  health_event: ['subjectPersonId','eventType','summary','when','status','location','description'],
  health_document: ['subjectPersonId','title','documentType','issuedDate','issuerName','eventId','artifactRef','notes'],
  health_observation: ['subjectPersonId','metricId','observedDate','valueNumber','valueText','valueBoolean','unit','referenceLow','referenceHigh','referenceSource','observationGroupId','sourceDocumentId','notes'],
  health_regimen: ['subjectPersonId','name','regimenType','instructions','startDate','endDate','status','sourceDocumentId','sourceNote','notes','recurrence','firstDueDate'],
  health_assessment: ['subjectPersonId','title','content','assessedDate','status','sourceNote','notes'],
}
const names = Object.keys(expected)
const model = key => JSON.parse(readFileSync(new URL(key+'.json',import.meta.url),'utf8'))
const types = new Set(['string','text','enum','integer','number','boolean','date','instant','temporal_range','location','file','file_list','record','record_list','person','person_list','recurrence_rule'])
const chinese = /[\u4e00-\u9fff]/u

test('seven candidates parse, preserve field signatures, and expose concise Chinese business semantics', () => {
  let descriptions=0
  for(const key of names){
    const d=model(key)
    assert.equal(d.definitionVersion,1,key)
    assert.equal(d.key,key)
    assert.deepEqual(Object.keys(d.fields),expected[key],key)
    assert.match(d.description,chinese,key)
    assert.ok(d.description.length>=30 && d.description.length<=500,key)
    assert.match(d.display.singular,chinese,key)
    assert.match(d.display.plural,chinese,key)
    assert.deepEqual(d.access,['read','write'],key)
    assert.equal('lifecycle' in d,false,key+' runtime defaults')
    for(const [name,f] of Object.entries(d.fields)){
      assert.ok(types.has(f.type),key+'.'+name+': unsupported type '+f.type)
      assert.match(f.title,chinese,key+'.'+name+': title')
      if(f.description){
        descriptions++
        assert.ok(f.description.length<=300,key+'.'+name+': too long')
        assert.match(f.description,chinese,key+'.'+name+': description')
      }
      if(f.type==='enum')assert.ok(Array.isArray(f.values)&&f.values.length>0,key+'.'+name+': enum')
      if(['record','record_list'].includes(f.type))assert.ok(names.includes(f.targetModel),key+'.'+name+': targetModel')
      if(f.required)assert.notEqual(f.nullable,true,key+'.'+name+': required and nullable')
    }
    for(const q of [...(d.query?.searchable??[]),...(d.query?.filterable??[]),...(d.query?.sortable??[])])
      assert.ok(d.fields[q],key+': missing query field '+q)
    if(d.referenceLabel?.field)assert.ok(d.fields[d.referenceLabel.field],key+': reference label')
  }
  assert.equal(descriptions,44,'descriptions focus on ambiguous fields')
})

test('observations remain typed facts without retired status or report interpretation',()=>{
  const d=model('health_observation')
  assert.equal(d.fields.metricId.targetModel,'health_metric')
  assert.equal(d.fields.sourceDocumentId.targetModel,'health_document')
  for(const f of ['status','interpretation','sourceNote'])assert.equal(d.fields[f],undefined)
  assert.deepEqual(['valueNumber','valueText','valueBoolean'].map(k=>d.fields[k].type),['number','text','boolean'])
  assert.match(d.fields.valueBoolean.description,/false 是有效结果/u)
})

test('health documents require immutable uploaded LifeSpace file references',()=>{
  const d=model('health_document')
  assert.equal(d.fields.artifactRef.type,'file')
  assert.equal(d.fields.artifactRef.required,true)
  assert.equal(d.fields.artifactRef.immutable,true)
  assert.equal(d.fields.eventId.targetModel,'health_event')
})

test('regimens preserve platform Recurrence and Task field role binding',()=>{
  const d=model('health_regimen')
  assert.equal(d.fields.recurrence.type,'recurrence_rule')
  assert.deepEqual(d.capabilities.recurrence,{
    ruleField:'recurrence',firstDueDateField:'firstDueDate',statusField:'status',
    endDateField:'endDate',
    task:{nameField:'name',descriptionField:'instructions',subjectField:'subjectPersonId'},
  })
})

test('relations and safety-relevant workflow descriptions remain intact',()=>{
  assert.deepEqual(model('health_concern').semanticRelations.outgoing,['monitors','relates_to'])
  assert.deepEqual(model('health_assessment').semanticRelations.outgoing,['based_on'])
  assert.deepEqual(model('health_event').semanticRelations.outgoing,['relates_to'])
  assert.match(model('health_assessment').fields.status.description,/不表示医生认可/u)
  assert.match(model('health_event').fields.status.description,/cancelled/u)
  assert.match(model('health_concern').fields.status.description,/不必然代表痊愈/u)
})
