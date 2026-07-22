import { create } from 'zustand'
import type { AiMode, AiProvider, AiStreamEvent } from '@shared/types'
import type { PayloadPreview } from '@shared/ai-guard'
import { translate, useLang } from '../lib/i18n'

export interface ChatTool {
  name: string
  args: string
  result?: string
}
export interface ChatItem {
  role: 'user' | 'assistant'
  text: string
  tools?: ChatTool[]
}
export interface ChatThread {
  items: ChatItem[]
  input: string
  running: boolean
  requestId: string | null
  approval: {
    callId: string
    command: string
    danger?: string | null
    preview?: PayloadPreview
  } | null
  // ค่าตั้งต่อ session (undefined = ใช้ค่า default จาก settings)
  provider?: AiProvider
  mode?: AiMode
  model?: string
  webSearch?: boolean
}

export type ChatConfig = Pick<ChatThread, 'provider' | 'mode' | 'model' | 'webSearch'>

/** thread ว่างแบบ stable reference — ใช้เป็น default ตอนยังไม่มี thread (กัน re-render loop) */
export const EMPTY_THREAD: ChatThread = {
  items: [],
  input: '',
  running: false,
  requestId: null,
  approval: null
}

interface SendOpts {
  provider: AiProvider
  model?: string
  mode: AiMode
  webSearch?: boolean
}

interface State {
  threads: Record<string, ChatThread>
  setInput: (key: string, input: string) => void
  appendInput: (key: string, text: string) => void
  setConfig: (key: string, patch: ChatConfig) => void
  clear: (key: string) => void
  send: (key: string, sessionId: string | null, opts: SendOpts) => Promise<void>
  approve: (key: string, approved: boolean) => void
  cancel: (key: string) => void
}

// unsubscribe ของแต่ละ thread (เก็บนอก state เพราะไม่ใช่ค่าที่ต้อง render)
const offs = new Map<string, () => void>()

function updateLast(items: ChatItem[], fn: (a: ChatItem) => ChatItem): ChatItem[] {
  if (!items.length) return items
  const next = [...items]
  const last = next[next.length - 1]
  if (last.role === 'assistant') next[next.length - 1] = fn(last)
  return next
}

export const useAiChats = create<State>((set, get) => {
  const patch = (key: string, fn: (t: ChatThread) => ChatThread): void =>
    set((s) => ({ threads: { ...s.threads, [key]: fn(s.threads[key] ?? EMPTY_THREAD) } }))

  const handleEvent = (key: string, ev: AiStreamEvent): void => {
    if (ev.type === 'text') {
      patch(key, (t) => ({
        ...t,
        items: updateLast(t.items, (a) => ({ ...a, text: a.text + ev.delta }))
      }))
    } else if (ev.type === 'tool_call') {
      patch(key, (t) => ({
        ...t,
        items: updateLast(t.items, (a) => ({
          ...a,
          tools: [...(a.tools ?? []), { name: ev.call.name, args: JSON.stringify(ev.call.arguments) }]
        }))
      }))
    } else if (ev.type === 'tool_result') {
      patch(key, (t) => ({
        ...t,
        items: updateLast(t.items, (a) => {
          const tools = [...(a.tools ?? [])]
          if (tools.length) tools[tools.length - 1] = { ...tools[tools.length - 1], result: ev.result.slice(0, 800) }
          return { ...a, tools }
        })
      }))
    } else if (ev.type === 'approval_request') {
      patch(key, (t) => ({
        ...t,
        approval: {
          callId: ev.callId,
          command: ev.command,
          danger: ev.danger,
          preview: ev.preview
        }
      }))
    } else if (ev.type === 'guard_blocked') {
      // guard บล็อคไปแล้ว ไม่ต้องถามผู้ใช้ — แค่บอกให้รู้ว่าเกิดอะไรขึ้น
      patch(key, (t) => ({
        ...t,
        items: updateLast(t.items, (a) => ({
          ...a,
          text: `${a.text}\n\n🛡️ ${translate('ถูกบล็อคโดยตัวกรอง', useLang.getState().lang)}: ${ev.reasons.join(' · ')}\n\`${ev.command}\``
        }))
      }))
    } else if (ev.type === 'done' || ev.type === 'error') {
      if (ev.type === 'error') {
        patch(key, (t) => ({
          ...t,
          items: updateLast(t.items, (a) => ({ ...a, text: a.text + `\n\n⚠️ ${ev.message}` }))
        }))
      }
      patch(key, (t) => ({ ...t, running: false, approval: null }))
      offs.get(key)?.()
      offs.delete(key)
    }
  }

  return {
    threads: {},
    setInput: (key, input) => patch(key, (t) => ({ ...t, input })),
    appendInput: (key, text) =>
      patch(key, (t) => ({ ...t, input: t.input ? t.input + '\n' + text : text })),
    setConfig: (key, cfg) => patch(key, (t) => ({ ...t, ...cfg })),
    clear: (key) => {
      offs.get(key)?.()
      offs.delete(key)
      // เก็บค่าตั้ง (provider/mode/model/webSearch) ไว้ ล้างแค่บทสนทนา
      patch(key, (t) => ({
        ...EMPTY_THREAD,
        provider: t.provider,
        mode: t.mode,
        model: t.model,
        webSearch: t.webSearch
      }))
    },
    approve: (key, approved) => {
      const a = get().threads[key]?.approval
      if (a) {
        window.api.ai.approve(a.callId, approved)
        patch(key, (t) => ({ ...t, approval: null }))
      }
    },
    cancel: (key) => {
      const rid = get().threads[key]?.requestId
      if (rid) window.api.ai.cancel(rid)
      offs.get(key)?.()
      offs.delete(key)
      patch(key, (t) => ({ ...t, running: false }))
    },
    send: async (key, sessionId, opts) => {
      const cur = get().threads[key] ?? EMPTY_THREAD
      const message = cur.input.trim()
      if (!message || cur.running) return
      const requestId = crypto.randomUUID()
      patch(key, (t) => ({
        ...t,
        input: '',
        running: true,
        requestId,
        approval: null,
        items: [...t.items, { role: 'user', text: message }, { role: 'assistant', text: '' }]
      }))
      const off = window.api.ai.onStream(requestId, (ev) => handleEvent(key, ev))
      offs.set(key, off)
      await window.api.ai.chat({
        requestId,
        sessionId,
        provider: opts.provider,
        model: opts.model,
        mode: opts.mode,
        webSearch: opts.webSearch,
        message
      })
    }
  }
})
