import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam, Tool, ContentBlockParam } from '@anthropic-ai/sdk/resources/messages'
import type { Provider, RunParams, RunResult, StopReason, ToolCallRequest } from './types'

/** โมเดลรุ่นเก่า (3.x) รับ max_tokens ได้น้อยกว่า — รุ่นใหม่ thinking กินโควตานี้ด้วย ต้องเผื่อเยอะ */
function maxTokensFor(model: string): number {
  return /^claude-3/.test(model) ? 8192 : 32000
}

/** web search รุ่น dynamic filtering รองรับเฉพาะ Opus 4.6+ / Sonnet 4.6+ — รุ่นอื่นใช้รุ่นพื้นฐาน */
function webSearchTool(model: string): Record<string, unknown> {
  const dynamic = /^claude-(opus-(4-[6-9]|5)|sonnet-(4-6|5))/.test(model)
  return { type: dynamic ? 'web_search_20260209' : 'web_search_20250305', name: 'web_search', max_uses: 5 }
}

/** รุ่นที่รองรับ server-side refusal fallback แบบ "default" */
function supportsFallback(model: string): boolean {
  return /^claude-(opus-5|sonnet-5-5|fable-5-1)/.test(model)
}

function normalizeStop(reason: string | null | undefined): StopReason {
  switch (reason) {
    case 'end_turn':
    case 'tool_use':
    case 'max_tokens':
    case 'pause_turn':
    case 'refusal':
      return reason
    default:
      return 'other'
  }
}

export class AnthropicProvider implements Provider {
  readonly id = 'anthropic' as const
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async run(params: RunParams): Promise<RunResult> {
    const messages: MessageParam[] = []
    // รวม turn ที่ role ซ้ำกันติดกันเป็นข้อความเดียว — โดยเฉพาะ tool_result หลายตัวของ
    // assistant turn เดียวต้องอยู่ใน user message เดียวกัน
    const push = (role: 'user' | 'assistant', blocks: ContentBlockParam[]): void => {
      const last = messages[messages.length - 1]
      if (last && last.role === role && Array.isArray(last.content)) {
        last.content.push(...blocks)
      } else {
        messages.push({ role, content: blocks })
      }
    }
    for (const m of params.messages) {
      if (m.role === 'user') {
        push('user', [{ type: 'text', text: m.content || '(empty)' }])
      } else if (m.role === 'assistant') {
        // มี content ดิบจากรอบนี้ (thinking/server tool) → ส่งกลับตามเดิมทุก block
        if (Array.isArray(m.raw)) {
          push('assistant', [...(m.raw as ContentBlockParam[])])
          continue
        }
        const blocks: ContentBlockParam[] = []
        if (m.content) blocks.push({ type: 'text', text: m.content })
        for (const t of m.toolCalls ?? []) {
          blocks.push({ type: 'tool_use', id: t.id, name: t.name, input: t.arguments })
        }
        if (blocks.length) push('assistant', blocks)
      } else if (m.role === 'tool') {
        push('user', [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }])
      }
    }

    const tools: Tool[] = params.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Tool['input_schema']
    }))

    // web search (server-side ของ Anthropic) — Claude ค้นเองและสรุปผลกลับมาเป็น text
    const allTools: unknown[] = [...tools]
    if (params.webSearch) allTools.push(webSearchTool(params.model))

    const body: Record<string, unknown> = {
      model: params.model,
      max_tokens: maxTokensFor(params.model),
      system: params.system,
      messages,
      tools: allTools.length ? allTools : undefined,
      // cache prefix อัตโนมัติ — agent loop ส่ง history ซ้ำทุกขั้น ช่วยลดค่าใช้จ่าย/latency มาก
      cache_control: { type: 'ephemeral' }
    }
    const headers: Record<string, string> = {}
    if (supportsFallback(params.model)) {
      // safety classifier ปฏิเสธ (stop_reason=refusal) → ให้ API ส่งต่อโมเดลสำรองเอง
      body.fallbacks = 'default'
      headers['anthropic-beta'] = 'server-side-fallback-2026-07-01'
    }

    const stream = this.client.messages.stream(
      body as unknown as Parameters<Anthropic['messages']['stream']>[0],
      { signal: params.signal, headers }
    )

    stream.on('text', (delta) => params.onText(delta))

    const final = await stream.finalMessage()
    let text = ''
    const toolCalls: ToolCallRequest[] = []
    for (const block of final.content) {
      if (block.type === 'text') text += block.text
      else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: (block.input as Record<string, unknown>) ?? {}
        })
      }
    }

    return { text, toolCalls, stopReason: normalizeStop(final.stop_reason), raw: final.content }
  }
}
