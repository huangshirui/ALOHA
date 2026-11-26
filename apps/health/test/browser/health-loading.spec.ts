import {test,expect,type Page} from '@playwright/test'

/** No production endpoints, credentials or personal health records. */
async function fixture(page:Page){
  const space={id:'spc_fake',name:'Synthetic workspace',role:'owner'}
  const personId='per_fake'
  const metrics=Array.from({length:22},(_,i)=>({
    id:'metric_fake_'+i,spaceId:space.id,modelKey:'health_metric',version:1,
    name:'合成指标 '+String(i+1).padStart(2,'0'),valueType:'number',defaultUnit:'unit',
  }))
  const concern={id:'concern_fake',spaceId:space.id,modelKey:'health_concern',version:1,name:'合成关注',status:'active',summary:'Synthetic fixture'}
  const observation=(id:string)=>({id:'obs_'+id,spaceId:space.id,modelKey:'health_observation',version:1,metricId:id,observedDate:'2026-01-01',valueNumber:5,unit:'unit'})
  const requests:{path:string;cursor:string|null;search:string|null}[]=[]
  let releaseFocus=()=>{}
  const focusGate=new Promise<void>(resolve=>{releaseFocus=resolve})
  let metricFailure=0
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
    if(path.endsWith('/health_metric/page')){
      if(metricGate)await metricGate
      if(metricFailure)return route.fulfill({status:metricFailure,json:{error:'fixture'}})
      const rows=metrics.filter(m=>!search||m.name.includes(search))
      return reply({personId,items:cursor?rows.slice(20):rows.slice(0,20),nextCursor:!cursor&&rows.length>20?'next_fake':null})
    }
    if(path.endsWith('/metric-summaries'))return reply({personId,items:(url.searchParams.get('metricIds')||'').split(',').filter(Boolean).map(observation)})
    if(path.endsWith('/health_metric/selected-records'))return reply({personId,items:(url.searchParams.get('ids')||'').split(',').map(id=>metrics.find(m=>m.id===id)).filter(Boolean)})
    if(path.endsWith('/health_observation/page')){
      const id=url.searchParams.get('metricId')
      return reply({personId,items:id?[observation(id)]:[],nextCursor:null})
    }
    if(path.endsWith('/health_document/page')||path.endsWith('/health_regimen/page')||path.endsWith('/health_event/page')||path.endsWith('/health_assessment/page'))return reply({personId,items:[],nextCursor:null})
    return route.fulfill({status:500,json:{error:'Unexpected synthetic request'}})
  })
  return {
    releaseFocus,
    metricReads:()=>requests.filter(r=>r.path.endsWith('/health_metric/page')).length,
    metricCursors:()=>requests.filter(r=>r.path.endsWith('/health_metric/page')).map(r=>r.cursor),
    failMetric:(status:number)=>{metricFailure=status},
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
