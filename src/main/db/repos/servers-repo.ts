import { nanoid } from 'nanoid'
import { getDb } from '../index'
import { upsertSecret, deleteSecret, storeSecret } from '../../secrets/safe-store'
import type { ServerRecord, ServerInput } from '@shared/types'

interface ServerRow {
  id: string
  name: string
  host: string
  port: number
  username: string
  auth_type: string
  secret_id: string | null
  private_key_path: string | null
  jump_host_id: string | null
  group_name: string | null
  color: string | null
  notes: string | null
  created_at: number
  updated_at: number
}

function toRecord(row: ServerRow): ServerRecord {
  return {
    id: row.id,
    name: row.name,
    host: row.host,
    port: row.port,
    username: row.username,
    authType: row.auth_type as ServerRecord['authType'],
    hasSecret: !!row.secret_id,
    privateKeyPath: row.private_key_path,
    jumpHostId: row.jump_host_id,
    groupName: row.group_name,
    color: row.color,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function listServers(): ServerRecord[] {
  const rows = getDb()
    .prepare('SELECT * FROM servers ORDER BY group_name, name')
    .all() as ServerRow[]
  return rows.map(toRecord)
}

export function getServer(id: string): ServerRecord | null {
  const row = getDb().prepare('SELECT * FROM servers WHERE id = ?').get(id) as
    | ServerRow
    | undefined
  return row ? toRecord(row) : null
}

/** คืน row ดิบ (มี secret_id) สำหรับใช้ภายใน main เท่านั้น */
export function getServerRow(id: string): ServerRow | null {
  const row = getDb().prepare('SELECT * FROM servers WHERE id = ?').get(id) as
    | ServerRow
    | undefined
  return row ?? null
}

export function createServer(input: ServerInput): ServerRecord {
  const id = nanoid()
  const now = Date.now()
  let secretId: string | null = null

  // เก็บ private key เป็น secret ถ้าส่งมาแบบ inline
  if (input.privateKey) {
    secretId = storeSecret('ssh_private_key', input.privateKey)
  } else if (input.secret) {
    secretId = storeSecret(
      input.authType === 'key' ? 'ssh_passphrase' : 'ssh_password',
      input.secret
    )
  }

  getDb()
    .prepare(
      `INSERT INTO servers
       (id, name, host, port, username, auth_type, secret_id, private_key_path,
        jump_host_id, group_name, color, notes, created_at, updated_at)
       VALUES (@id,@name,@host,@port,@username,@authType,@secretId,@privateKeyPath,
               @jumpHostId,@groupName,@color,@notes,@now,@now)`
    )
    .run({
      id,
      name: input.name,
      host: input.host,
      port: input.port,
      username: input.username,
      authType: input.authType,
      secretId,
      privateKeyPath: input.privateKeyPath ?? null,
      jumpHostId: input.jumpHostId ?? null,
      groupName: input.groupName ?? null,
      color: input.color ?? null,
      notes: input.notes ?? null,
      now
    })
  return getServer(id)!
}

export function updateServer(id: string, input: ServerInput): ServerRecord {
  const existing = getServerRow(id)
  if (!existing) throw new Error('Server not found')

  let secretId = existing.secret_id
  // อัปเดต secret เฉพาะเมื่อมีค่าใหม่ส่งมา
  if (input.privateKey) {
    secretId = upsertSecret(secretId, 'ssh_private_key', input.privateKey)
  } else if (input.secret) {
    secretId = upsertSecret(
      secretId,
      input.authType === 'key' ? 'ssh_passphrase' : 'ssh_password',
      input.secret
    )
  }

  getDb()
    .prepare(
      `UPDATE servers SET
        name=@name, host=@host, port=@port, username=@username, auth_type=@authType,
        secret_id=@secretId, private_key_path=@privateKeyPath, jump_host_id=@jumpHostId,
        group_name=@groupName, color=@color, notes=@notes, updated_at=@now
       WHERE id=@id`
    )
    .run({
      id,
      name: input.name,
      host: input.host,
      port: input.port,
      username: input.username,
      authType: input.authType,
      secretId,
      privateKeyPath: input.privateKeyPath ?? null,
      jumpHostId: input.jumpHostId ?? null,
      groupName: input.groupName ?? null,
      color: input.color ?? null,
      notes: input.notes ?? null,
      now: Date.now()
    })
  return getServer(id)!
}

export function deleteServer(id: string): void {
  const existing = getServerRow(id)
  if (existing?.secret_id) deleteSecret(existing.secret_id)
  getDb().prepare('DELETE FROM servers WHERE id = ?').run(id)
}
