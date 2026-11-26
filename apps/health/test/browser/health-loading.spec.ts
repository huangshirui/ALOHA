import {test,expect,type Page} from '@playwright/test'

/** No production endpoints, credentials or personal health records. */
async function fixture(page:Page,withTrend=false){
  const space={id:'spc_fake',name:'Synthetic workspace',role:'owner'}
  const personId='per_fake'
  let metrics=Array.from({length:22},(_,i)=>({
    id:'metric_fake_'+i,spaceId:space.id,modelKey:'health_metric',version:1,
    name:'合成指标 '+String(i+1).padStart(2,'0'),valueType:'number',defaultUnit:'unit',
    ...(withTrend&&i===0?{referenceLow:2,referenceHigh:8,referenceSource:'Synthetic fixture'}:{}),
  }))
  let assessments=[1,2,3].map(i=>({id:'assessment_fake_'+i,spaceId:space.id,modelKey:'health_assessment',version:1,title:'合成评估 '+i,content:'Synthetic fixture',status:'final',assessedDate:'2026-01-0'+i})).reverse()
  const concern={id:'concern_fake',spaceId:space.id,modelKey:'health_concern',version:1,name:'合成关注',status:'active',summary:'Synthetic fixture'}
  const observation=(id:string)=>({id:'obs_'+id,spaceId:space.id,modelKey:'health_observation',version:1,metricId:id,observedDate:'2026-01-01',valueNumber:5,unit:'unit'})
  const trendRows=[
    ['2026-01-01',7],['2025-06-01',9],['2025-06-01',6],['2023-01-01',5],['2019-01-01',3],
  ].map(([date,value],i)=>({...observation('metric_fake_0'),id:'trend_fake_'+i,observedDate:date,valueNumber:value,status:'final'}))
  const requests:{path:string;cursor:string|null;search:string|null}[]=[]
  let releaseFocus=()=>{}
  const focusGate=new Promise<void>(resolve=>{releaseFocus=resolve})
  let releaseRelations=()=>{}
  const relationsGate=new Promise<void>(resolve=>{releaseRelations=resolve})
  let relationFailure=0
  let metricFailure=0
  let assessmentFailure=0
  let deleteFailure=0
  let deleteGate:Promise<void>|null=null
  let deletes=0
  let metricGate:Promise<void>|null=null
  await page.route('**/health/api/v1/**',async route=>{
    const url=new URL(route.request().url()),path=url.pathname
    const cursor=url.searchParams.get('cursor'),search=url.searchParams.get('search')
    requests.push({path,cursor,search})
    const reply=(data:unknown)=>route.fulfill({json:{data}})
    if(path.endsWith('/workspace'))return reply({status:'bound',space,spaces:[space]})
    if(path.endsWith('/profile'))return reply({displayName:'Synthetic',avatarUrl:null})
    if(path.endsWith('/own-person'))return reply({personId})
    if(path.endsWith('/snapshot')){
      await focusGate
      return reply({personId,models:{health_concern:[concern]},presentation:{items:[]}})
    }
    if(path.endsWith('/health_concern/selected-records'))return reply({personId,items:[concern]})
    if(path.endsWith('/relations')){
      await relationsGate
      if(relationFailure)return route.fulfill({status:relationFailure,json:{error:'fixture'}})
      return reply({items:[{id:'rel_fake',spaceId:space.id,source:{kind:'record',modelKey:'health_concern',recordId:concern.id},predicate:'monitors',target:{kind:'record',modelKey:'health_metric',recordId:metrics[0].id},createdAt:'2026-01-01T00:00:00Z'}]})
    }
    const method=route.request().method()
    const metricRecord=path.match(/\/health_metric\/records\/([^/]+)$/)
    const assessmentRecord=path.match(/\/health_assessment\/records\/([^/]+)$/)
    if(method==='DELETE'&&(metricRecord||assessmentRecord)){
      deletes++
      if(deleteGate)await deleteGate
      if(deleteFailure)return route.fulfill({status:deleteFailure,json:{error:'fixture'}})
      if(metricRecord)metrics=metrics.filter(m=>m.id!==metricRecord[1])
      if(assessmentRecord)assessments=assessments.filter(a=>a.id!==assessmentRecord[1])
      return route.fulfill({status:204})
    }
    if(method==='PATCH'&&metricRecord){
      const index=metrics.findIndex(m=>m.id===metricRecord[1])
      if(index<0)return route.fulfill({status:404,json:{error:'fixture'}})
      metrics[index]={...metrics[index],...route.request().postDataJSON(),version:metrics[index].version+1}
      return reply(metrics[index])
    }
    if(path.endsWith('/health_assessment/selected-records'))return reply({personId,items:(url.searchParams.get('ids')||'').split(',').map(id=>assessments.find(a=>a.id===id)).filter(Boolean)})
    if(path.endsWith('/health_assessment/page')){
      if(assessmentFailure)return route.fulfill({status:assessmentFailure,json:{error:'fixture'}})
      return reply({personId,items:assessments,nextCursor:null})
    }
    if(path.endsWith('/health_metric/page')){
      if(metricGate)await metricGate
      if(metricFailure)return route.fulfill({status:metricFailure,json:{error:'fixture'}})
      const rows=metrics.filter(m=>!search||m.name.includes(search))
      return reply({personId,items:cursor?rows.slice(20):rows.slice(0,20),nextCursor:!cursor&&rows.length>20?'next_fake':null})
    }
    if(path.endsWith('/metric-summaries'))return reply({personId,items:(url.searchParams.get('metricIds')||'').split(',').filter(id=>id&&id!=='metric_fake_21').map(observation)})
    if(path.endsWith('/health_metric/selected-records'))return reply({personId,items:(url.searchParams.get('ids')||'').split(',').map(id=>metrics.find(m=>m.id===id)).filter(Boolean)})
    if(path.endsWith('/health_observation/selected-records'))return reply({personId,items:trendRows.filter(r=>(url.searchParams.get('ids')||'').split(',').includes(r.id))})
    if(path.endsWith('/health_observation/page')){
      const id=url.searchParams.get('metricId')
      return reply({personId,items:withTrend&&id==='metric_fake_0'?trendRows:id&&id!=='metric_fake_21'?[observation(id)]:[],nextCursor:null})
    }
    if(path.endsWith('/health_document/page')||path.endsWith('/health_regimen/page')||path.endsWith('/health_event/page')||path.endsWith('/health_assessment/page'))return reply({personId,items:[],nextCursor:null})
    return route.fulfill({status:500,json:{error:'Unexpected synthetic request'}})
  })
  return {
    releaseFocus,releaseRelations,
    failRelations:(status:number)=>{relationFailure=status},
    relationReads:()=>requests.filter(r=>r.path.endsWith('/relations')).length,
    metricReads:()=>requests.filter(r=>r.path.endsWith('/health_metric/page')).length,
    metricCursors:()=>requests.filter(r=>r.path.endsWith('/health_metric/page')).map(r=>r.cursor),
    failMetric:(status:number)=>{metricFailure=status},
    failAssessment:(status:number)=>{assessmentFailure=status},
    failDelete:(status:number)=>{deleteFailure=status},
    deleteCount:()=>deletes,
    lastMetricSearch:()=>requests.filter(r=>r.path.endsWith('/health_metric/page')).at(-1)?.search,
    holdDelete:()=>{let release=()=>{};deleteGate=new Promise<void>(resolve=>{release=resolve});return ()=>{deleteGate=null;release()}},
    holdMetric:()=>{let release=()=>{};metricGate=new Promise<void>(resolve=>{release=resolve});return ()=>{metricGate=null;release()}},
  }
}

test('first load, warm navigation, pagination, detail return and scoped refresh',async({page})=>{
  const fake=await fixture(page)
  await page.goto('/health/')
  await expect(page.locator('.body-silhouette').first()).toBeVisible()
  await expect(page.getByText('合成关注',{exact:true})).toHaveCount(0)
  fake.releaseFocus()
  await expect(page.getByText('合成关注',{exact:true}).first()).toBeVisible()
  const ask=page.getByRole('button',{name:'问问 Health（尚未开放）'})
  await expect(ask).toBeVisible();await expect(ask).toBeDisabled()
  const tab=(name:string)=>page.getByRole('navigation',{name:'身体页面导航'}).getByRole('button',{name,exact:true})
  const refresh=()=>page.getByRole('button',{name:'刷新当前页面',exact:true})
  const rows=page.locator('button.list-row').filter({hasText:'合成指标'})
  await tab('指标').click()
  await expect(rows).toHaveCount(20)
  await page.getByRole('button',{name:'加载更多',exact:true}).waitFor({state:'visible'})
  await expect(page.getByRole('button',{name:'加载更多',exact:true})).toBeEnabled()
  await page.getByRole('button',{name:'加载更多',exact:true}).click()
  await expect(rows).toHaveCount(22)
  await expect(refresh()).toBeEnabled()
  const before=fake.metricReads()
  await tab('资料').click()
  await expect(refresh()).toBeEnabled()
  await tab('指标').click()
  await expect(rows).toHaveCount(22)
  await tab('指标').click()
  await expect(rows).toHaveCount(22)
  expect(fake.metricReads()).toBe(before)
  await rows.first().click()
  await expect(page.getByRole('heading',{name:'合成指标 01',exact:true})).toBeVisible()
  await expect(refresh()).toBeEnabled()
  await page.getByRole('button',{name:'返回列表'}).click()
  await expect(rows).toHaveCount(22)
  expect(fake.metricReads()).toBe(before)
  const release=fake.holdMetric()
  await refresh().click()
  await expect(page.getByRole('button',{name:'正在刷新当前页面'})).toBeDisabled()
  await expect(rows).toHaveCount(22)
  await expect(page.locator('.health-skeleton')).toHaveCount(0)
  release()
  await expect(refresh()).toBeEnabled()
  expect(fake.metricCursors().slice(-2)).toEqual([null,'next_fake'])
  await expect(rows).toHaveCount(22)
  fake.failMetric(503)
  await refresh().click()
  await expect(page.getByText(/更新失败，显示上次成功加载的数据/)).toBeVisible()
  await expect(rows).toHaveCount(22)
  fake.failMetric(0)
  const search=page.getByRole('textbox',{name:'搜索当前内容'})
  await search.fill('22')
  await expect(rows).toHaveCount(1)
  await expect(refresh()).toBeEnabled()
  const searched=fake.metricReads()
  await tab('资料').click();await expect(refresh()).toBeEnabled()
  await tab('指标').click()
  await expect(search).toHaveValue('22')
  await expect(rows).toHaveCount(1)
  expect(fake.metricReads()).toBe(searched)
  fake.failMetric(403)
  await refresh().click()
  await expect(page.getByText(/当前用户没有该空间或模型的访问权限/)).toBeVisible()
  await expect(rows).toHaveCount(0)
})

test('concern groups never claim empty before completion and keep last success on refresh failure',async({page})=>{
  const fake=await fixture(page)
  fake.releaseFocus()
  await page.goto('/health/')
  await page.getByRole('button',{name:/合成关注.*未定位/}).click()
  await expect(page.getByRole('heading',{name:'合成关注',exact:true})).toBeVisible()
  await expect(page.getByRole('status',{name:'正在加载追踪指标'})).toBeVisible()
  await expect(page.getByText('尚未追踪指标，可从下方关联。')).toHaveCount(0)
  await expect(page.getByText('尚无关联测量记录。')).toHaveCount(0)
  fake.releaseRelations()
  const metric=page.locator('.concern-metric-link').filter({hasText:'合成指标 01'})
  await expect(metric).toBeVisible()
  await expect(page.getByText('尚无关联测量记录。')).toBeVisible()
  const refresh=page.getByRole('button',{name:'刷新当前页面',exact:true})
  await expect(refresh).toBeEnabled()
  const before=fake.relationReads()
  await metric.click()
  await expect(page.getByRole('heading',{name:'合成指标 01',exact:true})).toBeVisible()
  await expect(refresh).toBeEnabled()
  await page.getByRole('button',{name:'返回列表'}).click()
  await expect(metric).toBeVisible()
  await expect(refresh).toBeEnabled()
  expect(fake.relationReads()).toBe(before)
  fake.failRelations(503)
  await refresh.click()
  await expect(page.getByText(/关联更新失败，显示上次数据/).first()).toBeVisible()
  await expect(metric).toBeVisible()
  await expect(page.getByText('尚未追踪指标，可从下方关联。')).toHaveCount(0)
})

test('edit and delete restore original filtered paginated metric list, including failed refresh',async({page})=>{
  const fake=await fixture(page)
  fake.releaseFocus()
  await page.goto('/health/')
  await expect(page.getByText('合成关注',{exact:true}).first()).toBeVisible()
  await page.getByRole('navigation',{name:'身体页面导航'}).getByRole('button',{name:'指标',exact:true}).click()
  const refresh=()=>page.getByRole('button',{name:'刷新当前页面',exact:true})
  const search=page.getByRole('textbox',{name:'搜索当前内容'})
  const rows=page.locator('button.list-row').filter({hasText:'合成指标'})
  await expect(refresh()).toBeEnabled()
  await search.fill('合成指标')
  await expect(refresh()).toBeEnabled()
  await expect(rows).toHaveCount(20)
  await page.getByRole('button',{name:'加载更多',exact:true}).click()
  await expect(rows).toHaveCount(22)
  await expect(refresh()).toBeEnabled()
  // Edit the existing metric and return via the same origin, without losing query state.
  await rows.filter({hasText:'合成指标 21'}).click()
  await expect(refresh()).toBeEnabled()
  await page.getByRole('button',{name:'修改记录'}).click()
  await page.getByPlaceholder('例如：静息心率').fill('合成指标 21 修改')
  await page.getByRole('button',{name:'保存修改'}).click()
  await expect(page.getByRole('heading',{name:'合成指标 21 修改',exact:true})).toBeVisible()
  await expect(refresh()).toBeEnabled()
  await page.getByRole('button',{name:'返回列表'}).click()
  await expect(search).toHaveValue('合成指标')
  await expect(rows).toHaveCount(22)
  await expect(refresh()).toBeEnabled()
  await expect(rows.filter({hasText:'合成指标 21 修改'})).toBeVisible()
  const target=rows.filter({hasText:'合成指标 22'})
  await target.scrollIntoViewIfNeeded()
  await target.click()
  await expect(page.getByRole('heading',{name:'合成指标 22',exact:true})).toBeVisible()
  await expect(refresh()).toBeEnabled()
  const remove=page.getByRole('button',{name:'删除健康记录'})
  page.once('dialog',d=>d.dismiss())
  await remove.click()
  expect(fake.deleteCount()).toBe(0)
  fake.failDelete(503)
  page.once('dialog',d=>d.accept())
  await remove.click()
  await expect(page.getByText('后台暂不可用，请稍后重试',{exact:true})).toBeVisible()
  await expect(page.getByRole('heading',{name:'合成指标 22',exact:true})).toBeVisible()
  await expect(remove).toBeEnabled()
  fake.failDelete(0)
  fake.failMetric(503)
  const release=fake.holdDelete()
  page.once('dialog',d=>d.accept())
  await remove.click()
  await expect(remove).toBeDisabled()
  await expect.poll(() => fake.deleteCount()).toBe(2)
  release()
  // Delete succeeded even though the following list refresh failed.
  await expect(search).toHaveValue('合成指标')
  await expect(page.getByText(/更新失败，显示上次成功加载的数据/)).toBeVisible()
  await expect(rows).toHaveCount(21)
  await expect(target).toHaveCount(0)
  expect(fake.lastMetricSearch()).toBe('合成指标')
  fake.failMetric(0)
  await refresh().click()
  await expect(refresh()).toBeEnabled()
  await expect(rows).toHaveCount(21)
  await expect(target).toHaveCount(0)
  expect(fake.metricCursors().slice(-2)).toEqual([null,'next_fake'])
  await expect(search).toHaveValue('合成指标')
})

test('timeline deletion retains text and type filter and removes deleted projection on failed refresh',async({page})=>{
  const fake=await fixture(page)
  fake.releaseFocus()
  await page.goto('/health/')
  await expect(page.getByText('合成关注',{exact:true}).first()).toBeVisible()
  await page.getByRole('navigation',{name:'身体页面导航'}).getByRole('button',{name:'时间线',exact:true}).click()
  const refresh=()=>page.getByRole('button',{name:'刷新当前页面',exact:true})
  const filter=page.getByRole('group',{name:'按记录类型筛选'}).getByRole('button',{name:'评估',exact:true})
  await filter.click()
  const search=page.getByRole('textbox',{name:'搜索当前内容'})
  await search.fill('合成评估')
  const rows=page.locator('.timeline-entry').filter({hasText:'合成评估'})
  await expect(rows).toHaveCount(3)
  await expect(refresh()).toBeEnabled()
  await rows.filter({hasText:'合成评估 2'}).click()
  await expect(page.getByRole('heading',{name:'合成评估 2',exact:true})).toBeVisible()
  await expect(refresh()).toBeEnabled()
  fake.failAssessment(503)
  page.once('dialog',d=>d.accept())
  await page.getByRole('button',{name:'删除健康记录'}).click()
  await expect(search).toHaveValue('合成评估')
  await expect(filter).toHaveAttribute('aria-pressed','true')
  await expect(page.getByText(/更新失败，显示上次成功加载的数据/)).toBeVisible()
  await expect(rows).toHaveCount(2)
  await expect(rows.filter({hasText:'合成评估 2'})).toHaveCount(0)
  fake.failAssessment(0)
  await refresh().click()
  await expect(refresh()).toBeEnabled()
  await expect(rows).toHaveCount(2)
})


test('metric chart renders real dates, preserves duplicate-day readings and switches range',async({page},testInfo)=>{
  const fake=await fixture(page,true)
  fake.releaseFocus()
  await page.goto('/health/')
  await expect(page.getByText('合成关注',{exact:true}).first()).toBeVisible()
  await page.getByRole('navigation',{name:'身体页面导航'}).getByRole('button',{name:'指标',exact:true}).click()
  await page.locator('button.list-row').filter({hasText:'合成指标 01'}).click()
  const trend=page.getByRole('region',{name:'观测趋势'})
  const range=page.getByRole('combobox',{name:'趋势时间范围'})
  await range.selectOption('all')
  await expect(trend.getByText('实际观测 · 5 次')).toBeVisible()
  const svg=trend.locator('.metric-trend-plot svg')
  await expect(svg).toBeVisible()
  await expect(trend.getByText('当前指标参考边界',{exact:true})).toBeVisible()
  await expect(trend.getByRole('group',{name:'选择趋势时间维度'})).toHaveCount(0)
  const picker=trend.getByRole('combobox',{name:'选择一条实际观测'})
  await expect(picker.locator('option')).toHaveCount(6)
  await picker.selectOption('trend_fake_2')
  await expect(trend.getByText('已选 · 2025-06-01 · 原始观测')).toBeVisible()
  await expect(trend.locator('.metric-trend-readout strong')).toHaveText('6 unit')
  await expect(trend.getByRole('button',{name:'查看这条记录'})).toBeVisible()
  await trend.getByRole('button',{name:'取消选中图表观测点'}).click()
  await expect(trend.locator('.metric-trend-readout')).toHaveCount(0)
  const fit=await svg.evaluate(el=>{const a=el.getBoundingClientRect(),b=el.closest('.metric-trend')!.getBoundingClientRect();return a.width>0&&a.left>=b.left-1&&a.right<=b.right+1})
  expect(fit).toBe(true)
  await trend.screenshot({path:testInfo.outputPath('metric-trend.png'),animations:'disabled'})
  await range.selectOption('1')
  await expect(trend.getByText('实际观测 · 3 次')).toBeVisible()
  await expect(picker.locator('option')).toHaveCount(4)
  await expect(svg).toBeVisible()
})
