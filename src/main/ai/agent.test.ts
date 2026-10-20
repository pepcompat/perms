import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AiMessageRecord, AiStreamEvent } from '@shared/types'
import type { ChatMessage, RunParams, RunResult } from './providers/types'

// ทดสอบ agent loop ของจริง (runChat) โดยแทน LLM/DB/terminal ด้วยของปลอม
// เป้าหมาย: งานหลายขั้นต้องจบในข้อความเดียว · ถามต่อแล้วต้องจำของเดิมได้

const h = vi.hoisted(() => ({
  events: [] as AiStreamEvent[],
  db: [] as AiMessageRecord[],
  calls: [] as ChatMessage[][],
  model: null as null | ((p: RunParams) => RunResult),
  executed: [] as string[],
  mode: 'agentic' as 'agentic' | 'approve' | 'suggest'
}))

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [{ webContents: { send: (_ch: string, ev: AiStreamEvent) => h.events.push(ev) } }]
  }
}))

const fakeProvider = vi.hoisted(
  () =>
    class {
      readonly id = 'openai'
      async run(p: RunParams): Promise<RunResult> {
        h.calls.push(structuredClone(p.messages))
        const r = h.model!(p)
        if (r.text) p.onText(r.text)
        return r
      }
    }
)
vi.mock('./providers/openai', () => ({ OpenAiProvider: fakeProvider }))
vi.mock('./providers/anthropic', () => ({ AnthropicProvider: fakeProvider }))
vi.mock('./providers/google', () => ({ GoogleProvider: fakeProvider }))

vi.mock('./tools', () => ({
  TOOL_SCHEMAS: [],
  MUTATING_TOOLS: new Set(['run_command', 'run_in_terminal', 'run_runbook']),
  dangerousReasonForCall: () => null,
  agentCwd: async () => '/home/u',
  executeTool: async (_name: string, args: Record<string, unknown>) => {
    h.executed.push(String(args.command))
    return `exit_code=0\ncwd=/home/u\nran: ${String(args.command)}`
  }
}))

vi.mock('./cli-runner', () => ({ runCli: vi.fn() }))
vi.mock('./mcp-server', () => ({ registerMcpRun: vi.fn() }))

vi.mock('../db/repos/settings-repo', () => ({
  getAiSettings: () => ({
    defaultProvider: 'openai',
    defaultMode: h.mode,
    models: { openai: 'test-model' }
  }),
  revealAiKey: () => 'test-key',
  getGuardPolicy: () => ({ denyPatterns: [], requireApprovalForAll: false, maxCallsPerRun: 25 })
}))

vi.mock('../db/repos/ai-repo', () => ({
  appendMessage: (m: Omit<AiMessageRecord, 'id' | 'createdAt'>) => {
    const rec = { ...m, id: String(h.db.length), createdAt: h.db.length }
    h.db.push(rec)
    return rec
  },
  listMessages: (sessionId: string | null, limit = 400) =>
    h.db.filter((r) => r.sessionId === sessionId).slice(-limit)
}))

vi.mock('../db/repos/sessions-repo', () => ({
  getSession: () => ({ id: 's1', kind: 'local', serverId: null, title: 'local' })
}))
vi.mock('../db/repos/servers-repo', () => ({ getServer: () => null }))
vi.mock('../db/repos/knowledge-repo', () => ({ searchKnowledge: () => [], bumpUseCount: () => {} }))
vi.mock('../terminal/session-manager', () => ({
  terminalContext: async () => ({ cwd: '/home/u', recentOutput: '$ ls\nnotes.txt' })
}))

import { runChat, loadHistory, cancelRequest } from './agent'

const toolResults = (msgs: ChatMessage[]): string[] =>
  msgs.filter((m) => m.role === 'tool').map((m) => m.content)

/** โมเดลปลอม: รันคำสั่งตามลิสต์ทีละขั้น (ทีละ tool call) แล้วสรุปเมื่อครบ */
function scripted(commands: string[], summary: string): (p: RunParams) => RunResult {
  return (p) => {
    const lastUser = p.messages.map((m) => m.role).lastIndexOf('user')
    const done = p.messages.slice(lastUser).filter((m) => m.role === 'tool').length
    if (done < commands.length) {
      return {
        text: '',
        stopReason: 'tool_use',
        toolCalls: [{ id: `c${h.executed.length}`, name: 'run_command', arguments: { command: commands[done] } }]
      }
    }
    return { text: summary, toolCalls: [], stopReason: 'end_turn' }
  }
}

beforeEach(() => {
  h.events = []
  h.db = []
  h.calls = []
  h.executed = []
  h.mode = 'agentic'
})

describe('agent loop', () => {
  it('งานหลายขั้นจบในข้อความเดียว — เอาผลแต่ละคำสั่งป้อนกลับให้โมเดลทำขั้นต่อไป', async () => {
    h.model = scripted(['mkdir demo', 'echo hi > demo/a.txt', 'ls demo'], 'เสร็จแล้ว: demo/a.txt')
    await runChat('r1', { sessionId: 's1', message: 'สร้างโฟลเดอร์ ใส่ไฟล์ แล้ว list ให้ดู' })

    expect(h.executed).toEqual(['mkdir demo', 'echo hi > demo/a.txt', 'ls demo'])
    expect(h.calls).toHaveLength(4)
    // ขั้นสุดท้ายโมเดลเห็นผลของทั้ง 3 คำสั่ง
    expect(toolResults(h.calls[3])).toHaveLength(3)
    expect(toolResults(h.calls[3])[2]).toContain('ran: ls demo')
    expect(h.events.filter((e) => e.type === 'done')).toHaveLength(1)
    expect(h.events.some((e) => e.type === 'error')).toBe(false)
  })

  it('ถามต่อเรื่องเดิม → request ใหม่มีประวัติรอบก่อนครบ (คำสั่ง + ผล + คำตอบ)', async () => {
    h.model = scripted(['mkdir demo', 'ls demo'], 'สร้าง demo แล้ว')
    await runChat('r1', { sessionId: 's1', message: 'สร้างโฟลเดอร์ demo' })
    h.calls = []
    h.model = scripted([], 'ในโฟลเดอร์นั้นยังว่างอยู่')
    await runChat('r2', { sessionId: 's1', message: 'ในโฟลเดอร์นั้นมีอะไร' })

    const sent = h.calls[0]
    expect(sent[0]).toMatchObject({ role: 'user', content: 'สร้างโฟลเดอร์ demo' })
    expect(toolResults(sent)).toEqual([
      'exit_code=0\ncwd=/home/u\nran: mkdir demo',
      'exit_code=0\ncwd=/home/u\nran: ls demo'
    ])
    expect(sent).toContainEqual({ role: 'assistant', content: 'สร้าง demo แล้ว', toolCalls: undefined })
    expect(sent[sent.length - 1]).toMatchObject({ role: 'user', content: 'ในโฟลเดอร์นั้นมีอะไร' })
  })

  it('ครบเพดานขั้นแล้วยังไม่จบ → บอกผู้ใช้ให้สั่ง "ทำต่อ" (ไม่เงียบหาย)', async () => {
    h.model = () => ({
      text: '',
      stopReason: 'tool_use',
      toolCalls: [{ id: `c${h.calls.length}`, name: 'get_session_info', arguments: {} }]
    })
    await runChat('r1', { sessionId: 's1', message: 'ทำไปเรื่อย ๆ' })
    const text = h.events.flatMap((e) => (e.type === 'text' ? [e.delta] : [])).join('')
    expect(text).toContain('ทำต่อ')
    expect(h.db[h.db.length - 1].content).toContain('ทำต่อ')
  })

  it('กดหยุดระหว่างรออนุมัติ → loop จบ ไม่ค้าง และประวัติไม่มี tool call ที่ไม่มีผล', async () => {
    h.mode = 'approve'
    h.model = scripted(['rm demo/a.txt'], 'ok')
    const run = runChat('r1', { sessionId: 's1', message: 'ลบไฟล์' })
    await vi.waitFor(() => expect(h.events.some((e) => e.type === 'approval_request')).toBe(true))
    cancelRequest('r1')
    await run
    expect(h.executed).toEqual([])
    const last = h.db[h.db.length - 1]
    expect(last.toolCalls?.[0].result).toContain('cancelled')
  })

  it('context ยาว → ตัด turn เก่าออกแต่ทิ้งโน้ตสรุป · turn ล่าสุดอยู่ครบ', () => {
    for (let i = 0; i < 80; i++) {
      h.db.push({ id: `u${i}`, sessionId: 's1', provider: 'openai', model: 'm', role: 'user', content: `งานที่ ${i}`, toolCalls: null, createdAt: i * 2 })
      h.db.push({
        id: `a${i}`, sessionId: 's1', provider: 'openai', model: 'm', role: 'assistant', content: '',
        toolCalls: [{ id: `t${i}`, name: 'run_command', arguments: { command: 'cat big' }, result: 'x'.repeat(5000) }],
        createdAt: i * 2 + 1
      })
    }
    const msgs = loadHistory('s1')
    const size = msgs.reduce((n, m) => n + m.content.length, 0)
    expect(size).toBeLessThan(100_000)
    expect(msgs[0].content).toContain('omitted')
    expect(msgs[0].content).toContain('งานที่ 34') // คำขอล่าสุดที่ถูกตัดยังอยู่ในโน้ต
    // turn ล่าสุดเก็บผล tool เต็ม
    expect(toolResults(msgs).at(-1)).toHaveLength(5000)
    // ทุก tool call มีผลคู่กัน
    const callIds = msgs.flatMap((m) => (m.role === 'assistant' ? (m.toolCalls ?? []).map((t) => t.id) : []))
    const resultIds = msgs.flatMap((m) => (m.role === 'tool' ? [m.toolCallId] : []))
    expect(resultIds).toEqual(callIds)
  })
})
