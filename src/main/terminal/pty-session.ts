import { spawn as ptySpawn, type IPty } from 'node-pty'
import { exec as cpExec } from 'child_process'
import { platform } from 'os'
import type { TermSession, ExecResult } from './types'

function defaultShell(override?: string | null): string {
  if (override) return override
  if (platform() === 'win32') return process.env.COMSPEC || 'powershell.exe'
  return process.env.SHELL || '/bin/bash'
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
    this.pty = ptySpawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.env.HOME || process.cwd(),
      env: process.env as Record<string, string>
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
        { maxBuffer: 1024 * 1024 * 8, shell: defaultShell() },
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
