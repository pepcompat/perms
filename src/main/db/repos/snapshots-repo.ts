import { nanoid } from 'nanoid'
import type { FileSnapshot, FileSnapshotMeta } from '@shared/types'
import { getDb } from '../index'

/** เก็บกี่เวอร์ชันต่อไฟล์ — เกินนี้ตัวเก่าสุดจะถูกลบทิ้ง */
const KEEP_PER_PATH = 20

interface Row {
  id: string
  server_id: string | null
  path: string
  content: string
  size: number
  mode: number | null
  reason: FileSnapshot['reason']
  created_at: number
}

const toMeta = (r: Omit<Row, 'content'>): FileSnapshotMeta => ({
  id: r.id,
  serverId: r.server_id,
  path: r.path,
  size: r.size,
  mode: r.mode,
  reason: r.reason,
  createdAt: r.created_at
})

/**
 * บันทึกสำเนาไฟล์ก่อนเขียนทับ
 * ข้ามให้ถ้าเนื้อหาเหมือนเวอร์ชันล่าสุดอยู่แล้ว — กดบันทึกรัว ๆ จะได้ไม่มีขยะ
 */
export function addSnapshot(input: {
  serverId: string | null
  path: string
  content: string
  mode: number | null
  reason?: FileSnapshot['reason']
}): FileSnapshotMeta | null {
  const db = getDb()
  const latest = db
    .prepare(
      'SELECT content FROM file_snapshots WHERE server_id IS ? AND path = ? ORDER BY created_at DESC LIMIT 1'
    )
    .get(input.serverId, input.path) as { content: string } | undefined
  if (latest && latest.content === input.content) return null

  const row: Row = {
    id: nanoid(),
    server_id: input.serverId,
    path: input.path,
    content: input.content,
    size: Buffer.byteLength(input.content, 'utf8'),
    mode: input.mode,
    reason: input.reason ?? 'save',
    created_at: Date.now()
  }
  db.prepare(
    `INSERT INTO file_snapshots (id, server_id, path, content, size, mode, reason, created_at)
     VALUES (@id, @server_id, @path, @content, @size, @mode, @reason, @created_at)`
  ).run(row)

  // ตัดของเก่าทิ้ง เก็บแค่ N ล่าสุดของไฟล์นี้
  db.prepare(
    `DELETE FROM file_snapshots
     WHERE server_id IS ? AND path = ? AND id NOT IN (
       SELECT id FROM file_snapshots WHERE server_id IS ? AND path = ?
       ORDER BY created_at DESC LIMIT ?
     )`
  ).run(input.serverId, input.path, input.serverId, input.path, KEEP_PER_PATH)

  const { content: _drop, ...meta } = row
  return toMeta(meta)
}

/** รายการเวอร์ชันของไฟล์ (ใหม่→เก่า) ไม่รวมเนื้อหา */
export function listSnapshots(serverId: string | null, path: string): FileSnapshotMeta[] {
  const rows = getDb()
    .prepare(
      `SELECT id, server_id, path, size, mode, reason, created_at
       FROM file_snapshots WHERE server_id IS ? AND path = ? ORDER BY created_at DESC`
    )
    .all(serverId, path) as Omit<Row, 'content'>[]
  return rows.map(toMeta)
}

/** ดึงเนื้อหาของเวอร์ชันหนึ่ง (ใช้ตอนดู diff / ย้อนกลับ) */
export function getSnapshot(id: string): FileSnapshot | null {
  const r = getDb().prepare('SELECT * FROM file_snapshots WHERE id = ?').get(id) as Row | undefined
  if (!r) return null
  return {
    id: r.id,
    serverId: r.server_id,
    path: r.path,
    content: r.content,
    size: r.size,
    mode: r.mode,
    reason: r.reason,
    createdAt: r.created_at
  }
}

export function deleteSnapshot(id: string): void {
  getDb().prepare('DELETE FROM file_snapshots WHERE id = ?').run(id)
}
