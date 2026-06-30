import { nanoid } from 'nanoid'
import { getDb } from '../index'
import type { KnowledgeRecord, KnowledgeInput } from '@shared/types'

interface KnowledgeRow {
  id: string
  title: string
  content: string
  tags: string | null
  server_id: string | null
  source: string
  use_count: number
  created_at: number
  updated_at: number
}

function toRecord(row: KnowledgeRow): KnowledgeRecord {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: row.tags ? (JSON.parse(row.tags) as string[]) : [],
    serverId: row.server_id,
    source: row.source as 'ai' | 'user',
    useCount: row.use_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function listKnowledge(): KnowledgeRecord[] {
  const rows = getDb()
    .prepare('SELECT * FROM knowledge ORDER BY updated_at DESC')
    .all() as KnowledgeRow[]
  return rows.map(toRecord)
}

export function saveKnowledge(input: KnowledgeInput): KnowledgeRecord {
  const now = Date.now()
  const tags = JSON.stringify(input.tags ?? [])
  if (input.id) {
    getDb()
      .prepare(
        'UPDATE knowledge SET title=?, content=?, tags=?, server_id=?, updated_at=? WHERE id=?'
      )
      .run(input.title, input.content, tags, input.serverId ?? null, now, input.id)
    return toRecord(
      getDb().prepare('SELECT * FROM knowledge WHERE id = ?').get(input.id) as KnowledgeRow
    )
  }
  const id = nanoid()
  getDb()
    .prepare(
      `INSERT INTO knowledge (id, title, content, tags, server_id, source, use_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
    )
    .run(id, input.title, input.content, tags, input.serverId ?? null, input.source ?? 'user', now, now)
  return toRecord(getDb().prepare('SELECT * FROM knowledge WHERE id = ?').get(id) as KnowledgeRow)
}

export function deleteKnowledge(id: string): void {
  getDb().prepare('DELETE FROM knowledge WHERE id = ?').run(id)
}

export function bumpUseCount(ids: string[]): void {
  if (!ids.length) return
  const stmt = getDb().prepare('UPDATE knowledge SET use_count = use_count + 1 WHERE id = ?')
  const tx = getDb().transaction((list: string[]) => list.forEach((id) => stmt.run(id)))
  tx(ids)
}

/**
 * ค้นความรู้แบบ keyword (ยังไม่ใช้ FTS) — แตก query เป็นคำ แล้วจัดอันดับใน JS
 * ของ server ปัจจุบัน + ความรู้กลาง (server_id null) จะถูกดึงมาก่อน
 */
export function searchKnowledge(
  query: string,
  opts: { serverId?: string | null; limit?: number } = {}
): KnowledgeRecord[] {
  const limit = opts.limit ?? 5
  const keywords = query
    .toLowerCase()
    .split(/[^a-z0-9ก-๙_./-]+/i)
    .filter((w) => w.length >= 3)
  if (!keywords.length) return []

  // ดึง candidate: ความรู้ของ server นี้ + ความรู้กลาง
  const rows = getDb()
    .prepare(
      `SELECT * FROM knowledge WHERE server_id IS NULL OR server_id = ? ORDER BY updated_at DESC LIMIT 400`
    )
    .all(opts.serverId ?? null) as KnowledgeRow[]

  const scored = rows
    .map((row) => {
      const hay = `${row.title}\n${row.content}\n${row.tags ?? ''}`.toLowerCase()
      let matches = 0
      for (const kw of keywords) if (hay.includes(kw)) matches++
      const score =
        matches * 100 +
        (row.server_id === opts.serverId ? 25 : 0) +
        Math.min(row.use_count, 20)
      return { row, matches, score }
    })
    .filter((s) => s.matches > 0)
    .sort((a, b) => b.score - a.score || b.row.updated_at - a.row.updated_at)
    .slice(0, limit)

  return scored.map((s) => toRecord(s.row))
}
