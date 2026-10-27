import { ref } from 'vue'

export interface DemoAgentMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
  context: string
}

/**
 * UX-only session: no AI API or health records. The chat is independent from
 * the active page and survives navigation and panel close/reopen in this tab.
 */
export function useDemoAgentSession() {
  const open = ref(false)
  const messages = ref<DemoAgentMessage[]>([])
  let nextMessageId = 0

  function show() { open.value = true }
  function hide() { open.value = false }
  function send(question: string, currentPage: string): boolean {
    const trimmed = question.trim()
    if (!trimmed) return false

    // Capture the page for this turn; later page changes must not rewrite history.
    const context = currentPage || '健康空间'
    messages.value.push({ id: ++nextMessageId, role: 'user', text: trimmed, context })
    messages.value.push({
      id: ++nextMessageId,
      role: 'assistant',
      text: '这是演示回复，还没有连接真实 AI 或健康档案。正式版可以参考你授权的「' +
        context + '」页面资料，并清楚标注信息来源。切换页面不影响这段对话。',
      context,
    })
    return true
  }

  return { open, messages, show, hide, send }
}
