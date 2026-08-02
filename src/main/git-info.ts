import type { GitInfo } from '@shared/types'
import { shQuote } from '@shared/shell-quote'
import { execSilent } from './terminal/session-manager'

export type { GitInfo }

/** parse ผลลัพธ์คำสั่ง git ที่ยิงไป — คืน null ถ้าไม่ใช่ repo */
export function parseGitInfo(output: string): GitInfo | null {
  const branch = /^BR:(.*)$/m.exec(output)?.[1]?.trim()
  if (!branch) return null
  const commits = Number(/^CO:(\d+)$/m.exec(output)?.[1] ?? 0)
  const dirty = Number(/^DI:(\d+)$/m.exec(output)?.[1] ?? 0)
  return { branch, commits: Number.isNaN(commits) ? 0 : commits, dirty: Number.isNaN(dirty) ? 0 : dirty }
}

/**
 * ดึง git branch/จำนวน commit/ไฟล์ที่ยังไม่ commit ของโฟลเดอร์ปัจจุบันบนเซิร์ฟเวอร์
 * รับเฉพาะ path แบบ absolute (จาก prompt) — คืน null ถ้าไม่ใช่ git repo
 */
export async function getGitInfo(sessionId: string, cwd: string): Promise<GitInfo | null> {
  if (!cwd || !cwd.startsWith('/')) return null
  const q = shQuote(cwd)
  // เช็คว่าเป็น work tree ก่อน ถ้าไม่ใช่ && จะไม่รัน printf → exitCode ไม่ใช่ 0 → null
  const cmd =
    `git -C ${q} rev-parse --is-inside-work-tree >/dev/null 2>&1 && ` +
    `printf 'BR:%s\\nCO:%s\\nDI:%s\\n' ` +
    `"$(git -C ${q} rev-parse --abbrev-ref HEAD 2>/dev/null)" ` +
    `"$(git -C ${q} rev-list --count HEAD 2>/dev/null)" ` +
    `"$(git -C ${q} status --porcelain 2>/dev/null | wc -l | tr -d ' ')"`
  const r = await execSilent(sessionId, cmd).catch(() => null)
  if (!r || r.exitCode !== 0) return null
  return parseGitInfo(r.output)
}
