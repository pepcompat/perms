import { getDb } from '../index'
import { hostKeyId } from '@shared/host-key'
import type { KnownHostRecord } from '@shared/types'

export type { KnownHostRecord }

interface Row {
  id: string
  host: string
  port: number
  key_type: string
  fingerprint: string
  first_seen: number
  last_seen: number
}

const toRecord = (r: Row): KnownHostRecord => ({
  id: r.id,
  host: r.host,
  port: r.port,
  keyType: r.key_type,
  fingerprint: r.fingerprint,
  firstSeen: r.first_seen,
  lastSeen: r.last_seen
})

export function getKnownHost(host: string, port: number): KnownHostRecord | null {
  const row = getDb()
    .prepare('SELECT * FROM known_hosts WHERE id = ?')
    .get(hostKeyId(host, port)) as Row | undefined
  return row ? toRecord(row) : null
}

export function listKnownHosts(): KnownHostRecord[] {
  const rows = getDb()
    .prepare('SELECT * FROM known_hosts ORDER BY host, port')
    .all() as Row[]
  return rows.map(toRecord)
}

/** บันทึก/อัปเดตลายนิ้วมือที่ผู้ใช้ยอมรับแล้ว */
export function trustHostKey(host: string, port: number, keyType: string, fingerprint: string): void {
  const now = Date.now()
  getDb()
    .prepare(
      `INSERT INTO known_hosts (id, host, port, key_type, fingerprint, first_seen, last_seen)
       VALUES (@id, @host, @port, @keyType, @fingerprint, @now, @now)
       ON CONFLICT(id) DO UPDATE SET
         key_type = @keyType, fingerprint = @fingerprint, last_seen = @now`
    )
    .run({ id: hostKeyId(host, port), host, port: port || 22, keyType, fingerprint, now })
}

/** แตะเวลาที่เจอล่าสุด — เรียกเมื่อ verify ผ่าน */
export function touchHostKey(host: string, port: number): void {
  getDb()
    .prepare('UPDATE known_hosts SET last_seen = ? WHERE id = ?')
    .run(Date.now(), hostKeyId(host, port))
}

/** ลืม host นี้ — ครั้งหน้าจะถามยืนยันใหม่ */
export function forgetHostKey(id: string): void {
  getDb().prepare('DELETE FROM known_hosts WHERE id = ?').run(id)
}
