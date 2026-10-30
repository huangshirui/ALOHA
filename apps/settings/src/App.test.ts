import {describe,it,expect,vi,afterEach} from 'vitest'
import {createSSRApp} from 'vue'
import {renderToString} from 'vue/server-renderer'
import App from './App.vue'
afterEach(()=>vi.unstubAllGlobals())
describe('ALOHA Settings responsive shell',()=>{
  it('renders the branded app-level navigation, not a Health-owned page',async()=>{
    vi.stubGlobal('window',{location:{search:'?from=health',hostname:'staging.example.com'}})
    const html=await renderToString(createSSRApp(App))
    expect(html).toContain('ALOHA')
    expect(html).toContain('SETTINGS')
    expect(html).toContain('settings-rail')
    expect(html).toContain('settings-menu-button')
    expect(html).toContain('应用设置')
    expect(html).toContain('默认空间')
    expect(html).toContain('账号与安全')
    expect(html).toContain('https://account.aisr.online/')
    expect(html).toContain('href="/health/"')
  })
  it('does not show a false global logged-out banner before independent data checks',async()=>{
    vi.stubGlobal('window',{location:{search:'?from=assistant',hostname:'staging.example.com'}})
    const html=await renderToString(createSSRApp(App))
    expect(html).not.toContain('请先登录 ALOHA')
    expect(html).not.toContain('Settings 尚未获得有效的 Access 登录凭证')
    expect(html).toContain('href="/assistant/"')
  })
})
