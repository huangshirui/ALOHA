<script setup lang="ts">
import { ref, watch } from 'vue'
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
  page?: boolean
  entryOnly?: boolean
  initialSection?: HubSection
}>(), { compact:false, density:'comfortable', preview:false, page:false, entryOnly:false, initialSection:'apps' })

const emit = defineEmits<{
  selectApp: [id: string]
  'update:density': [value: Density]
  openMore: []
  openSetting: [section: Exclude<HubSection,'apps'>]
  'update:section': [section: HubSection]
}>()

const opened = ref(false)
const section = ref<HubSection>(props.initialSection)
watch(() => props.initialSection, value => { section.value = value })
// Reuse the installed Health PWA icon so the tab, sidebar and app switcher agree.
const healthIconUrl = `${import.meta.env.BASE_URL}app-icon.svg`
function showMenu() {
  if(props.entryOnly){ emit('openMore');return }
  section.value = 'apps'
  opened.value = !opened.value
}
function close() { opened.value = false }
function goTo(sectionId: HubSection) {
  if (!props.page && sectionId!=='apps') {
    close()
    emit('openSetting', sectionId)
    return
  }
  section.value = sectionId
  emit('update:section', sectionId)
}
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
  <div class="aloha-hub" :class="{ 'page-hub': page }">
    <button v-if="!page" type="button" class="aloha-hub-trigger" :class="{ compact }"
      :aria-expanded="entryOnly ? undefined : opened" :aria-haspopup="entryOnly ? undefined : 'dialog'" :aria-label="entryOnly?'打开更多页面':'ALOHA 公共菜单'"
      title="打开 ALOHA 应用中心" @click="showMenu">
      <span class="aloha-hub-logo">
        <img v-if="currentApp==='health'" :src="healthIconUrl" alt="" aria-hidden="true"/>
        <component v-else :is="appGlyph(currentApp)" :size="compact ? 19 : 22" aria-hidden="true"/>
      </span>
        <span v-if="!compact" class="aloha-hub-wordmark"><strong>ALOHA</strong><small>{{ currentApp.toUpperCase() }}</small></span>
      <ChevronDown v-if="!compact && !entryOnly" :size="17" class="aloha-hub-chevron"/>
      <ArrowUpRight v-else-if="entryOnly && !compact" :size="17" class="aloha-hub-chevron"/>
    </button>
    <template v-if="opened || page">
      <button v-if="!page" class="aloha-hub-dismiss" aria-label="关闭公共菜单" type="button" tabindex="-1" @click="close"></button>
      <section class="aloha-hub-popup" :role="page?'region':'dialog'" aria-label="ALOHA 应用及公共设置" @keydown.esc.stop="close">
        <header v-if="!page" class="aloha-hub-topline">
          <div><strong>ALOHA</strong><small>应用与公共入口</small></div>
          <button type="button" class="aloha-hub-icon" aria-label="关闭应用中心" @click="close"><X :size="18"/></button>
        </header>
        <button v-else-if="section!=='apps'" type="button" class="aloha-hub-back" @click="goTo('apps')"><ArrowLeft :size="17"/> 返回更多</button>

        <div v-if="section==='apps'" class="aloha-hub-panel-body">
          <section class="aloha-hub-apps" aria-label="ALOHA 应用">
            <div class="aloha-hub-group-caption">ALOHA 应用</div>
            <div class="aloha-hub-app-grid">
              <template v-for="app in apps" :key="app.id">
                <a v-if="app.href && app.id!==currentApp" class="aloha-hub-app" :href="app.href" @click="close">
                  <span class="aloha-hub-app-icon" :class="'app-icon-'+app.id">
                    <img v-if="app.id==='health'" :src="healthIconUrl" alt="" aria-hidden="true"/>
                    <component v-else :is="appGlyph(app.id)" :size="23" aria-hidden="true"/>
                  </span>
                  <span class="aloha-hub-app-copy"><b>{{ app.name }}</b><small>{{ app.description }}</small></span>
                  <span class="aloha-hub-app-state">打开 <ArrowUpRight :size="13"/></span>
                </a>
                <button v-else type="button" class="aloha-hub-app" :class="{ selected:app.id===currentApp }"
                  :disabled="app.id!==currentApp" @click="selectApp(app)">
                  <span class="aloha-hub-app-icon" :class="'app-icon-'+app.id">
                    <img v-if="app.id==='health'" :src="healthIconUrl" alt="" aria-hidden="true"/>
                    <component v-else :is="appGlyph(app.id)" :size="23" aria-hidden="true"/>
                  </span>
                  <span class="aloha-hub-app-copy"><b>{{ app.name }}</b><small>{{ app.description }}</small></span>
                  <span class="aloha-hub-app-state">
                    <template v-if="app.id===currentApp"><Check :size="13"/> 当前应用</template>
                    <template v-else>待接入</template>
                  </span>
                </button>
              </template>
            </div>
          </section>
          <section class="aloha-hub-services" aria-label="ALOHA 公共入口">
            <div class="aloha-hub-group-caption">账号与设置</div>
            <div class="aloha-hub-service-grid">
              <button class="aloha-hub-link" type="button" @click="goTo('account')"><UserRound :size="19"/>账号与安全 <ChevronDown :size="15"/></button>
              <button class="aloha-hub-link" type="button" @click="goTo('settings')"><Settings2 :size="19"/>通用设置 <ChevronDown :size="15"/></button>
              <button class="aloha-hub-link" type="button" @click="goTo('privacy')"><ShieldCheck :size="19"/>隐私与授权 <ChevronDown :size="15"/></button>
              <button class="aloha-hub-link" type="button" @click="goTo('help')"><CircleHelp :size="19"/>帮助与反馈 <ChevronDown :size="15"/></button>
            </div>
          </section>
          <p v-if="page && preview" class="aloha-hub-footer-note">ALOHA Health · 体验版本 · 部分应用尚未接入</p>
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
.aloha-hub-trigger { display:flex;align-items:center;gap:.65rem;width:100%;padding:.15rem .65rem;border:0;background:transparent;color:var(--aloha-color-text);text-align:left; }
.aloha-hub-trigger.compact { justify-content:center;padding:.1rem; }
.aloha-hub-logo { display:grid;place-items:center;flex:none;width:2.75rem;height:2.75rem;overflow:hidden;border-radius:var(--aloha-radius-md);background:transparent;color:var(--aloha-accent-strong); }
.aloha-hub-logo img,.aloha-hub-app-icon img { display:block;width:100%;height:100%;object-fit:contain; }
.aloha-hub-wordmark { display:flex;flex:1;flex-direction:column;gap:.1rem;min-width:0; }
.aloha-hub-wordmark strong { font-size:1.16rem;letter-spacing:-.035em; }
.aloha-hub-wordmark small { font-size:.64rem;letter-spacing:.15em;color:var(--aloha-accent-strong);font-weight:700; }
.aloha-hub-chevron { color:var(--aloha-color-text-muted); }
.aloha-hub-dismiss { position:fixed;inset:0;background:transparent;border:0;z-index:1;cursor:default; }
.aloha-hub-popup { position:absolute;top:calc(100% + .7rem);left:0;z-index:2;width:min(25rem,calc(100vw - 1.5rem));max-height:min(82dvh,43rem);overflow-y:auto;background:var(--aloha-color-surface);border:1px solid var(--aloha-color-border);box-shadow:var(--aloha-shadow-floating);border-radius:var(--aloha-radius-lg); }
.aloha-hub-topline { display:flex;align-items:center;gap:.6rem;padding:1rem 1.1rem .85rem;border-bottom:1px solid var(--aloha-color-border); }
.aloha-hub-topline>div { flex:1;display:flex;flex-direction:column;gap:.2rem; }
.aloha-hub-topline strong { font-size:1rem; }
.aloha-hub-topline small { font-size:.7rem;color:var(--aloha-color-text-muted); }
.aloha-hub-icon { display:grid;place-items:center;flex:none;width:2rem;height:2rem;border:0;border-radius:var(--aloha-radius-sm);background:transparent;color:var(--aloha-color-text-muted); }
.aloha-hub-icon:hover { background:var(--aloha-accent-soft); }
.aloha-hub-panel-body { padding:.8rem 1rem 1rem; }
.aloha-hub-group-caption { font-size:var(--health-type-label);color:var(--aloha-color-text-muted);padding:.3rem .2rem .65rem;font-weight:680; }
.aloha-hub-app-grid { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.35rem; }
.aloha-hub-app { display:flex;flex-direction:column;align-items:center;gap:.45rem;min-width:0;padding:.7rem .2rem .6rem;border:1px solid transparent;border-radius:var(--aloha-radius-md);background:transparent;color:var(--aloha-color-text);text-decoration:none;text-align:center; }
.aloha-hub-app.selected { background:var(--aloha-accent-soft);border-color:color-mix(in srgb,var(--aloha-accent) 15%,transparent); }
.aloha-hub-app:not(:disabled):hover { background:var(--aloha-accent-soft); }
.aloha-hub-app:disabled { cursor:default;opacity:1; }
.aloha-hub-app-icon { display:grid;place-items:center;flex:none;width:3rem;height:3rem;border-radius:var(--aloha-radius-md);overflow:hidden;color:var(--aloha-accent-strong);background:var(--aloha-accent-soft); }
.aloha-hub-app-icon.app-icon-health { background:transparent; }
.aloha-hub-app-icon.app-icon-assistant { color:white;background:linear-gradient(135deg,#274d8c,#10284c); }
.aloha-hub-app-icon.app-icon-finance { color:white;background:linear-gradient(135deg,#ffc85a,#e89616); }
.aloha-hub-app-icon.app-icon-things { color:white;background:linear-gradient(135deg,#8170ed,#5541c6); }
.aloha-hub-app-copy { display:flex;flex-direction:column;gap:.12rem;min-width:0;width:100%; }
.aloha-hub-app-copy b { font-size:var(--health-type-label);font-weight:650;white-space:nowrap; }
.aloha-hub-app-copy small { display:none; }
.aloha-hub-app-state { display:inline-flex;align-items:center;justify-content:center;gap:.2rem;min-height:1rem;color:var(--aloha-color-text-muted);font-size:.64rem;white-space:nowrap; }
.aloha-hub-app.selected .aloha-hub-app-state { color:var(--aloha-accent-strong); }
.aloha-hub-services { border-top:1px solid var(--aloha-color-border);margin-top:.85rem;padding-top:.8rem; }
.aloha-hub-service-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.2rem; }
.aloha-hub-link { display:flex;align-items:center;gap:.55rem;min-height:2.8rem;width:100%;padding:.55rem .45rem;border:0;border-radius:var(--aloha-radius-sm);background:transparent;color:var(--aloha-color-text);text-align:left;font-size:var(--health-type-label); }
.aloha-hub-link:hover { background:var(--aloha-accent-soft); }
.aloha-hub-link svg:last-child { margin-left:auto;color:var(--aloha-color-text-muted);transform:rotate(-90deg); }
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
.aloha-hub-back { display:flex;align-items:center;gap:.4rem;border:0;background:transparent;padding:.55rem .2rem;color:var(--aloha-accent-strong);font-size:var(--health-type-label); }
.aloha-hub-footer-note { margin:1rem .2rem .1rem;font-size:var(--health-type-caption);color:var(--aloha-color-text-muted); }
.page-hub { width:100%;max-width:65rem; }
.page-hub .aloha-hub-popup { position:static;width:100%;max-height:none;overflow:visible;box-shadow:none;border:0;border-radius:0;background:transparent; }
.page-hub .aloha-hub-panel-body { padding:0; }
.page-hub .aloha-hub-app-grid { grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem; }
.page-hub .aloha-hub-app { gap:.45rem;min-height:8.6rem;padding:1rem .5rem;background:var(--aloha-color-surface);border:1px solid var(--aloha-color-border); }
.page-hub .aloha-hub-app.selected { background:var(--aloha-accent-soft);border-color:var(--aloha-accent); }
.page-hub .aloha-hub-app-icon { width:2.8rem;height:2.8rem; }
.page-hub .aloha-hub-app-copy small { display:none; }
.page-hub .aloha-hub-app-copy b { font-size:var(--health-type-body); }
.page-hub .aloha-hub-services { margin-top:1.4rem;padding-top:1.3rem; }
.page-hub .aloha-hub-service-grid { display:block;background:var(--aloha-color-surface);border:1px solid var(--aloha-color-border);border-radius:var(--aloha-radius-md);overflow:hidden; }
.page-hub .aloha-hub-link { min-height:3.3rem;padding:.85rem 1rem;border-radius:0; }
.page-hub .aloha-hub-link + .aloha-hub-link { border-top:1px solid var(--aloha-color-border); }
.page-hub .aloha-hub-back { margin:0 0 1rem; }
@media (max-width:28rem) {
  .page-hub .aloha-hub-app { min-height:7.7rem; }
}
</style>