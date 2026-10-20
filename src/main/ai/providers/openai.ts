import OpenAI from 'openai'
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool
} from 'openai/resources/chat/completions'
import type { Provider, RunParams, RunResult, StopReason, ToolCallRequest } from './types'

export class OpenAiProvider implements Provider {
  readonly id: Provider['id']
  private client: OpenAI

  // baseURL: ใส่เพื่อชี้ไป endpoint ที่ compatible กับ OpenAI (openrouter/deepseek/kimi/glm)
  constructor(apiKey: string, opts?: { id?: Provider['id']; baseURL?: string }) {
    this.id = opts?.id ?? 'openai'
    this.client = new OpenAI({ apiKey, baseURL: opts?.baseURL })
  }

  async run(params: RunParams): Promise<RunResult> {
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: params.system }
    ]
    for (const m of params.messages) {
      if (m.role === 'tool') {
        messages.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.content })
      } else if (m.role === 'assistant') {
        messages.push({
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls?.map((t) => ({
            id: t.id,
            type: 'function',
            function: { name: t.name, arguments: JSON.stringify(t.arguments) }
          }))
        })
      } else {
        messages.push({ role: m.role, content: m.content })
      }
    }

    const tools: ChatCompletionTool[] = params.tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters }
    }))

    const stream = await this.client.chat.completions.create(
      {
        model: params.model,
        messages,
        tools: tools.length ? tools : undefined,
        stream: true
      },
      { signal: params.signal }
    )

    let text = ''
    let finish: string | null = null
    const toolAcc = new Map<number, { id: string; name: string; args: string }>()

    for await (const chunk of stream) {
      if (chunk.choices[0]?.finish_reason) finish = chunk.choices[0].finish_reason
      const delta = chunk.choices[0]?.delta
      if (!delta) continue
      if (delta.content) {
        text += delta.content
        params.onText(delta.content)
      }
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index
          const cur = toolAcc.get(idx) ?? { id: '', name: '', args: '' }
          if (tc.id) cur.id = tc.id
          if (tc.function?.name) cur.name = tc.function.name
          if (tc.function?.arguments) cur.args += tc.function.arguments
          toolAcc.set(idx, cur)
        }
      }
    }

    const toolCalls: ToolCallRequest[] = [...toolAcc.values()].map((t) => ({
      id: t.id,
      name: t.name,
      arguments: safeParse(t.args)
    }))

    const stopReason: StopReason = toolCalls.length
      ? 'tool_use'
      : finish === 'length'
        ? 'max_tokens'
        : finish === 'content_filter'
          ? 'refusal'
          : 'end_turn'
    return { text, toolCalls, stopReason }
  }
}

function safeParse(s: string): Record<string, unknown> {
  try {
    return s ? JSON.parse(s) : {}
  } catch {
    return {}
  }
}
