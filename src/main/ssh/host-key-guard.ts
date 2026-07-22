import { createHash } from 'crypto'
import { BrowserWindow } from 'electron'
import { nanoid } from 'nanoid'
import { IPC } from '@shared/ipc-channels'
import type { HostKeyPrompt } from '@shared/types'
import { formatFingerprint, verifyHostKey } from '@shared/host-key'
import { getKnownHost, trustHostKey, touchHostKey } from '../db/repos/known-hosts-repo'

/** ถ้าผู้ใช้ไม่ตอบภายในเวลานี้ ถือว่าไม่ยอมรับ — กันการเชื่อมต่อค้างตลอดกาล */
const PROMPT_TIMEOUT_MS = 2 * 60 * 1000

const pending = new Map<string, (accepted: boolean) => void>()

/**
 * ชนิดคีย์อยู่ต้น blob ตามรูปแบบ SSH wire: uint32 ความยาว + ชื่อชนิดเป็น ASCII
 * (อ่านเองไม่ต้องพึ่ง parseKey — เร็วกว่าและไม่พังกับคีย์ชนิดที่ไลบรารียังไม่รู้จัก)
 */
export function keyTypeOf(key: Buffer): string {
  if (key.length < 4) return 'unknown'
  const len = key.readUInt32BE(0)
  if (len <= 0 || len > 64 || key.length < 4 + len) return 'unknown'
  const t = key.subarray(4, 4 + len).toString('ascii')
  return /^[\w.@-]+$/.test(t) ? t : 'unknown'
}

/** ลายนิ้วมือแบบเดียวกับที่ `ssh-keyscan | ssh-keygen -lf -` แสดง */
export function fingerprintOf(key: Buffer): string {
  return formatFingerprint(createHash('sha256').update(key).digest('base64'))
}

function broadcast(payload: HostKeyPrompt): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.hostKeyPrompt, payload)
  }
}

/** ผู้ใช้ตอบกลับจาก dialog */
export function resolveHostKeyPrompt(id: string, accepted: boolean): void {
  const resolve = pending.get(id)
  if (resolve) {
    pending.delete(id)
    resolve(accepted)
  }
}

function ask(payload: Omit<HostKeyPrompt, 'id'>): Promise<boolean> {
  return new Promise((resolve) => {
    const id = nanoid()
    let settled = false
    const done = (ok: boolean): void => {
      if (settled) return
      settled = true
      pending.delete(id)
      resolve(ok)
    }
    pending.set(id, done)
    setTimeout(() => done(false), PROMPT_TIMEOUT_MS).unref?.()
    broadcast({ id, ...payload })
  })
}

/**
 * ตรวจ host key ก่อนยอมให้เชื่อมต่อ
 * - เคยยอมรับแล้วและตรงกัน → ผ่านเงียบ ๆ
 * - ไม่เคยเจอ → ถามผู้ใช้ (TOFU) ถ้ายอมรับจึงจำไว้
 * - เปลี่ยนไปจากเดิม → ถามด้วยคำเตือนหนัก ๆ ว่าอาจโดนดักกลางทาง
 */
export async function checkHostKey(
  host: string,
  port: number,
  serverName: string,
  key: Buffer
): Promise<boolean> {
  const keyType = keyTypeOf(key)
  const fingerprint = fingerprintOf(key)
  const stored = getKnownHost(host, port)
  const verdict = verifyHostKey(stored, { keyType, fingerprint })

  if (verdict === 'match') {
    touchHostKey(host, port)
    return true
  }

  const accepted = await ask({
    host,
    port,
    serverName,
    keyType,
    fingerprint,
    verdict,
    previousFingerprint: stored?.fingerprint ?? null,
    previousKeyType: stored?.keyType ?? null
  })

  if (accepted) trustHostKey(host, port, keyType, fingerprint)
  return accepted
}
