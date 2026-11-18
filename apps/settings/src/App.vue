<script setup lang="ts">
import {computed,onMounted,ref} from 'vue'
import '@fontsource/exo-2/latin-700.css'
import {
  ArrowLeft,ArrowUpRight,ChevronRight,CircleAlert,CircleUserRound,
  HelpCircle,Layers3,Menu,RefreshCw,Settings2,ShieldCheck,
  Sparkles,UserRound,
} from 'lucide-vue-next'
import AlohaHubSettings from '@aloha/ui/AlohaHubSettings.vue'
import type {WorkspaceView} from '@aloha/contracts'
import {
  getProfile,getWorkspace,bindWorkspace,createWorkspace,safeReturn,SettingsApiError,
  type Space,type UserProfile,
} from './api'

const accountUrl='https://account.aisr.online/'
const profile=ref<UserProfile|null>(null)
const spaces=ref<Space[]>([])
const selectedId=ref('')
const workspace=ref<WorkspaceView|null>(null)
const profileError=ref<Error|null>(null)
const spaceError=ref<Error|null>(null)
const profileBusy=ref(true)
const spaceBusy=ref(true)
const message=ref('')
const mobileMenu=ref(false)
const backUrl=safeReturn(new URLSearchParams(window.location.search).get('from'))
const displayName=computed(()=>profile.value?.displayName||'账号资料')
const needsAccess=computed(()=>[profileError.value,spaceError.value].some(
  e=>e instanceof SettingsApiError&&(e.status===401||e.code==='access_required'),
))
const accountItems=[
  {label:'账号与安全',href:accountUrl,icon:UserRound},
  {label:'隐私与授权',href:accountUrl,icon:ShieldCheck},
]
async function refreshProfile(){
  profileBusy.value=true;profileError.value=null
  try{profile.value=await getProfile()}
  catch(e){profile.value=null;profileError.value=e instanceof Error?e:new Error('无法读取账号资料')}
  finally{profileBusy.value=false}
}
function applyWorkspace(view:WorkspaceView){
  workspace.value=view;spaces.value=view.spaces;selectedId.value=view.space?.id||''
}
async function refreshSpaces(){
  spaceBusy.value=true;spaceError.value=null;message.value=''
  try{applyWorkspace(await getWorkspace())}
  catch(e){
    workspace.value=null;spaces.value=[];selectedId.value=''
    spaceError.value=e instanceof Error?e:new Error('无法读取空间绑定')
  }finally{spaceBusy.value=false}
}
function refresh(){if(!spaceBusy.value||!workspace.value)void Promise.all([refreshProfile(),refreshSpaces()])}
async function configure(operation:()=>Promise<WorkspaceView>){
  if(spaceBusy.value||!workspace.value||workspace.value.status==='bound'||workspace.value.status==='creating')return
  spaceBusy.value=true;spaceError.value=null;message.value=''
  try{applyWorkspace(await operation());message.value='专属空间已保存到云端，各设备和应用共用。'}
  catch(e){
    // Re-read the durable outcome; never infer failure means nothing was created.
    const error=e instanceof Error?e:new Error('空间配置失败')
    try{applyWorkspace(await getWorkspace())}catch{workspace.value=null;spaces.value=[];selectedId.value=''}
    spaceError.value=error
  }finally{spaceBusy.value=false}
}
function choose(id:string){void configure(()=>bindWorkspace(id))}
function create(input:{name:string;timezone:string;acknowledgeUncertain:boolean}){
  void configure(()=>createWorkspace(input.name,input.timezone,input.acknowledgeUncertain))
}
onMounted(refresh)
</script>

<template>
  <div class="aloha-settings-shell" data-aloha-surface="assistant" @keydown.esc="mobileMenu=false">
    <aside class="settings-rail" :class="{'is-open':mobileMenu}" aria-label="ALOHA 公共导航" :aria-hidden="false">
      <a :href="backUrl" class="settings-brand" aria-label="返回 ALOHA">
        <span class="settings-brand-mark"><Sparkles :size="24" :stroke-width="1.85" aria-hidden="true"/></span>
        <span class="settings-brand-title"><strong>ALOHA</strong><small>SETTINGS</small></span>
      </a>

      <nav class="settings-nav" aria-label="应用设置导航">
        <div class="settings-nav-group">公共设置</div>
        <a href="/settings/" class="settings-nav-link is-current" aria-current="page" @click="mobileMenu=false">
          <Settings2 :size="20"/><span>通用设置</span>
        </a>
        <a href="#default-space" class="settings-nav-link" @click="mobileMenu=false">
          <Layers3 :size="20"/><span>专属空间</span>
        </a>
        <div class="settings-nav-group settings-nav-separator">账号与服务</div>
        <a v-for="item in accountItems" :key="item.label" class="settings-nav-link" :href="item.href"
          target="_blank" rel="noopener noreferrer" @click="mobileMenu=false">
          <component :is="item.icon" :size="20"/><span>{{ item.label }}</span><ArrowUpRight :size="15" class="settings-nav-external"/>
        </a>
        <a href="#settings-help" class="settings-nav-link" @click="mobileMenu=false">
          <HelpCircle :size="20"/><span>帮助</span>
        </a>
      </nav>

      <div class="settings-rail-bottom">
        <a :href="backUrl" class="settings-return"><ArrowLeft :size="19"/> 返回应用</a>
        <span class="settings-rail-note">ALOHA · 公共设置</span>
      </div>
    </aside>
    <button v-if="mobileMenu" class="settings-menu-scrim" type="button" aria-label="关闭导航" @click="mobileMenu=false"></button>

    <div class="settings-page-frame">
      <header class="settings-topbar">
        <button class="settings-menu-button" type="button" aria-label="打开导航" :aria-expanded="mobileMenu"
          @click="mobileMenu=!mobileMenu"><Menu :size="23"/></button>
        <span class="settings-mobile-wordmark">ALOHA <small>SETTINGS</small></span>
        <span class="settings-breadcrumb">ALOHA <ChevronRight :size="15"/> 公共设置</span>
        <a :href="accountUrl" target="_blank" rel="noopener noreferrer" class="settings-profile-entry"
          aria-label="打开 AISR 账号中心">
          <span class="settings-profile-name">{{ displayName }}</span>
          <img v-if="profile?.avatarUrl" class="settings-avatar" :src="profile.avatarUrl" alt=""/>
          <span v-else class="settings-avatar settings-avatar-fallback"><CircleUserRound :size="22"/></span>
        </a>
      </header>

      <main class="settings-main" id="main-content">
        <div v-if="needsAccess" class="settings-auth-notice" role="alert">
          <CircleAlert :size="22" aria-hidden="true"/>
          <div><strong>Settings 尚未获得有效的 Access 登录凭证</strong>
            <p>其他 ALOHA 应用的登录状态不能直接证明此 Preview 已受 Access 保护。请通过受保护的 Settings 入口重新访问。</p>
          </div>
          <button type="button" class="settings-refresh-action" @click="refresh"><RefreshCw :size="16"/> 重试</button>
        </div>

        <div v-else-if="profileError" class="settings-inline-notice" role="status">
          <CircleAlert :size="18"/><span>账号资料：{{profileError.message}}</span>
          <button type="button" @click="refreshProfile">重试</button>
        </div>

        <div class="settings-heading">
          <span class="settings-eyebrow">ALOHA WORKSPACE</span>
          <h1>通用设置</h1>
          <p>管理 ALOHA 各应用共用的偏好。身份、权限仍由 LifeSpace 统一校验。</p>
        </div>

        <div v-if="spaceError&&!needsAccess" class="settings-inline-notice" role="status">
          <CircleAlert :size="18"/><span>专属空间：{{spaceError.message}}</span>
          <button type="button" @click="refreshSpaces">重试</button>
        </div>

        <AlohaHubSettings
          :selected-space-id="selectedId" :spaces="spaces" :busy="spaceBusy" :workspace-status="workspace?.status||'unavailable'"
          :space-message="message" :back-url="backUrl" :account-url="accountUrl"
          :embedded="true" @choose-space="choose" @create-space="create" @retry="refreshSpaces"
        />

        <section id="settings-help" class="settings-help">
          <HelpCircle :size="19"/>
          <div><strong>关于这些设置</strong>
            <p>专属空间绑定随账号保存在云端，不会授予新权限。若空间已注销或你已退出，下次使用可重新配置。空间和成员的通用管理请前往账户中心。</p>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>
