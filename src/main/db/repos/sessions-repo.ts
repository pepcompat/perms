import { nanoid } from 'nanoid'
import { getDb } from '../index'
import type { SessionRecord, SessionKind, CommandRecord, CommandSource } from '@shared/types'

interface SessionRow {
  id: string
  server_id: string | null
  kind: string
  started_at: number
  ended_at: number | null
  status: string
  title: string
}

function toSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    serverId: row.server_id,
    kind: row.kind as SessionKind,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    status: row.status as SessionRecord['status'],
    title: row.title
  }
}

export function createSession(
  kind: SessionKind,
  serverId: string | null,
  title: string
): SessionRecord {
  const id = nanoid()
  getDb()
    .prepare(
      `INSERT INTO sessions (id, server_id, kind, started_at, status, title)
       VALUES (?, ?, ?, ?, 'active', ?)`
    )
    .run(id, serverId, kind, Date.now(), title)
  return getSession(id)!
}

export function getSession(id: string): SessionRecord | null {
  const row = getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id) as
    | SessionRow
    | undefined
  return row ? toSession(row) : null
}

export function endSession(id: string, status: 'closed' | 'error' = 'closed'): void {
  getDb()
    .prepare('UPDATE sessions SET ended_at = ?, status = ? WHERE id = ?')
    .run(Date.now(), status, id)
}

export function listSessions(limit = 100): SessionRecord[] {
  const rows = getDb()
    .prepare('SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?')
    .all(limit) as SessionRow[]
  return rows.map(toSession)
}

// ---- commands ----

interface CommandRow {
  id: string
  session_id: string
  command: string
  exit_code: number | null
  output_preview: string | null
  ran_at: number
  source: string
}

function toCommand(row: CommandRow): CommandRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    command: row.command,
    exitCode: row.exit_code,
    outputPreview: row.output_preview,
    ranAt: row.ran_at,
    source: row.source as CommandSource
  }
}

export function recordCommand(
  sessionId: string,
  command: string,
  source: CommandSource,
  outputPreview: string | null = null,
  exitCode: number | null = null
): CommandRecord {
  const id = nanoid()
  getDb()
    .prepare(
      `INSERT INTO commands (id, session_id, command, exit_code, output_preview, ran_at, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, sessionId, command, exitCode, outputPreview, Date.now(), source)
  return toCommand(
    getDb().prepare('SELECT * FROM commands WHERE id = ?').get(id) as CommandRow
  )
}

export function listCommands(sessionId: string): CommandRecord[] {
  const rows = getDb()
    .prepare('SELECT * FROM commands WHERE session_id = ? ORDER BY ran_at ASC')
    .all(sessionId) as CommandRow[]
  return rows.map(toCommand)
}

export function searchCommands(query: string, limit = 30): CommandRecord[] {
  const rows = getDb()
    .prepare(
      'SELECT * FROM commands WHERE command LIKE ? ORDER BY ran_at DESC LIMIT ?'
    )
    .all(`%${query}%`, limit) as CommandRow[]
  return rows.map(toCommand)
}
