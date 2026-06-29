import { nanoid } from 'nanoid'
import { getDb } from '../index'
import type { AiMessageRecord, AiProvider, AiToolCall } from '@shared/types'

interface AiRow {
  id: string
  session_id: string | null
  provider: string
  model: string
  role: string
  content: string
  tool_calls: string | null
  created_at: number
}

function toRecord(row: AiRow): AiMessageRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    provider: row.provider as AiProvider,
    model: row.model,
    role: row.role as AiMessageRecord['role'],
    content: row.content,
    toolCalls: row.tool_calls ? (JSON.parse(row.tool_calls) as AiToolCall[]) : null,
    createdAt: row.created_at
  }
}

export function appendMessage(
  msg: Omit<AiMessageRecord, 'id' | 'createdAt'>
): AiMessageRecord {
  const id = nanoid()
  getDb()
    .prepare(
      `INSERT INTO ai_history (id, session_id, provider, model, role, content, tool_calls, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      msg.sessionId,
      msg.provider,
      msg.model,
      msg.role,
      msg.content,
      msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
      Date.now()
    )
  return toRecord(getDb().prepare('SELECT * FROM ai_history WHERE id = ?').get(id) as AiRow)
}

export function listMessages(sessionId: string | null, limit = 200): AiMessageRecord[] {
  const rows = (
    sessionId
      ? getDb()
          .prepare(
            'SELECT * FROM ai_history WHERE session_id = ? ORDER BY created_at ASC LIMIT ?'
          )
          .all(sessionId, limit)
      : getDb()
          .prepare(
            'SELECT * FROM ai_history WHERE session_id IS NULL ORDER BY created_at ASC LIMIT ?'
          )
          .all(limit)
  ) as AiRow[]
  return rows.map(toRecord)
}
