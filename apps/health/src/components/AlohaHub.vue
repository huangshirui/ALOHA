<script setup lang="ts">
import { ref } from 'vue'
import {
  ArrowLeft, ArrowUpRight, Bell, Check, ChevronDown, CircleHelp, Heart,
  LayoutGrid, LockKeyhole, Settings2, ShieldCheck, Sparkles, UserRound, Wallet, Box,
  X
} from 'lucide-vue-next'

interface AlohaAppLink {
  id: string
  name: string
  description: string
  href?: string
}
type HubSection = 'apps' | 'account' | 'settings' | 'privacy' | 'help'
type Density = 'comfortable' | 'compact'

const props = withDefaults(defineProps<{
  currentApp: string
  apps: AlohaAppLink[]
  compact?: boolean
  density?: Density
  preview?: boolean
  bottomNav?: boolean
  page?: boolean
  entryOnly?: boolean
}>(), { compact:false, density:'comfortable', preview:false, bottomNav:false, page:false, entryOnly:false })

const emit = defineEmits<{
  selectApp: [id: string]
  'update:density': [value: Density]
  openMore: []
}>()

const opened = ref(false)
const section = ref<HubSection>('apps')
function showMenu() {
  if(props.entryOnly){ emit('openMore');return }
  section.value = 'apps'
  opened.value = !opened.value
}
function close() { opened.value = false }
function goTo(sectionId: HubSection) { section.value = sectionId }
function appGlyph(id: string) {
  return id === 'assistant' ? Sparkles : id === 'health' ? Heart :
    id === 'finance' ? Wallet : id === 'things' ? Box : LayoutGrid
}
function selectApp(app: AlohaAppLink) {
  if (app.href) {
    close()
    return
  }
  if (app.id === props.currentApp) { emit('selectApp', app.id); close() }
}
</script>

<template>
  <div class="aloha-hub" :class="{ 'bottom-nav-hub': bottomNav, 'page-hub': page }">
    <button v-if="!page" type="button" class="aloha-hub-trigger" :class="{ compact }"
      :aria-expanded="opened" aria-haspopup="dialog" :aria-label="bottomNav?'应用、账号与设置':'ALOHA 公共菜单'"
      title="应用、账号与设置" @click="showMenu">
      <template v-if="bottomNav"><LayoutGrid :size="22" :stroke-width="1.8"/><span class="aloha-hub-bottom-label">应用</span></template>
      <template v-else>
        <span class="aloha-hub-logo"><Heart :size="compact ? 19 : 22" fill="currentColor"/></span>
        <span v-if="!compact" class="aloha-hub-wordmark"><strong>ALOHA</strong><small>{{ currentApp.toUpperCase() }}</small></span>
        <ChevronDown v-if="!compact" :size="17" class="aloha-hub-chevron"/>
      </template>
    </button>
    <template v-if="opened || page">
      <button v-if="!page" class="aloha-hub-dismiss" aria-label="关闭公共菜单" type="button" @click="close"></button>
      <section class="aloha-hub-popup" :role="page?'region':'dialog'" aria-label="ALOHA 应用及公共设置" @keydown.esc.stop="close">
        <header class="aloha-hub-topline">
          <button v-if="section!=='apps'" type="button" class="aloha-hub-icon" aria-label="返回应用列表" @click="goTo('apps')"><ArrowLeft :size="18"/></button>
          <div><strong>{{ section==='apps'?'ALOHA':section==='account'?'账号与安全':section==='settings'?'通用设置':section==='privacy'?'隐私与授权':'帮助与反馈' }}</strong>
            <small>{{ section==='apps'?'同一个 ALOHA · 不同的入口':'这些设置适用于整个 ALOHA' }}</small></div>
          <button v-if="!page" type="button" class="aloha-hub-icon" aria-label="关闭菜单" @click="close"><X :size="18"/></button>
        </header>

        <div v-if="section==='apps'" class="aloha-hub-panel-body">
          <div class="aloha-hub-group-caption">应用</div>
          <template v-for="app in apps" :key="app.id">
            <a v-if="app.href && app.id!==currentApp" class="aloha-hub-app" :href="app.href" @click="close">
              <span class="aloha-hub-app-icon"><component :is="appGlyph(app.id)" :size="21"/></span>
              <span class="aloha-hub-app-copy"><b>{{ app.name }}</b><small>{{ app.description }}</small></span>
              <ArrowUpRight :size="17"/>
            </a>
            <button v-else type="button" class="aloha-hub-app" :class="{ selected:app.id===currentApp }" :disabled="app.id!==currentApp" @click="selectApp(app)">
              <span class="aloha-hub-app-icon"><component :is="appGlyph(app.id)" :size="21"/></span>
              <span class="aloha-hub-app-copy"><b>{{ app.name }}</b><small>{{ app.id===currentApp?'当前应用':app.description }}</small></span>
              <Check v-if="app.id===currentApp" :size="17"/>
              <span v-else class="aloha-hub-pending">待接入</span>
            </button>
          </template>
          <div class="aloha-hub-group-caption second">ALOHA 公共入口</div>
          <button class="aloha-hub-link" type="button" @click="goTo('account')"><UserRound :size="18"/>账号与安全 <ArrowUpRight :size="15"/></button>
          <button class="aloha-hub-link" type="button" @click="goTo('settings')"><Settings2 :size="18"/>通用设置 <ArrowUpRight :size="15"/></button>
          <button class="aloha-hub-link" type="button" @click="goTo('privacy')"><ShieldCheck :size="18"/>隐私与授权 <ArrowUpRight :size="15"/></button>
          <button class="aloha-hub-link" type="button" @click="goTo('help')"><CircleHelp :size="18"/>帮助与反馈 <ArrowUpRight :size="15"/></button>
        </div>

        <div v-else-if="section==='settings'" class="aloha-hub-panel-body">
          <div class="aloha-hub-group-caption">界面偏好</div>
          <p class="aloha-hub-note">应用共享同一套设计语言。当前可调整页面密度，仅影响本次预览。</p>
          <div class="aloha-hub-setting"><span><LayoutGrid :size="18"/>页面密度</span>
            <div role="group" aria-label="页面密度" class="aloha-hub-segmented">
              <button type="button" :aria-pressed="density==='comfortable'" :class="{ active:density==='comfortable' }" @click="emit('update:density','comfortable')">舒适</button>
              <button type="button" :aria-pressed="density==='compact'" :class="{ active:density==='compact' }" @click="emit('update:density','compact')">紧凑</button>
            </div>
          </div>
          <div class="aloha-hub-info"><Settings2 :size="18"/><span><b>外观与语言</b><small>未来统一支持系统主题、深色模式和多语言。</small></span></div>
          <div class="aloha-hub-info"><Bell :size="18"/><span><b>通知与提醒</b><small>将统一管理跨应用通知偏好；本原型暂不提供通知。</small></span></div>
        </div>
        <div v-else-if="section==='account'" class="aloha-hub-panel-body">
          <div class="aloha-hub-info"><UserRound :size="19"/><span><b>{{ preview?'体验模式 · 未登录':'账号资料' }}</b><small>{{ preview?'此页面未接入真实 ALOHA 账号。':'统一管理个人资料与身份信息。' }}</small></span></div>
          <div class="aloha-hub-info"><LockKeyhole :size="19"/><span><b>登录方式与设备</b><small>未来统一管理邮箱、第三方登录与已登录设备。</small></span></div>
          <p class="aloha-hub-note">正式账号与登录权限归属 LifeSpace Identity；这里不自行创建账号或模拟退出登录。</p>
        </div>
        <div v-else-if="section==='privacy'" class="aloha-hub-panel-body">
          <div class="aloha-hub-info"><ShieldCheck :size="19"/><span><b>数据共享与授权</b><small>查看哪些应用和人员可以访问你的数据，并管理授权。</small></span></div>
          <div class="aloha-hub-info"><LockKeyhole :size="19"/><span><b>隐私与安全</b><small>数据保留、导出及访问记录由统一平台能力提供。</small></span></div>
          <p class="aloha-hub-note">当前只是入口规划，不代表已获得或开放任何健康数据权限。</p>
        </div>
        <div v-else class="aloha-hub-panel-body">
          <div class="aloha-hub-info"><CircleHelp :size="19"/><span><b>帮助中心</b><small>使用指南、常见问题与功能反馈会使用统一入口。</small></span></div>
          <div class="aloha-hub-info"><Sparkles :size="19"/><span><b>关于 ALOHA</b><small>个人助手与专业领域应用组成的一套产品体验。</small></span></div>
          <p v-if="preview" class="aloha-hub-note">当前为体验版本，部分能力正在设计中。</p>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.aloha-hub { position:relative; min-width:0; }
.page-hub { width:100%;max-width:54rem; }
.page-hub .aloha-hub-popup { position:static;width:100%;max-height:none;overflow:visible;box-shadow:none;border-radius:var(--health-radius-card); }
.page-hub .aloha-hub-topline { padding:1rem 1.2rem; }
.page-hub .aloha-hub-panel-body { padding:1rem 1.2rem; }
.page-hub .aloha-hub-group-caption { font-size:var(--health-type-label); }
.page-hub .aloha-hub-app-copy b { font-size:var(--health-type-body); }
.page-hub .aloha-hub-app-copy small { font-size:var(--health-type-caption); }
.aloha-hub.bottom-nav-hub { display:flex;align-self:stretch;width:100%;min-width:0; }
.bottom-nav-hub .aloha-hub-trigger { display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.22rem;height:100%;padding:0 .2rem;color:var(--health-muted);border-radius:var(--health-radius-control); }
.bottom-nav-hub .aloha-hub-trigger:hover,.bottom-nav-hub .aloha-hub-trigger[aria-expanded="true"] { color:var(--health-brand-strong);background:var(--health-brand-subtle); }
.aloha-hub-bottom-label { font-size:.69rem;line-height:1.2; }
.aloha-hub-trigger { display:flex;align-items:center;gap:.65rem;width:100%;padding:.15rem .65rem;border:0;background:transparent;color:var(--aloha-color-text);text-align:left; }
.aloha-hub-trigger.compact { justify-content:center; padding:.1rem; }
.aloha-hub-logo { display:grid;place-items:center;flex:none;width:2.75rem;height:2.75rem;border-radius:var(--aloha-radius-md);background:var(--aloha-accent);color:white; }
.aloha-hub-wordmark { display:flex;flex:1;flex-direction:column;gap:.1rem;min-width:0; }
.aloha-hub-wordmark strong { font-size:1.16rem;letter-spacing:-.035em; }
.aloha-hub-wordmark small { font-size:.64rem;letter-spacing:.15em;color:var(--aloha-accent-strong);font-weight:700; }
.aloha-hub-chevron { color:var(--aloha-color-text-muted); }
.aloha-hub-dismiss { position:fixed;inset:0;background:transparent;border:0;z-index:1;cursor:default; }
.aloha-hub-popup { position:absolute;top:calc(100% + .8rem);left:0;z-index:2;width:min(21rem,calc(100vw - 1.5rem));max-height:min(80dvh,48rem);overflow-y:auto;background:var(--aloha-color-surface);border:1px solid var(--aloha-color-border);box-shadow:var(--aloha-shadow-floating);border-radius:var(--aloha-radius-lg); }
.bottom-nav-hub .aloha-hub-popup { top:auto;bottom:calc(100% + .65rem);right:0;left:auto;max-height:min(70dvh,35rem); }
.aloha-hub-topline { display:flex;align-items:center;gap:.6rem;padding:1rem;border-bottom:1px solid var(--aloha-color-border); }
.aloha-hub-topline>div { flex:1;display:flex;flex-direction:column;gap:.2rem; }
.aloha-hub-topline strong { font-size:1rem; }
.aloha-hub-topline small { font-size:.7rem;color:var(--aloha-color-text-muted); }
.aloha-hub-icon { display:grid;place-items:center;flex:none;width:2rem;height:2rem;border:0;border-radius:var(--aloha-radius-sm);background:transparent;color:var(--aloha-color-text-muted); }
.aloha-hub-icon:hover { background:var(--aloha-accent-soft); }
.aloha-hub-panel-body { padding:.8rem; }
.aloha-hub-group-caption { font-size:.7rem;color:var(--aloha-color-text-muted);padding:.55rem .4rem;font-weight:720; }
.aloha-hub-group-caption.second { border-top:1px solid var(--aloha-color-border);margin-top:.7rem;padding-top:1rem; }
.aloha-hub-app,.aloha-hub-link { width:100%;display:flex;align-items:center;gap:.7rem;border:0;text-decoration:none;border-radius:var(--aloha-radius-md);padding:.62rem .5rem;background:transparent;color:var(--aloha-color-text);text-align:left; }
.aloha-hub-app.selected { background:var(--aloha-accent-soft); }
.aloha-hub-app:disabled { opacity:.6;cursor:default; }
.aloha-hub-app:not(:disabled):hover,.aloha-hub-link:hover { background:var(--aloha-accent-soft); }
.aloha-hub-app-icon { display:grid;place-items:center;flex:none;width:2.55rem;height:2.55rem;border-radius:var(--aloha-radius-md);color:var(--aloha-accent-strong);background:var(--aloha-accent-soft); }
.aloha-hub-app-copy { flex:1;display:flex;min-width:0;flex-direction:column;gap:.16rem; }
.aloha-hub-app-copy b { font-size:.81rem; }
.aloha-hub-app-copy small { font-size:.7rem;color:var(--aloha-color-text-muted); }
.aloha-hub-pending { font-size:.67rem;color:var(--aloha-color-text-muted); }
.aloha-hub-link { padding:.65rem .7rem;font-size:.78rem; }
.aloha-hub-link svg:last-child { margin-left:auto;color:var(--aloha-color-text-muted); }
.aloha-hub-note { margin:.45rem .4rem 1rem;color:var(--aloha-color-text-muted);font-size:.74rem;line-height:1.65; }
.aloha-hub-info { display:flex;align-items:flex-start;gap:.7rem;padding:.85rem .5rem;border-bottom:1px solid var(--aloha-color-border); }
.aloha-hub-info>svg { flex:none;margin-top:.1rem;color:var(--aloha-accent-strong); }
.aloha-hub-info span { display:flex;flex-direction:column;gap:.3rem; }
.aloha-hub-info b { font-size:.8rem; }
.aloha-hub-info small { color:var(--aloha-color-text-muted);line-height:1.55;font-size:.72rem; }
.aloha-hub-setting { display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.85rem .4rem; }
.aloha-hub-setting>span { display:flex;align-items:center;gap:.5rem;font-size:.78rem; }
.aloha-hub-segmented { display:flex;gap:.2rem;padding:.16rem;border:1px solid var(--aloha-color-border);border-radius:var(--aloha-radius-pill); }
.aloha-hub-segmented button { border:0;border-radius:var(--aloha-radius-pill);padding:.37rem .58rem;background:transparent;color:var(--aloha-color-text-muted);font-size:.73rem; }
.aloha-hub-segmented button.active { background:var(--aloha-accent-soft);color:var(--aloha-accent-strong);font-weight:700; }
</style>
