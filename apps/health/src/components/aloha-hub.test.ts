import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import AlohaHub from '@aloha/ui/AlohaHub.vue'

const apps = [
  { id:'assistant',name:'Assistant' },
  { id:'health',name:'Health',iconUrl:'/health/app-icon.svg' },
  { id:'finance',name:'Finance' },
  { id:'things',name:'Things' },
]

async function render(extra: Record<string, unknown> = {}) {
  return renderToString(createSSRApp(AlohaHub, {
    page:true,
    currentApp:'health',
    apps,
    ...extra,
  }))
}

describe('ALOHA Hub shared presentation / 公共入口', () => {
  it('shows only other applications, without headings or connection labels', async () => {
    const html = await render()
    const appGrid = html.split('aria-label="其他 ALOHA 应用"')[1]?.split('aloha-hub-footer')[0] ?? ''
    expect(appGrid).toContain('Assistant')
    expect(appGrid).toContain('Finance')
    expect(appGrid).toContain('Things')
    expect(appGrid).not.toContain('>Health<')
    expect(html).not.toContain('当前应用')
    expect(html).not.toContain('待接入')
    expect(html).not.toContain('aloha-hub-topline')
    expect(html).not.toContain('aloha-hub-group-caption')
  })
  it('does not invent public routes or allow navigation before destinations exist', async () => {
    const html = await render()
    expect(html).not.toContain('href=')
    expect(html).toContain('aria-disabled="true"')
    expect(html).toContain('账号')
    expect(html).toContain('隐私与授权')
    expect(html).toContain('帮助')
  })
  it('shows the ALOHA wordmark above the current app only in expanded navigation', async () => {
    const expanded = await renderToString(createSSRApp(AlohaHub, {
      currentApp:'health',apps,
    }))
    const compact = await renderToString(createSSRApp(AlohaHub, {
      currentApp:'health',apps,compact:true,
    }))
    expect(expanded).toContain('aloha-hub-wordmark')
    expect(expanded).toMatch(/<strong[^>]*>ALOHA<\/strong><small[^>]*>HEALTH<\/small>/)
    expect(expanded).toContain('aloha-hub-chevron')
    expect(compact).not.toContain('aloha-hub-wordmark')
    expect(compact).toContain('aloha-hub-logo')
  })
  it('opens configured account, application, privacy and help destinations in new tabs', async () => {
    const html = await render({
      apps:[apps[0],apps[1],{id:'finance',name:'Finance',href:'https://example.com/finance'},apps[3]],
      accountUrl:'https://example.com/account',
      privacyUrl:'https://example.com/privacy',
      helpUrl:'https://example.com/help',
    })
    expect(html).toContain('href="https://example.com/account"')
    expect(html).toContain('href="https://example.com/finance"')
    expect(html).toContain('href="https://example.com/privacy"')
    expect(html).toContain('href="https://example.com/help"')
    expect((html.match(/target="_blank"/g) || [])).toHaveLength(4)
    expect((html.match(/rel="noopener noreferrer"/g) || [])).toHaveLength(4)
  })
  it('routes common settings to a path and displays the verified Identity name/avatar',async()=>{
    const html=await render({
      accountUrl:'https://account.aisr.online/',
      accountLabel:'Synthetic User',
      avatarUrl:'/health/api/v1/profile/avatar',
      spaceName:'Synthetic Space',
      settingsUrl:'/settings/?from=health',
    })
    expect(html).toContain('href="https://account.aisr.online/"')
    expect(html).toContain('Synthetic User')
    expect(html).toContain('Synthetic Space')
    expect(html).toContain('src="/health/api/v1/profile/avatar"')
    expect(html).toContain('href="/settings/?from=health"')
    expect(html).not.toContain('target="_blank" href="/health/hub/settings"')
  })

})
