<script setup lang="ts">
import { computed, ref } from 'vue'

type Tab = 'home' | 'body' | 'nutrition' | 'exercise'
type BodyView = '概览' | '健康问题' | '指标' | '时间线' | '资料' | '干预'
type Overlay = null | 'agent' | 'record' | 'upload' | 'apps' | 'account'

type DemoRecord = { name: string; value: string; unit: string; date: string }
const tabs: { id: Tab; title: string; mark: string }[] = [
  { id: 'home', title: '首页', mark: '⌂' },
  { id: 'body', title: '身体', mark: '♡' },
  { id: 'nutrition', title: '饮食', mark: '◈' },
  { id: 'exercise', title: '运动', mark: '↗' },
]
const bodyViews: BodyView[] = ['概览', '健康问题', '指标', '时间线', '资料', '干预']
const concerns = [
  { id: 'balance', name: '日常血压观察', caption: '关注测量变化和生活习惯', tone: 'mint', since: '2026 年 8 月' },
  { id: 'recovery', name: '运动恢复计划', caption: '定期回顾活动量与恢复状况', tone: 'lavender', since: '2026 年 9 月' },
]
const demoTrend = [
  { month: '5月', value: 121 },
  { month: '6月', value: 119 },
  { month: '7月', value: 123 },
  { month: '8月', value: 118 },
  { month: '9月', value: 116 },
  { month: '10月', value: 117 },
]
const demoEvents = [
  { date: '10月22日', title: '记录一次血压测量', sub: 'HealthObservation · 演示数据', symbol: '◉' },
  { date: '10月18日', title: '添加年度检查资料', sub: 'HealthDocument · 演示数据', symbol: '▤' },
  { date: '10月12日', title: '更新运动恢复计划', sub: 'HealthRegimen · 演示数据', symbol: '◇' },
]
const activeTab = ref<Tab>('home')
const bodyView = ref<BodyView>('概览')
const selectedConcern = ref<string | null>(null)
const selectedMetric = ref<string | null>(null)
const overlay = ref<Overlay>(null)
const agentDraft = ref('')
const agentAnswer = ref('')
const recordingMetric = ref('体重')
const recordingValue = ref('')
const recordingNote = ref('')
const demoRecords = ref<DemoRecord[]>([])
const checkedTasks = ref<string[]>([])
const documentName = ref('')
const documentPreview = ref(false)
const notice = ref('')
const label = computed(() => tabs.find(item => item.id === activeTab.value)?.title ?? 'Health')
const currentConcern = computed(() => concerns.find(item => item.id === selectedConcern.value))
const currentMetricValue = computed(() => {
  const latest = [...demoRecords.value].reverse().find(item => item.name === '体重')
  return latest ? latest.value : '67.2'
})
const today = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(new Date())

function navigate(tab: Tab) {
  activeTab.value = tab
  selectedConcern.value = null
  selectedMetric.value = null
  overlay.value = null
  if (tab === 'body') bodyView.value = '概览'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function showConcern(id: string) {
  selectedConcern.value = id
  selectedMetric.value = null
  activeTab.value = 'body'
  bodyView.value = '健康问题'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function showMetric(name: string) {
  selectedMetric.value = name
  selectedConcern.value = null
  activeTab.value = 'body'
  bodyView.value = '指标'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function selectBody(view: BodyView) {
  bodyView.value = view
  selectedConcern.value = null
  selectedMetric.value = null
}
function toast(message: string) {
  notice.value = message
}
function toggleTask(id: string) {
  checkedTasks.value = checkedTasks.value.includes(id)
    ? checkedTasks.value.filter(item => item !== id)
    : [...checkedTasks.value, id]
}
function addRecord() {
  const value = recordingValue.value.trim()
  if (!value || !Number.isFinite(Number(value)) || Number(value) <= 0) {
    toast('请输入有效的演示数值。')
    return
  }
  demoRecords.value.push({
    name: recordingMetric.value,
    value,
    unit: recordingMetric.value === '体重' ? 'kg' : 'mmHg',
    date: today,
  })
  recordingValue.value = ''
  recordingNote.value = ''
  overlay.value = null
  toast('已添加到此页面的临时演示数据（不会上传或保存）。')
}
function handleFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  documentName.value = file?.name ?? ''
  documentPreview.value = false
}
function demoDocument() {
  if (!documentName.value) return
  documentPreview.value = true
  toast('这是报告导入交互模拟；未读取或上传文件内容。')
}
function askAgent() {
  const query = agentDraft.value.trim()
  if (!query) return
  agentAnswer.value = query.includes('报告')
    ? '演示回答：正式版将列出关联报告、来源与可核对的提取结果。本原型没有连接 AI，也没有读取任何个人文件。'
    : query.includes('变化') || query.includes('趋势')
      ? '演示回答：您可以在指标详情中比较不同日期的观测，并回溯原始报告。此处显示的是虚构趋势数据，不是医学判断。'
      : '演示回答：Health Agent 会携带当前页面或健康关注事项作为上下文，帮助您查看记录、理解变化和规划下一步。本原型仅模拟交互。'
}
function closeOverlay() {
  overlay.value = null
}
</script>

<template>
  <div class="aloha-surface health-app" data-aloha-surface="health" @keydown.esc="closeOverlay">
    <aside class="desktop-nav" aria-label="Health 导航">
      <div class="brand-sign"><span class="brand-heart">♥</span><div><strong>ALOHA</strong><small>HEALTH</small></div></div>
      <div class="desktop-nav-links">
        <button v-for="tab in tabs" :key="tab.id" :class="{ active: activeTab === tab.id }" type="button" @click="navigate(tab)">
          <span class="nav-symbol">{{ tab.mark }}</span>{{ tab.title }}
        </button>
      </div>
      <div class="desktop-nav-bottom">
        <span class="demo-dot"></span> 交互演示版
        <p>使用虚构数据 · 不连接真实健康档案</p>
      </div>
    </aside>

    <div class="page">
      <header class="topbar">
        <button class="brand-control" type="button" aria-label="切换 ALOHA 应用" @click="overlay = 'apps'">
          <span class="mini-icon">♥</span><span class="brand-copy"><strong>Health</strong><small>ALOHA · 健康空间</small></span><span class="tiny-chevron">⌄</span>
        </button>
        <div class="top-actions">
          <span class="demo-pill">DEMO</span>
          <button class="round-action" type="button" aria-label="与 Health Agent 对话" @click="overlay = 'agent'">✦</button>
          <button class="round-action profile-action" type="button" aria-label="账户及共享入口" @click="overlay = 'account'">◉</button>
        </div>
      </header>

      <main class="health-main" id="main-content">
        <div v-if="activeTab === 'home'" class="home-page">
          <section class="greeting">
            <div><p class="eyebrow">{{ today }} · 您的健康空间</p><h1>照顾健康，<br class="compact-break">从了解自己开始。</h1><p>记录身体的变化，持续关注真正重要的事。</p></div>
            <button type="button" class="subtle-button body-map-button" @click="navigate('body')">♡ 身体健康图 <span>↗</span></button>
          </section>

          <div class="dashboard-grid">
            <section class="snapshot-card">
              <div class="card-topline"><span>健康概览</span><span>最近 30 天 <span class="arrow">↗</span></span></div>
              <div class="snapshot-heading"><strong>关注进展，<br>而不只是数字。</strong><span class="pulse-illustration" aria-hidden="true">♡</span></div>
              <p class="snapshot-copy">这里汇总持续关注事项、最近记录与值得回顾的变化，不生成未经验证的健康总分。</p>
              <div class="snapshot-stats"><button type="button" @click="selectBody('健康问题'); activeTab = 'body'"><b>2</b><span>持续关注 <span>›</span></span></button><button type="button" @click="selectBody('资料'); activeTab = 'body'"><b>1</b><span>演示资料 <span>›</span></span></button></div>
            </section>

            <section class="section-card focus-card">
              <div class="section-heading"><div><p class="eyebrow">MY FOCUS</p><h2>持续关注</h2></div><button class="text-action" type="button" @click="selectBody('健康问题'); activeTab = 'body'">查看全部 ↗</button></div>
              <button v-for="concern in concerns" :key="concern.id" type="button" class="concern-line" @click="showConcern(concern.id)">
                <span class="concern-icon" :class="concern.tone">{{ concern.id === 'balance' ? '◷' : '✧' }}</span>
                <span class="concern-copy"><strong>{{ concern.name }}</strong><small>{{ concern.caption }}</small></span><span class="chevron">›</span>
              </button>
            </section>

            <section class="section-card trends-card">
              <div class="section-heading"><div><p class="eyebrow">KEY METRICS</p><h2>关键指标</h2></div><button class="text-action" type="button" @click="selectBody('指标'); activeTab = 'body'">全部指标 ↗</button></div>
              <div class="metric-grid">
                <button type="button" class="metric-tile" @click="showMetric('体重')"><span>体重</span><strong>{{ currentMetricValue }} <small>kg</small></strong><span class="mini-line" aria-hidden="true"><svg viewBox="0 0 120 38" preserveAspectRatio="none"><polyline points="0,31 20,25 40,29 60,17 80,20 100,10 120,7"/></svg></span><small>查看记录与趋势 ↗</small></button>
                <button type="button" class="metric-tile" @click="showMetric('收缩压')"><span>收缩压</span><strong>117 <small>mmHg</small></strong><span class="mini-line secondary" aria-hidden="true"><svg viewBox="0 0 120 38" preserveAspectRatio="none"><polyline points="0,11 20,19 40,9 60,22 80,26 100,19 120,23"/></svg></span><small>查看记录与趋势 ↗</small></button>
              </div>
            </section>

            <section class="section-card today-card">
              <div class="section-heading"><div><p class="eyebrow">A LITTLE EVERY DAY</p><h2>今天可以做什么</h2></div><span class="muted-count">{{ checkedTasks.length }}/2 已完成</span></div>
              <button v-for="task in [{id:'record',title:'记录今日体重',desc:'预计 1 分钟'},{id:'stretch',title:'做一组舒展运动',desc:'按自己的节奏'}]" :key="task.id" class="task-row" type="button" @click="toggleTask(task.id)">
                <span class="task-check" :class="{ done: checkedTasks.includes(task.id) }">{{ checkedTasks.includes(task.id) ? '✓' : '' }}</span>
                <span><strong :class="{ crossed: checkedTasks.includes(task.id) }">{{ task.title }}</strong><small>{{ task.desc }}</small></span>
              </button>
              <button class="text-action inline-action" type="button" @click="overlay = 'record'">＋ 记录一项健康数据</button>
            </section>

            <section class="section-card recent-card">
              <div class="section-heading"><div><p class="eyebrow">YOUR HISTORY</p><h2>最近发生</h2></div><button class="text-action" type="button" @click="selectBody('时间线'); activeTab = 'body'">时间线 ↗</button></div>
              <div v-for="event in demoEvents.slice(0, 2)" :key="event.title" class="timeline-item"><span class="timeline-glyph">{{ event.symbol }}</span><div><strong>{{ event.title }}</strong><small>{{ event.date }} · {{ event.sub }}</small></div></div>
            </section>
          </div>
          <button class="ask-strip" type="button" @click="overlay = 'agent'"><span class="ask-sparkle">✦</span><span><strong>问问 Health</strong><small>分析变化、了解记录、准备下一步</small></span><span class="ask-arrow">↗</span></button>
        </div>

        <div v-else-if="activeTab === 'body'" class="body-page">
          <div v-if="selectedConcern" class="detail-view">
            <button class="back-link" type="button" @click="selectedConcern = null">← 返回健康问题</button>
            <div class="heading-block"><p class="eyebrow">HEALTH CONCERN</p><h1>{{ currentConcern?.name }}</h1><p>{{ currentConcern?.caption }} · 自 {{ currentConcern?.since }} 起</p></div>
            <div class="detail-grid">
              <section class="section-card detail-hero"><div class="section-heading"><h2>现在怎么样？</h2><span class="fake-label">演示数值</span></div><strong class="large-reading">{{ selectedConcern === 'balance' ? '117' : '3 次' }}</strong><span class="reading-unit">{{ selectedConcern === 'balance' ? 'mmHg · 最近测量' : '本月演示训练记录' }}</span><svg viewBox="0 0 340 90" class="chart"><polyline points="5,33 68,45 132,22 196,56 260,64 335,50" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg><button type="button" class="text-action" @click="showMetric('收缩压')">查看相关指标 ↗</button></section>
              <section class="section-card"><div class="section-heading"><h2>正在做什么？</h2></div><p class="card-explanation">可以把持续干预、通用 Task 和 HealthRegimen 组织在这里，保持方案与执行事实分离。</p><button type="button" class="soft-action" @click="overlay = 'record'">＋ 添加观测</button></section>
              <section class="section-card"><div class="section-heading"><h2>最近发生了什么？</h2></div><div v-for="event in demoEvents.slice(0,2)" :key="event.title" class="timeline-item"><span class="timeline-glyph">{{ event.symbol }}</span><div><strong>{{ event.title }}</strong><small>{{ event.date }}</small></div></div></section>
              <section class="section-card"><div class="section-heading"><h2>有哪些依据？</h2></div><p class="card-explanation">原始健康资料保留为 HealthDocument，评估必须能回溯到支持它的观测或文档。</p><button type="button" class="soft-action" @click="overlay = 'upload'">▤ 添加报告</button></section>
            </div>
          </div>
          <div v-else-if="selectedMetric" class="detail-view">
            <button class="back-link" type="button" @click="selectedMetric = null">← 返回指标</button>
            <div class="heading-block"><p class="eyebrow">HEALTH METRIC</p><h1>{{ selectedMetric }}</h1><p>围绕时间、单位和来源查看数据。</p></div>
            <section class="section-card wide-detail"><div class="section-heading"><h2>最近的演示趋势</h2><span class="fake-label">示例 · 非医学判断</span></div><div class="reading-box"><strong>{{ selectedMetric === '体重' ? currentMetricValue : '117' }}</strong><span>{{ selectedMetric === '体重' ? 'kg' : 'mmHg' }}</span></div><svg class="chart chart-large" viewBox="0 0 580 170" preserveAspectRatio="none"><polyline points="10,70 120,96 230,48 340,115 450,123 570,87" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/></svg><div class="chart-months"><span v-for="item in demoTrend" :key="item.month">{{ item.month }}</span></div><button class="soft-action" type="button" @click="recordingMetric = selectedMetric; overlay = 'record'">＋ 记录 {{ selectedMetric }}</button></section>
          </div>
          <template v-else>
            <div class="heading-block body-heading"><div><p class="eyebrow">UNDERSTAND YOUR BODY</p><h1>身体与健康</h1><p>围绕健康问题、指标、资料和时间展开。</p></div><button type="button" class="primary-action" @click="overlay = 'record'">＋ 新建记录</button></div>
            <div class="subnav" aria-label="身体子导航"><button v-for="view in bodyViews" :key="view" :class="{ selected: bodyView === view }" type="button" @click="selectBody(view)">{{ view }}</button></div>
            <div v-if="bodyView === '概览'" class="body-overview">
              <button class="body-map-preview" type="button" @click="bodyView = '健康问题'"><span class="map-symbol">♙</span><span><strong>身体健康图</strong><small>从身体部位发现相关健康问题，独立视图将在后续完善</small></span><span>↗</span></button>
              <div class="body-overview-grid"><section class="section-card"><div class="section-heading"><h2>健康问题</h2><button class="text-action" type="button" @click="bodyView = '健康问题'">查看全部 ↗</button></div><button class="concern-line" v-for="c in concerns" :key="c.id" type="button" @click="showConcern(c.id)"><span class="concern-icon" :class="c.tone">♡</span><span class="concern-copy"><strong>{{ c.name }}</strong><small>{{ c.caption }}</small></span><span class="chevron">›</span></button></section><section class="section-card"><div class="section-heading"><h2>最近记录</h2><button class="text-action" type="button" @click="bodyView = '时间线'">时间线 ↗</button></div><div v-for="e in demoEvents" :key="e.title" class="timeline-item"><span class="timeline-glyph">{{ e.symbol }}</span><div><strong>{{ e.title }}</strong><small>{{ e.date }}</small></div></div></section></div>
            </div>
            <div v-else-if="bodyView === '健康问题'" class="list-panel"><button v-for="c in concerns" :key="c.id" type="button" class="list-card" @click="showConcern(c.id)"><span class="concern-icon" :class="c.tone">♡</span><span><strong>{{ c.name }}</strong><small>{{ c.caption }}</small></span><span class="chevron">›</span></button></div>
            <div v-else-if="bodyView === '指标'" class="list-panel"><button v-for="m in ['体重','收缩压']" :key="m" type="button" class="list-card" @click="showMetric(m)"><span class="concern-icon mint">⌁</span><span><strong>{{ m }}</strong><small>观测记录、趋势与原始来源</small></span><span class="chevron">›</span></button></div>
            <div v-else-if="bodyView === '时间线'" class="list-panel"><div v-for="event in demoEvents" :key="event.title" class="list-card static-card"><span class="timeline-glyph">{{ event.symbol }}</span><span><strong>{{ event.title }}</strong><small>{{ event.date }} · {{ event.sub }}</small></span></div><div v-for="item in demoRecords" :key="item.date + item.name + item.value" class="list-card static-card"><span class="timeline-glyph">◉</span><span><strong>手动记录 {{ item.name }} {{ item.value }} {{ item.unit }}</strong><small>{{ item.date }} · 仅本页面模拟</small></span></div></div>
            <div v-else-if="bodyView === '资料'" class="section-card empty-workspace"><span class="empty-icon">▤</span><h2>每份资料，都有出处</h2><p>上传检验单、报告或其他健康文档，后续由 AI 提取并由用户核对。原始文件和结构化结果相互独立。</p><button type="button" class="primary-action" @click="overlay = 'upload'">模拟上传健康报告</button></div>
            <div v-else class="section-card empty-workspace"><span class="empty-icon">◇</span><h2>让持续方案变得可执行</h2><p>这里汇集 HealthRegimen、通用 Task 与 Recurrence 生成的待办；目前仅展示交互方向。</p><button type="button" class="soft-action" @click="toast('健康方案编辑将在下一阶段接入模型。')">查看功能规划</button></div>
          </template>
        </div>

        <div v-else class="coming-page">
          <div class="heading-block"><p class="eyebrow">NEXT IN ALOHA HEALTH</p><h1>{{ label }}</h1><p>与身体管理使用相同的健康语言，但拥有独立的记录与分析体验。</p></div>
          <div class="section-card coming-card"><div class="coming-icon">{{ activeTab === 'nutrition' ? '◈' : '↗' }}</div><h2>{{ activeTab === 'nutrition' ? '理解你的饮食' : '看见你的运动进展' }}</h2><p>{{ activeTab === 'nutrition' ? '食物摄入、营养结构与健康关注事项的关联，是后续 NutritionIntake 模型的体验范围。' : '运动 Session、训练记录和身体变化，将在 ExerciseSession 模型准备好后接入。' }}</p><span class="second-phase">第二批 · 当前为导航原型</span></div>
        </div>
      </main>
    </div>

    <nav class="mobile-tabs" aria-label="Health 主导航">
      <button v-for="tab in tabs" :key="tab.id" type="button" :class="{ active: activeTab === tab.id }" @click="navigate(tab)"><span>{{ tab.mark }}</span><small>{{ tab.title }}</small></button>
    </nav>

    <div v-if="overlay" class="overlay-screen" @click.self="closeOverlay">
      <section class="overlay-sheet" role="dialog" aria-modal="true" :aria-label="overlay === 'agent' ? 'Health Agent 演示' : overlay === 'record' ? '录入健康数据演示' : 'Health 功能面板'">
        <div class="sheet-handle"></div>
        <div class="sheet-title"><div><p class="eyebrow">ALOHA HEALTH · PREVIEW</p><h2>{{ overlay === 'agent' ? '问问 Health ✦' : overlay === 'record' ? '快速记录' : overlay === 'upload' ? '导入健康报告' : overlay === 'apps' ? 'ALOHA 应用' : '账号与授权' }}</h2></div><button class="round-action" aria-label="关闭" type="button" @click="closeOverlay">×</button></div>

        <template v-if="overlay === 'agent'"><div class="agent-intro"><span class="agent-orb">✦</span><strong>在当前页面直接提问</strong><p>演示上下文：{{ currentConcern?.name ?? selectedMetric ?? label }}。本演示不连接 AI 服务，也不会读取真实健康数据。</p></div><div class="suggestions"><button type="button" @click="agentDraft = '帮我看一下最近的趋势'; askAgent()">看看最近的变化</button><button type="button" @click="agentDraft = '帮我理解这份报告'; askAgent()">如何理解报告？</button></div><div v-if="agentAnswer" class="agent-reply">{{ agentAnswer }}</div><form class="sheet-form" @submit.prevent="askAgent"><label for="agent-input">输入问题</label><textarea id="agent-input" v-model="agentDraft" rows="3" placeholder="想了解哪些健康记录？"></textarea><button class="primary-action" type="submit">模拟提问 ↗</button></form></template>

        <form v-else-if="overlay === 'record'" class="sheet-form" @submit.prevent="addRecord"><p class="sheet-help">演示记录只在当前页面内存中显示，刷新后清空，不会发送到服务器。</p><label for="metric-input">健康指标</label><select id="metric-input" v-model="recordingMetric"><option>体重</option><option>收缩压</option></select><label for="value-input">观测数值（{{ recordingMetric === '体重' ? 'kg' : 'mmHg' }}）</label><input id="value-input" v-model="recordingValue" inputmode="decimal" placeholder="请输入数值" required><label for="note-input">补充说明（选填）</label><textarea id="note-input" v-model="recordingNote" rows="2" placeholder="例如：早晨测量"></textarea><button class="primary-action" type="submit">加入演示时间线</button></form>

        <div v-else-if="overlay === 'upload'" class="sheet-form"><p class="sheet-help">模拟 HealthDocument → AI 提取 → 确认的用户路径。为了隐私，此处不读取文件内容、也不上传。</p><label for="file-input" class="upload-drop"><span>▤</span><strong>选取一份本地演示文件</strong><small>仅显示文件名，不保存文件</small></label><input id="file-input" type="file" accept=".pdf,.png,.jpg,.jpeg" @change="handleFile"><div v-if="documentName" class="picked-file">已选择：{{ documentName }}</div><button type="button" class="primary-action" :disabled="!documentName" @click="demoDocument">预览提取流程</button><div v-if="documentPreview" class="agent-reply"><strong>演示提取预览</strong><p>1. 保留原始 HealthDocument</p><p>2. 检查结构化 Observation / Event / Assessment</p><p>3. 用户确认后写入 LifeSpace（原型未执行）</p></div></div>

        <div v-else-if="overlay === 'apps'" class="switcher-list"><div class="switcher-item is-current"><span class="app-emoji">♥</span><div><strong>Health</strong><small>当前演示应用</small></div><span>✓</span></div><button v-for="app in ['Assistant','Finance','Things']" :key="app" class="switcher-item" type="button" @click="toast(app + ' 的切换路由尚未在本原型接入。')"><span class="app-emoji">{{ app === 'Assistant' ? '✦' : app === 'Finance' ? '▥' : '⬡' }}</span><div><strong>{{ app }}</strong><small>共享 ALOHA 产品入口 · 待联调</small></div><span>↗</span></button></div>

        <div v-else class="agent-intro"><span class="agent-orb">◉</span><strong>统一的个人与授权入口</strong><p>Health 只管理当前用户的 Personal Space，不提供家庭成员切换。跨应用与数据共享使用 LifeSpace 授权；此处仅为导航占位。</p></div>
      </section>
    </div>
    <div v-if="notice" class="notice" role="status"><span>{{ notice }}</span><button aria-label="关闭提示" type="button" @click="notice = ''">×</button></div>
  </div>
</template>
