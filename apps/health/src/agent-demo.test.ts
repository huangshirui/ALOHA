import { describe, expect, it } from 'vitest'
import { useDemoAgentSession } from './agent-demo'

describe('Health Agent persistent workspace (prototype)', () => {
  it('keeps the same conversation across page switches and panel reopen', () => {
    const agent = useDemoAgentSession()
    agent.show()
    expect(agent.open.value).toBe(true)
    expect(agent.send('这条记录代表什么？', '身体 / 血压观察')).toBe(true)
    expect(agent.messages.value).toHaveLength(2)
    expect(agent.messages.value[0]?.context).toBe('身体 / 血压观察')

    // Simulate navigation to another Health page without re-creating the agent.
    expect(agent.send('帮我看看资料', '身体 / 健康资料')).toBe(true)
    expect(agent.messages.value).toHaveLength(4)
    expect(agent.messages.value[0]?.context).toBe('身体 / 血压观察')
    expect(agent.messages.value[2]?.context).toBe('身体 / 健康资料')
    expect(agent.open.value).toBe(true)

    agent.hide()
    expect(agent.open.value).toBe(false)
    agent.show()
    expect(agent.messages.value).toHaveLength(4)
  })
  it('does not append empty messages or invoke any provider', () => {
    const agent = useDemoAgentSession()
    expect(agent.send('   ', '首页')).toBe(false)
    expect(agent.messages.value).toEqual([])
    expect(agent.send('请问今天有哪些记录', '首页')).toBe(true)
    expect(agent.messages.value[1]?.text).toContain('演示回复')
    expect(agent.messages.value[1]?.text).toContain('没有连接真实 AI')
  })
})
