import { GoogleGenAI, type Content, type Part, type FunctionDeclaration } from '@google/genai'
import type { Provider, RunParams, RunResult, ToolCallRequest } from './types'

export class GoogleProvider implements Provider {
  readonly id = 'google' as const
  private client: GoogleGenAI

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey })
  }

  async run(params: RunParams): Promise<RunResult> {
    const contents: Content[] = []
    for (const m of params.messages) {
      if (m.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: m.content }] })
      } else if (m.role === 'assistant') {
        const parts: Part[] = []
        if (m.content) parts.push({ text: m.content })
        for (const t of m.toolCalls ?? []) {
          parts.push({ functionCall: { name: t.name, args: t.arguments } })
        }
        contents.push({ role: 'model', parts })
      } else if (m.role === 'tool') {
        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: m.name,
                response: { output: m.content }
              }
            }
          ]
        })
      }
    }

    const functionDeclarations: FunctionDeclaration[] = params.tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters as FunctionDeclaration['parameters']
    }))

    // รวม function tools + Google Search grounding (ถ้าเปิด web search)
    const tools: Record<string, unknown>[] = []
    if (functionDeclarations.length) tools.push({ functionDeclarations })
    if (params.webSearch) tools.push({ googleSearch: {} })

    const stream = await this.client.models.generateContentStream({
      model: params.model,
      contents,
      config: {
        systemInstruction: params.system,
        tools: tools.length ? (tools as never) : undefined
      }
    })

    let text = ''
    const toolCalls: ToolCallRequest[] = []
    let callIdx = 0

    for await (const chunk of stream) {
      if (params.signal?.aborted) break
      const cand = chunk.candidates?.[0]
      const parts = cand?.content?.parts ?? []
      for (const part of parts) {
        if (part.text) {
          text += part.text
          params.onText(part.text)
        }
        if (part.functionCall) {
          toolCalls.push({
            id: `${part.functionCall.name}-${callIdx++}`,
            name: part.functionCall.name ?? '',
            arguments: (part.functionCall.args as Record<string, unknown>) ?? {}
          })
        }
      }
    }

    return { text, toolCalls }
  }
}
