import { safeStorage } from 'electron'
import { nanoid } from 'nanoid'
import { getDb } from '../db'

export type SecretKind = 'ssh_password' | 'ssh_passphrase' | 'ssh_private_key' | 'api_key'

export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

/** เข้ารหัส plaintext แล้วบันทึกลง DB คืน secret id */
export function storeSecret(kind: SecretKind, plaintext: string): string {
  if (!isEncryptionAvailable()) {
    throw new Error('OS encryption (safeStorage) is not available on this machine')
  }
  const id = nanoid()
  const ciphertext = safeStorage.encryptString(plaintext)
  getDb()
    .prepare('INSERT INTO secrets (id, kind, ciphertext, created_at) VALUES (?, ?, ?, ?)')
    .run(id, kind, ciphertext, Date.now())
  return id
}

/** อัปเดต secret ที่มีอยู่ (ถ้า id เป็น null จะสร้างใหม่) */
export function upsertSecret(
  existingId: string | null,
  kind: SecretKind,
  plaintext: string
): string {
  if (existingId) {
    const ciphertext = safeStorage.encryptString(plaintext)
    getDb()
      .prepare('UPDATE secrets SET ciphertext = ?, kind = ? WHERE id = ?')
      .run(ciphertext, kind, existingId)
    return existingId
  }
  return storeSecret(kind, plaintext)
}

/** ถอดรหัส secret คืน plaintext (null ถ้าไม่พบ) */
export function revealSecret(id: string | null): string | null {
  if (!id) return null
  const row = getDb().prepare('SELECT ciphertext FROM secrets WHERE id = ?').get(id) as
    | { ciphertext: Buffer }
    | undefined
  if (!row) return null
  return safeStorage.decryptString(row.ciphertext)
}

export function deleteSecret(id: string | null): void {
  if (!id) return
  getDb().prepare('DELETE FROM secrets WHERE id = ?').run(id)
}
