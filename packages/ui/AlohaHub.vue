<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
// The ALOHA wordmark uses a self-hosted Latin-only font; domain labels keep the UI font.
import '@fontsource/exo-2/latin-700.css'
import {
  ArrowUpRight, Box, ChevronDown, CircleHelp, Heart, LayoutGrid,
  ShieldCheck, Sparkles, UserRound, Wallet, Settings2,
} from 'lucide-vue-next'

/** Shared ALOHA Hub presentation contract, first exercised by Health. */
interface AlohaAppLink {
  id: string
  name: string
  href?: string
  iconUrl?: string
}
const props = withDefaults(defineProps<{
  currentApp: string
  apps: AlohaAppLink[]
  compact?: boolean
  page?: boolean
  accountUrl?: string
  accountLabel?: string
  avatarUrl?: string
  privacyUrl?: string
  helpUrl?: string
  settingsUrl?: string
  spaceName?: string
}>(), { compact:false, page:false, accountLabel:'账号' })

const opened = ref(false)
const trigger = ref<HTMLButtonElement|null>(null)
const otherApps = computed(() => props.apps.filter(app => app.id !== props.currentApp))
const currentIconUrl = computed(() => props.apps.find(app => app.id === props.currentApp)?.iconUrl)

function appGlyph(id: string) {
  return id === 'assistant' ? Sparkles : id === 'health' ? Heart :
    id === 'finance' ? Wallet : id === 'things' ? Box : LayoutGrid
}
function toggle() { opened.value = !opened.value }
function close() { opened.value = false }
async function closeOnEscape() {
  close()
  await nextTick()
  trigger.value?.focus()
}
</script>

<template>
  <div class="aloha-hub" :class="{ 'page-hub': page }">
    <button v-if="!page" ref="trigger" type="button" class="aloha-hub-trigger" :class="{ compact }"
      :aria-expanded="opened" aria-haspopup="dialog" aria-label="ALOHA 应用与账号入口"
      title="ALOHA 应用与账号" @click="toggle">
      <span class="aloha-hub-logo">
        <img v-if="currentIconUrl" :src="currentIconUrl" alt="" aria-hidden="true"/>
        <component v-else :is="appGlyph(currentApp)" :size="compact ? 19 : 22" aria-hidden="true"/>
      </span>
      <span v-if="!compact" class="aloha-hub-wordmark"><strong>ALOHA</strong><small>{{ currentApp.toUpperCase() }}</small></span>
      <ChevronDown v-if="!compact" :size="17" class="aloha-hub-chevron"/>
    </button>

    <template v-if="opened || page">
      <button v-if="!page" class="aloha-hub-dismiss" type="button" tabindex="-1"
        aria-label="关闭应用中心" @click="close"/>
      <section class="aloha-hub-popup" :role="page?'region':'dialog'" aria-label="ALOHA 应用与公共入口"
        @keydown.esc.stop.prevent="closeOnEscape">
        <!-- Public account and profile live outside Health. No synthetic account data. -->
        <component :is="accountUrl ? 'a' : 'div'" class="aloha-hub-account"
          :class="{ 'is-disabled': !accountUrl }" :href="accountUrl || undefined"
          :target="accountUrl ? '_blank' : undefined" :rel="accountUrl ? 'noopener noreferrer' : undefined"
          :aria-disabled="!accountUrl || undefined" :title="accountUrl ? '在新标签页打开账号' : 'ALOHA 公共账号页面尚未接入'"
          @click="accountUrl && close()">
          <span class="aloha-hub-avatar">
            <img v-if="avatarUrl" :src="avatarUrl" alt="" aria-hidden="true"/>
            <UserRound v-else :size="23" aria-hidden="true"/>
          </span>
          <span class="aloha-hub-account-name">{{ accountLabel }}<small v-if="spaceName" class="aloha-hub-space-name">{{ spaceName }}</small></span>
          <ArrowUpRight :size="17" class="aloha-hub-external-arrow" aria-hidden="true"/>
        </component>

        <div class="aloha-hub-app-grid" aria-label="其他 ALOHA 应用">
          <component v-for="app in otherApps" :key="app.id" :is="app.href ? 'a' : 'span'"
            class="aloha-hub-app" :class="{ 'is-disabled': !app.href }"
            :href="app.href || undefined" :target="app.href ? '_blank' : undefined"
            :rel="app.href ? 'noopener noreferrer' : undefined"
            :aria-disabled="!app.href || undefined"
            :title="app.href ? '在新标签页打开 '+app.name : app.name+' 尚未接入'"
            @click="app.href && close()">
            <span class="aloha-hub-app-icon" :class="'app-icon-'+app.id">
              <img v-if="app.iconUrl" :src="app.iconUrl" alt="" aria-hidden="true"/>
              <component v-else :is="appGlyph(app.id)" :size="23" aria-hidden="true"/>
            </span>
            <span class="aloha-hub-app-name">{{ app.name }}</span>
          </component>
        </div>

        <a v-if="settingsUrl" :href="settingsUrl" class="aloha-hub-settings-link" target="_blank" rel="noopener noreferrer" @click="close">
          <Settings2 :size="18" aria-hidden="true"/> 应用设置
        </a>
        <div class="aloha-hub-footer" aria-label="公共服务">
          <component :is="privacyUrl ? 'a' : 'span'" class="aloha-hub-footer-link"
            :class="{ 'is-disabled': !privacyUrl }" :href="privacyUrl || undefined"
            :target="privacyUrl ? '_blank' : undefined" :rel="privacyUrl ? 'noopener noreferrer' : undefined"
            :aria-disabled="!privacyUrl || undefined"
            :title="privacyUrl ? '在新标签页打开隐私与授权' : 'ALOHA 公共隐私页面尚未接入'"
            @click="privacyUrl && close()">
            <ShieldCheck :size="18" aria-hidden="true"/> 隐私与授权 <ArrowUpRight :size="15" aria-hidden="true"/>
          </component>
          <component :is="helpUrl ? 'a' : 'span'" class="aloha-hub-footer-link"
            :class="{ 'is-disabled': !helpUrl }" :href="helpUrl || undefined"
            :target="helpUrl ? '_blank' : undefined" :rel="helpUrl ? 'noopener noreferrer' : undefined"
            :aria-disabled="!helpUrl || undefined"
            :title="helpUrl ? '在新标签页打开帮助' : 'ALOHA 公共帮助页面尚未接入'"
            @click="helpUrl && close()">
            <CircleHelp :size="18" aria-hidden="true"/> 帮助 <ArrowUpRight :size="15" aria-hidden="true"/>
          </component>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.aloha-hub { position:relative; min-width:0; }
.aloha-hub-trigger { display:flex;align-items:center;gap:.55rem;width:100%;padding:.15rem .65rem;border:0;background:transparent;color:var(--aloha-color-text);text-align:left; }
.aloha-hub-trigger.compact { justify-content:center;padding:.1rem; }
.aloha-hub-logo { display:grid;place-items:center;flex:none;width:2.75rem;height:2.75rem;overflow:hidden;border-radius:var(--aloha-radius-md);background:transparent;color:var(--aloha-accent-strong); }
.aloha-hub-logo img,.aloha-hub-app-icon img,.aloha-hub-avatar img { display:block;width:100%;height:100%;object-fit:cover; }
/* ALOHA is the family wordmark; HEALTH/other surface names remain quiet sub-labels. */
.aloha-hub-wordmark { display:flex;flex:1;flex-direction:column;gap:.25rem;min-width:0;white-space:nowrap; }
.aloha-hub-wordmark strong { display:block;font-family:var(--aloha-font-brand);font-size:1.5rem;font-weight:700;line-height:1.05;letter-spacing:.015em; }
.aloha-hub-wordmark small { display:block;font-family:var(--aloha-font-sans);font-size:.64rem;line-height:1.3;letter-spacing:.2em;color:var(--aloha-accent-strong);font-weight:700; }
.aloha-hub-chevron { flex:none;margin-left:auto;color:var(--aloha-color-text-muted); }
.aloha-hub-dismiss { position:fixed;inset:0;background:transparent;border:0;z-index:1;cursor:default; }
.aloha-hub-popup { position:absolute;top:calc(100% + .7rem);left:0;z-index:2;width:min(23rem,calc(100vw - 1.5rem));max-height:min(82dvh,43rem);overflow-y:auto;padding:.75rem 1rem;background:var(--aloha-color-surface);border:1px solid var(--aloha-color-border);box-shadow:var(--aloha-shadow-floating);border-radius:var(--aloha-radius-lg); }
.aloha-hub-account { display:flex;align-items:center;gap:.8rem;padding:.55rem .5rem;min-height:3.7rem;border-radius:var(--aloha-radius-md);color:var(--aloha-color-text);text-decoration:none; }
a.aloha-hub-account:hover,a.aloha-hub-app:hover,a.aloha-hub-footer-link:hover { background:var(--aloha-accent-soft); }
.aloha-hub-avatar { display:grid;place-items:center;flex:none;width:2.65rem;height:2.65rem;overflow:hidden;border-radius:50%;color:var(--aloha-color-text-muted);background:var(--aloha-color-surface-muted);border:1px solid var(--aloha-color-border); }
.aloha-hub-account-name { flex:1;min-width:0;font-size:var(--aloha-type-body);font-weight:650;display:flex;flex-direction:column;gap:.18rem; }
.aloha-hub-space-name { font-size:var(--aloha-type-label);font-weight:450;color:var(--aloha-color-text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.aloha-hub-settings-link { display:flex;gap:.45rem;align-items:center;padding:.7rem .45rem;border-top:1px solid var(--aloha-color-border);color:var(--aloha-color-text);font-size:var(--aloha-type-label);text-decoration:none; }
.aloha-hub-settings-link:hover { background:var(--aloha-accent-soft); }
.aloha-hub-external-arrow { color:var(--aloha-color-text-muted); }
.aloha-hub-app-grid { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.3rem;padding:.9rem 0;border-top:1px solid var(--aloha-color-border); }
.aloha-hub-app { display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:.5rem;min-width:0;padding:.55rem .15rem;border-radius:var(--aloha-radius-md);color:var(--aloha-color-text);text-align:center;text-decoration:none; }
.aloha-hub-app-icon { display:grid;place-items:center;flex:none;width:3rem;height:3rem;border-radius:var(--aloha-radius-md);overflow:hidden;color:white;background:var(--aloha-accent-soft); }
.aloha-hub-app-icon.app-icon-health { background:transparent; }
.aloha-hub-app-icon.app-icon-assistant { background:linear-gradient(135deg,#274d8c,#10284c); }
.aloha-hub-app-icon.app-icon-finance { background:linear-gradient(135deg,#ffc85a,#e89616); }
.aloha-hub-app-icon.app-icon-things { background:linear-gradient(135deg,#8170ed,#5541c6); }
.aloha-hub-app-name { display:block;max-width:100%;font-size:var(--aloha-type-label);font-weight:620;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.aloha-hub-footer { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.3rem;border-top:1px solid var(--aloha-color-border);padding-top:.7rem; }
.aloha-hub-footer-link { display:flex;align-items:center;gap:.4rem;min-height:2.7rem;padding:.6rem .45rem;border-radius:var(--aloha-radius-sm);color:var(--aloha-color-text);font-size:var(--aloha-type-label);text-decoration:none;white-space:nowrap; }
.aloha-hub-footer-link svg:last-child { margin-left:auto;color:var(--aloha-color-text-muted); }
.is-disabled { opacity:.46;filter:grayscale(1);cursor:default; }
.aloha-hub-account.is-disabled { opacity:.65;filter:none; }
.page-hub { width:100%;max-width:38rem;margin-inline:auto; }
.page-hub .aloha-hub-popup { position:static;width:100%;max-height:none;overflow:visible;padding:0;border:0;border-radius:0;box-shadow:none;background:transparent; }
.page-hub .aloha-hub-account { padding:.8rem .7rem;min-height:4.6rem;background:var(--aloha-color-surface);border:1px solid var(--aloha-color-border); }
.page-hub .aloha-hub-app-grid { grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem;border:0;padding:1rem 0; }
.page-hub .aloha-hub-app { min-height:7.2rem;justify-content:center;background:var(--aloha-color-surface);border:1px solid var(--aloha-color-border); }
.page-hub .aloha-hub-app-icon { width:2.9rem;height:2.9rem; }
.page-hub .aloha-hub-settings-link { min-height:3rem; }
.page-hub .aloha-hub-footer { grid-template-columns:repeat(1,minmax(0,1fr));gap:0;background:var(--aloha-color-surface);border:1px solid var(--aloha-color-border);border-radius:var(--aloha-radius-md);padding:0;overflow:hidden; }
.page-hub .aloha-hub-footer-link { min-height:3.5rem;padding:.8rem 1rem;border-radius:0; }
.page-hub .aloha-hub-footer-link + .aloha-hub-footer-link { border-top:1px solid var(--aloha-color-border); }
</style>