<script setup lang="ts">
import {computed,ref} from 'vue'
import {ArrowLeft,ArrowUpRight,ShieldCheck} from 'lucide-vue-next'

export interface HubSpace {id:string;name:string;role?:string}
const props=withDefaults(defineProps<{
  accountUrl:string
  selectedSpaceId:string
  spaces:HubSpace[]
  workspaceStatus:'unbound'|'bound'|'reselect'|'creating'|'uncertain'|'unavailable'
  busy?:boolean
  spaceMessage?:string
  backUrl:string
  embedded?:boolean
}>(),{busy:false,spaceMessage:'',embedded:false})
const emit=defineEmits<{(e:'choose-space',id:string):void;(e:'create-space',input:{name:string;timezone:string;acknowledgeUncertain:boolean}):void;(e:'retry'):void}>()
const selectedName=computed(()=>props.spaces.find(x=>x.id===props.selectedSpaceId)?.name)
const mode=ref<'create'|'bind'>('create')
const candidate=ref('')
const name=ref('ALOHA')
const timezone=ref(Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC')
const acknowledge=ref(false)
const roleLabels:Record<string,string>={owner:'所有者',admin:'管理员',editor:'编辑者',viewer:'查看者'}
</script>
<template>
  <section class="aloha-settings" aria-label="ALOHA 公共设置">
    <a v-if="!embedded" class="aloha-settings-back" :href="backUrl"><ArrowLeft :size="18"/> 返回应用</a>
    <h1 v-if="!embedded">应用设置</h1>
    <p v-if="!embedded" class="aloha-settings-caption">ALOHA 各应用共享的设置入口，账号资料在独立账号中心管理。</p>
    <section id="default-space" class="aloha-settings-card" aria-label="ALOHA 专属空间">
      <div class="aloha-settings-section-heading"><h2>ALOHA 专属空间</h2><ShieldCheck :size="20" aria-hidden="true"/></div>
      <p>ALOHA 各应用共用一个空间。绑定保存在云端，换设备无需重新选择；不会改变 LifeSpace 权限。</p>
      <template v-if="busy&&workspaceStatus==='unavailable'"><p role="status">正在检查空间…</p></template>
      <template v-else-if="workspaceStatus==='bound'">
        <div class="aloha-workspace-current"><strong>{{selectedName||'已绑定'}}</strong><small>已绑定 · 跨设备同步</small></div>
        <p>如需管理、退出或注销此空间，请前往账户中心。当前有效绑定不会被自动替换。</p>
        <a :href="accountUrl" target="_blank" rel="noopener noreferrer" class="aloha-settings-account">管理空间 <ArrowUpRight :size="17"/></a>
        <a :href="backUrl" class="aloha-workspace-primary">返回应用</a>
      </template>
      <template v-else-if="workspaceStatus==='unavailable'||workspaceStatus==='creating'">
        <p role="status">{{workspaceStatus==='creating'?'空间正在创建，请刷新检查结果。':'暂时无法确认空间绑定。'}}</p>
        <button type="button" class="aloha-settings-retry" :disabled="busy" @click="emit('retry')">重新检查</button>
      </template>
      <template v-else>
        <p v-if="workspaceStatus==='reselect'">原空间已不在当前成员列表，请重新创建或绑定。</p>
        <p v-if="workspaceStatus==='uncertain'" role="alert">上次创建结果不确定。请先到账户中心或下方已有空间列表检查，避免重复创建。</p>
        <div class="aloha-workspace-options" role="group" aria-label="选择配置方式">
          <button type="button" :aria-pressed="mode==='create'" :disabled="busy" @click="mode='create'">创建专属空间</button>
          <button type="button" :aria-pressed="mode==='bind'" :disabled="busy||!spaces.length" @click="mode='bind'">绑定已有空间</button>
        </div>
        <form v-if="mode==='create'" class="aloha-workspace-form" @submit.prevent="emit('create-space',{name:name.trim(),timezone,acknowledgeUncertain:acknowledge})">
          <label for="aloha-space-name">空间名称</label><input id="aloha-space-name" v-model="name" required maxlength="100" :disabled="busy"/>
          <label for="aloha-space-timezone">时区</label><input id="aloha-space-timezone" v-model="timezone" required maxlength="100" :disabled="busy"/>
          <label v-if="workspaceStatus==='uncertain'" class="aloha-workspace-confirm"><input type="checkbox" v-model="acknowledge" :disabled="busy"/>我已检查已有空间，确认需要再次创建。</label>
          <button type="submit" class="aloha-workspace-primary" :disabled="busy||!name.trim()||!timezone||(workspaceStatus==='uncertain'&&!acknowledge)">创建并绑定</button>
        </form>
        <form v-else class="aloha-workspace-form" @submit.prevent="emit('choose-space',candidate)">
          <label for="aloha-default-space">选择你已加入的空间</label>
          <select id="aloha-default-space" v-model="candidate" :disabled="busy||!spaces.length" required>
            <option value="">请选择一个空间</option>
            <option v-for="space in spaces" :key="space.id" :value="space.id">{{space.name}}{{space.role?' · '+(roleLabels[space.role]||space.role):''}}</option>
          </select>
          <p>如果选择共享空间，其他成员可能依照已有权限访问其中的数据。个人数据建议放在仅自己管理的空间。</p>
          <button type="submit" class="aloha-workspace-primary" :disabled="busy||!spaces.some(s=>s.id===candidate)">确认绑定</button>
        </form>
        <button type="button" class="aloha-settings-retry" :disabled="busy" @click="emit('retry')">刷新空间列表</button>
      </template>
      <p v-if="spaceMessage" role="status" class="aloha-settings-hint">{{spaceMessage}}</p>
    </section>
    <section id="account-center" class="aloha-settings-card" aria-label="账号设置">
      <div class="aloha-settings-section-heading"><h2>账号与安全</h2></div>
      <p>账号名称、头像、安全及授权统一由 AISR 账号中心管理。</p>
      <a :href="accountUrl" target="_blank" rel="noopener noreferrer" class="aloha-settings-account">
        前往账号中心 <ArrowUpRight :size="17" aria-hidden="true"/>
      </a>
    </section>
  </section>
</template>
<style scoped>
.aloha-settings {width:100%;max-width:48rem;margin:0;display:grid;gap:1.1rem;color:var(--aloha-color-text);scroll-margin-top:5rem}
.aloha-settings h1 {font-size:var(--aloha-type-page);margin:.3rem 0 0}
.aloha-settings-caption,.aloha-settings-card p {color:var(--aloha-color-text-muted);line-height:1.55;font-size:.85rem}
.aloha-settings-back,.aloha-settings-account {display:inline-flex;align-items:center;gap:.4rem;color:var(--aloha-accent-strong);text-decoration:none;font-size:.85rem}
.aloha-settings-card {display:grid;gap:1rem;padding:1.35rem 1.5rem;background:var(--aloha-color-surface);border:1px solid var(--aloha-color-border);border-radius:var(--aloha-radius-lg);scroll-margin-top:5rem}
.aloha-settings-section-heading {display:flex;justify-content:space-between;align-items:center}
.aloha-settings-section-heading h2 {font-size:1.1rem;margin:0}
.aloha-settings-card p {margin:0}
.aloha-settings-card label {font-weight:650;font-size:.82rem}
.aloha-settings-card select {width:100%;min-height:3rem;padding:.55rem 2rem .55rem .8rem;border:1px solid var(--aloha-color-border);background-color:var(--aloha-color-surface);color:var(--aloha-color-text);border-radius:var(--aloha-radius-sm)}
.aloha-settings-retry {justify-self:start;background:transparent;color:var(--aloha-accent-strong);border:0;padding:.4rem}
.aloha-settings-account {justify-self:start}
@media (max-width:47.999rem) {
  .aloha-settings-card {padding:1.15rem;gap:.8rem}
}
.aloha-workspace-current {display:grid;gap:.35rem;padding:1rem;background:var(--aloha-color-surface-muted,var(--aloha-color-surface));border:1px solid var(--aloha-color-border);border-radius:var(--aloha-radius-sm)}
.aloha-workspace-current small {color:var(--aloha-color-text-muted)}
.aloha-workspace-options {display:grid;grid-template-columns:1fr 1fr;gap:.65rem}
.aloha-workspace-options button {padding:.7rem;border:1px solid var(--aloha-color-border);border-radius:var(--aloha-radius-sm);background:var(--aloha-color-surface);color:var(--aloha-color-text);min-height:44px}
.aloha-workspace-options button[aria-pressed="true"] {border-color:var(--aloha-accent-strong);color:var(--aloha-accent-strong);font-weight:700}
.aloha-workspace-form {display:grid;gap:.75rem}
.aloha-workspace-form input:not([type=checkbox]) {width:100%;min-height:44px;box-sizing:border-box;padding:.55rem .8rem;border:1px solid var(--aloha-color-border);border-radius:var(--aloha-radius-sm);background:var(--aloha-color-surface);color:var(--aloha-color-text)}
.aloha-workspace-confirm {display:flex;align-items:center;gap:.5rem}
.aloha-workspace-primary {display:inline-flex;justify-content:center;align-items:center;min-height:44px;padding:.65rem 1rem;border:1px solid var(--aloha-accent-strong);border-radius:var(--aloha-radius-sm);background:var(--aloha-accent-strong);color:white;text-decoration:none;font-weight:650}
.aloha-workspace-primary:disabled,.aloha-workspace-options button:disabled {opacity:.55}
</style>