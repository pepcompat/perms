import { execFile } from 'child_process'
import { platform } from 'os'
import type { AiCliStatus, AiProvider } from '@shared/types'
import { providerMeta } from '@shared/ai-providers'
import { buildEnv } from '../terminal/pty-session'
import { isCliEnabled } from '../db/repos/settings-repo'

// ตรวจ CLI ของ subscription (codex / claude) ที่ผู้ใช้ติดตั้งเอง — ถามสถานะผ่านคำสั่งของ CLI เท่านั้น
// ไม่อ่านไฟล์ credential / token ของ CLI เด็ดขาด (login ต้องจบในโปรแกรมของเจ้าของเท่านั้น)

function run(
  file: string,
  args: string[],
  timeout = 10_000
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(file, args, { env: buildEnv(), timeout, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      const code = err ? (typeof (err as { code?: unknown }).code === 'number' ? (err as { code: number }).code : null) : 0
      resolve({ code, stdout: String(stdout), stderr: String(stderr) })
    })
  })
}

const binCache = new Map<string, string | null>()

/** หา path ของโปรแกรมผ่าน PATH ของ login shell (แอปที่เปิดจาก Finder ได้ PATH สั้น) */
export async function resolveBin(bin: 'codex' | 'claude'): Promise<string | null> {
  if (binCache.get(bin)) return binCache.get(bin) ?? null
  let found: string | null = null
  if (platform() === 'win32') {
    const r = await run('where', [bin])
    found = r.code === 0 ? r.stdout.split(/\r?\n/)[0]?.trim() || null : null
  } else {
    const r = await run('/bin/sh', ['-c', `command -v ${bin}`])
    found = r.code === 0 ? r.stdout.trim() || null : null
  }
  binCache.set(bin, found)
  return found
}

export async function cliStatus(provider: AiProvider): Promise<AiCliStatus> {
  const meta = providerMeta(provider)
  const enabled = isCliEnabled(provider)
  const base: AiCliStatus = { installed: false, version: null, loggedIn: false, authMethod: null, enabled }
  if (!meta.cli) return { ...base, error: 'not a CLI provider' }
  binCache.delete(meta.cli.bin) // กดตรวจใหม่ = หาใหม่ (เผื่อเพิ่งติดตั้ง)
  const bin = await resolveBin(meta.cli.bin)
  if (!bin) return base
  const ver = await run(bin, ['--version'])
  const version = ver.stdout.trim().split('\n')[0] || null

  if (meta.cli.bin === 'claude') {
    const r = await run(bin, ['auth', 'status', '--json'])
    try {
      const j = JSON.parse(r.stdout) as { loggedIn?: boolean; authMethod?: string }
      return { ...base, installed: true, version, loggedIn: !!j.loggedIn, authMethod: j.authMethod ?? null }
    } catch {
      return { ...base, installed: true, version, error: (r.stderr || r.stdout).trim().slice(0, 300) }
    }
  }

  // codex: "Logged in using ChatGPT" / "Logged in using an API key" / exit≠0 เมื่อยังไม่ login
  const r = await run(bin, ['login', 'status'])
  const text = `${r.stdout}\n${r.stderr}`.trim()
  const m = text.match(/Logged in using (?:an? )?(.+)/i)
  return {
    ...base,
    installed: true,
    version,
    loggedIn: r.code === 0 && !!m,
    authMethod: m ? m[1].trim() : null
  }
}
