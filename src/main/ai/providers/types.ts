import type { AiProvider } from '@shared/types'

export interface ToolSchema {
  name: string
  description: string
  /** JSON Schema ของ parameters */
  parameters: Record<string, unknown>
}

export interface ToolCallRequest {
  id: string
  name: string
  arguments: Record<string, unknown>
}

/** ข้อความในรูปแบบกลาง — provider แต่ละเจ้าแปลงเป็นรูปแบบของตัวเอง */
export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCallRequest[] }
  | { role: 'tool'; toolCallId: string; name: string; content: string }

export interface RunParams {
  model: string
  system: string
  messages: ChatMessage[]
  tools: ToolSchema[]
  signal?: AbortSignal
  /** เปิด web search ของ provider (server-side) */
  webSearch?: boolean
  /** callback ทุกครั้งที่มี text delta ใหม่ */
  onText: (delta: string) => void
}

export interface RunResult {
  text: string
  toolCalls: ToolCallRequest[]
}

/** อินเทอร์เฟซกลางของ AI provider */
export interface Provider {
  readonly id: AiProvider
  run(params: RunParams): Promise<RunResult>
}
