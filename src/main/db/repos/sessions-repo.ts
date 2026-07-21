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
  id: string,
  kind: SessionKind,
  serverId: string | null,
  title: string
): SessionRecord {
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

/** คำสั่งล่าสุดแบบไม่ซ้ำ (สำหรับ autocomplete) */
export function recentCommands(limit = 400): string[] {
  const rows = getDb()
    .prepare(
      `SELECT command, MAX(ran_at) AS last FROM commands
       WHERE command <> '' GROUP BY command ORDER BY last DESC LIMIT ?`
    )
    .all(limit) as { command: string }[]
  return rows.map((r) => r.command)
}

/**
 * สถิติคำสั่งสำหรับจัดอันดับ autocomplete — ความถี่ + ครั้งล่าสุด
 * + flag ว่าเคยรันบน server เดียวกับ session ปัจจุบันไหม (serverId=null = local)
 */
export function commandStats(
  serverId: string | null,
  limit = 600
): { command: string; count: number; lastRan: number; sameServer: number }[] {
  return getDb()
    .prepare(
      `SELECT c.command AS command,
              COUNT(*) AS count,
              MAX(c.ran_at) AS lastRan,
              MAX(CASE WHEN COALESCE(s.server_id,'') = COALESCE(?,'') THEN 1 ELSE 0 END) AS sameServer
       FROM commands c
       JOIN sessions s ON s.id = c.session_id
       WHERE c.command <> ''
       GROUP BY c.command
       ORDER BY lastRan DESC
       LIMIT ?`
    )
    .all(serverId, limit) as { command: string; count: number; lastRan: number; sameServer: number }[]
}
