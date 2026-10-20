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

/**
 * ข้อความของ session เรียงเก่า→ใหม่ — เอา "ล่าสุด" limit แถว
 * (เดิม ORDER BY ASC LIMIT ได้ 200 แถวแรกสุด → บทสนทนายาวแล้ว AI ไม่เห็นของใหม่เลย)
 */
export function listMessages(sessionId: string | null, limit = 400): AiMessageRecord[] {
  const where = sessionId ? 'session_id = ?' : 'session_id IS NULL'
  const args = sessionId ? [sessionId, limit] : [limit]
  const rows = getDb()
    .prepare(
      `SELECT * FROM (
         SELECT rowid AS rid, * FROM ai_history WHERE ${where}
         ORDER BY created_at DESC, rowid DESC LIMIT ?
       ) ORDER BY created_at ASC, rid ASC`
    )
    .all(...args) as AiRow[]
  return rows.map(toRecord)
}

/** ล้างบทสนทนาของ session (ปุ่มล้างแชท) — ให้ AI ลืมจริง ไม่ใช่แค่ล้างหน้าจอ */
export function clearMessages(sessionId: string | null): void {
  if (sessionId) getDb().prepare('DELETE FROM ai_history WHERE session_id = ?').run(sessionId)
  else getDb().prepare('DELETE FROM ai_history WHERE session_id IS NULL').run()
}
