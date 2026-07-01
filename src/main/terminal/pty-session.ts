import { spawn as ptySpawn, type IPty } from 'node-pty'
import { exec as cpExec, execFileSync } from 'child_process'
import { platform } from 'os'
import type { TermSession, ExecResult } from './types'

function defaultShell(override?: string | null): string {
  if (override) return override
  if (platform() === 'win32') return process.env.COMSPEC || 'powershell.exe'
  if (process.env.SHELL) return process.env.SHELL
  return platform() === 'darwin' ? '/bin/zsh' : '/bin/bash'
}

/**
 * args ของ shell — เปิดเป็น **login shell** บน mac/linux ให้ได้ PATH/alias/ฟังก์ชัน
 * เหมือน Terminal.app (source /etc/zprofile → path_helper + ~/.zprofile/~/.zshrc)
 */
function shellArgs(): string[] {
  return platform() === 'win32' ? [] : ['-l']
}

/**
 * แอปที่เปิดจาก Finder/Dock ได้ PATH สั้น ๆ (ไม่รวม /usr/local/bin, /opt/homebrew/bin,
 * ~/.docker/bin ...) ทำให้ docker/brew/node หา command ไม่เจอ. ดึง PATH จริงจาก login shell
 * มาแทน แล้ว cache ไว้ครั้งเดียว. (คืน null บน win32 หรือถ้าดึงไม่ได้ → ใช้ process.env.PATH)
 */
let cachedPath: string | null | undefined
function loginPath(): string | null {
  if (cachedPath !== undefined) return cachedPath
  cachedPath = null
  if (platform() === 'win32') return null
  try {
    const marker = '__PERMS_PATH__'
    // ใช้ ${PATH} มีวงเล็บ (escaped ใน JS เป็น \${PATH}) — ถ้าใช้ $PATH เฉย ๆ shell จะกลืน
    // marker ที่ขึ้นต้นด้วย _ เป็นส่วนของชื่อตัวแปร → ได้ค่าว่าง
    const out = execFileSync(
      defaultShell(),
      ['-lc', `command printf '%s' "${marker}\${PATH}${marker}"`],
      { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }
    )
    const m = out.match(new RegExp(`${marker}(.*)${marker}`, 's'))
    const p = m?.[1]?.trim()
    if (p) cachedPath = p
  } catch {
    /* ดึงไม่ได้ (เช่น shell ล้ม/timeout) — ใช้ค่า fallback */
  }
  return cachedPath
}

/**
 * env สำหรับ pty — ใส่ PATH จริงจาก login shell + บังคับ locale เป็น UTF-8 ถ้ายังไม่ตั้ง
 * (แอปที่เปิดจาก Finder/dock มักไม่มี LANG ทำให้ ls แสดงชื่อไฟล์ไทยเป็น ?)
 */
function buildEnv(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>
  if (platform() !== 'win32') {
    const p = loginPath()
    if (p) env.PATH = p
    const hasUtf8 =
      /utf-?8/i.test(env.LC_ALL || '') ||
      /utf-?8/i.test(env.LC_CTYPE || '') ||
      /utf-?8/i.test(env.LANG || '')
    if (!hasUtf8) {
      // ตั้งแค่ LANG (ขับ LC_CTYPE ให้เอง) — เลี่ยง warning locale ที่ไม่มีบน Linux
      env.LANG = 'en_US.UTF-8'
    }
  }
  return env
}

export class PtySession implements TermSession {
  readonly kind = 'local' as const
  private pty: IPty
  private dataCbs: ((data: string) => void)[] = []
  private exitCbs: ((code: number | null) => void)[] = []

  constructor(
    readonly id: string,
    cols: number,
    rows: number,
    shellOverride?: string | null
  ) {
    const shell = defaultShell(shellOverride)
    this.pty = ptySpawn(shell, shellArgs(), {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.env.HOME || process.cwd(),
      env: buildEnv()
    })
    this.pty.onData((d) => this.dataCbs.forEach((cb) => cb(d)))
    this.pty.onExit(({ exitCode }) => this.exitCbs.forEach((cb) => cb(exitCode)))
  }

  write(data: string): void {
    this.pty.write(data)
  }

  resize(cols: number, rows: number): void {
    try {
      this.pty.resize(cols, rows)
    } catch {
      /* ignore resize on dead pty */
    }
  }

  onData(cb: (data: string) => void): void {
    this.dataCbs.push(cb)
  }

  onExit(cb: (code: number | null) => void): void {
    this.exitCbs.push(cb)
  }

  exec(command: string): Promise<ExecResult> {
    return new Promise((resolve) => {
      cpExec(
        command,
        { maxBuffer: 1024 * 1024 * 8, shell: defaultShell(), env: buildEnv() },
        (err, stdout, stderr) => {
          const output = (stdout || '') + (stderr || '')
          const exitCode = err && typeof (err as { code?: number }).code === 'number'
            ? (err as { code: number }).code
            : err
            ? 1
            : 0
          resolve({ output, exitCode })
        }
      )
    })
  }

  dispose(): void {
    try {
      this.pty.kill()
    } catch {
      /* already dead */
    }
  }
}
