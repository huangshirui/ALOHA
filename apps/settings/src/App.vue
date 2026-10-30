<script setup lang="ts">
import {onMounted,ref} from 'vue'
import AlohaHubSettings from '@aloha/ui/AlohaHubSettings.vue'
import {getProfile,getSpaces,selectedSpace,safeReturn,type Space,type UserProfile} from './api'
const profile=ref<UserProfile|null>(null)
const spaces=ref<Space[]>([])
const selectedId=ref('')
const busy=ref(true)
const message=ref('')
const error=ref('')
const backUrl=safeReturn(new URLSearchParams(window.location.search).get('from'))
async function refresh(){
  busy.value=true;error.value='';message.value=''
  try{
    const [user,allowed]=await Promise.all([getProfile(),getSpaces()])
    profile.value=user
    spaces.value=allowed
    selectedId.value=selectedSpace(allowed,localStorage)
    if(selectedId.value)localStorage.setItem('aloha.space',selectedId.value)
    else message.value=allowed.length?'请选择默认空间；这只影响此浏览器。':'当前账号没有可使用的空间。'
  }catch(e){
    profile.value=null;spaces.value=[];selectedId.value=''
    error.value=e instanceof Error?e.message:'无法读取公共设置'
  }finally{busy.value=false}
}
function choose(id:string){
  if(!spaces.value.some(space=>space.id===id)){error.value='不能选择未授权的空间';return}
  selectedId.value=id
  localStorage.setItem('aloha.space',id)
  message.value='已保存为此浏览器的默认空间。重新打开应用后生效。'
}
onMounted(()=>{void refresh()})
</script>
<template>
  <main class="aloha-settings-page">
    <header class="aloha-settings-top">
      <a class="aloha-settings-brand" :href="backUrl">ALOHA</a>
      <span v-if="profile" class="aloha-settings-profile">
        <img v-if="profile.avatarUrl" class="aloha-settings-avatar" :src="profile.avatarUrl" alt=""/>
        <span>{{ profile.displayName }}</span>
      </span>
    </header>
    <div v-if="error" class="aloha-settings-alert">
      <div class="aloha-settings-error" role="alert">{{error}} <button type="button" @click="refresh">重试</button></div>
    </div>
    <AlohaHubSettings account-url="https://account.aisr.online/"
      :selected-space-id="selectedId" :spaces="spaces" :busy="busy"
      :space-message="message" :back-url="backUrl"
      @choose-space="choose" @retry="refresh"/>
  </main>
</template>
