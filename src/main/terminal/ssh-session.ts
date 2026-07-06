import type { Client, ClientChannel, SFTPWrapper } from 'ssh2'
import { connectSsh } from '../ssh/connect'
import type { TermSession, ExecResult } from './types'

export class SshSession implements TermSession {
  readonly kind = 'ssh' as const
  private client!: Client
  private shell!: ClientChannel
  private sftpChan: SFTPWrapper | null = null
  private dataCbs: ((data: string) => void)[] = []
  private exitCbs: ((code: number | null) => void)[] = []

  private constructor(readonly id: string) {}

  static async open(
    id: string,
    serverId: string,
    cols: number,
    rows: number
  ): Promise<SshSession> {
    const s = new SshSession(id)
    s.client = await connectSsh(serverId)
    s.shell = await new Promise<ClientChannel>((resolve, reject) => {
      s.client.shell({ term: 'xterm-256color', cols, rows }, (err, channel) => {
        if (err) reject(err)
        else resolve(channel)
      })
    })
    s.shell.on('data', (d: Buffer) => s.dataCbs.forEach((cb) => cb(d.toString('utf8'))))
    s.shell.on('close', () => {
      s.exitCbs.forEach((cb) => cb(null))
      s.client.end()
    })
    return s
  }

  write(data: string): void {
    this.shell.write(data)
  }

  resize(cols: number, rows: number): void {
    try {
      this.shell.setWindow(rows, cols, 0, 0)
    } catch {
      /* ignore */
    }
  }

  onData(cb: (data: string) => void): void {
    this.dataCbs.push(cb)
  }

  onExit(cb: (code: number | null) => void): void {
    this.exitCbs.push(cb)
  }

  /** เปิด (และ cache) sftp channel บน connection เดิม — ไม่ต้อง auth ใหม่ */
  getSftp(): Promise<SFTPWrapper> {
    if (this.sftpChan) return Promise.resolve(this.sftpChan)
    return new Promise<SFTPWrapper>((resolve, reject) => {
      this.client.sftp((err, sftp) => {
        if (err) return reject(err)
        this.sftpChan = sftp
        sftp.on('close', () => (this.sftpChan = null))
        resolve(sftp)
      })
    })
  }

  exec(command: string): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
      this.client.exec(command, (err, channel) => {
        if (err) return reject(err)
        let output = ''
        let exitCode: number | null = null
        channel.on('data', (d: Buffer) => (output += d.toString('utf8')))
        channel.stderr.on('data', (d: Buffer) => (output += d.toString('utf8')))
        channel.on('exit', (code: number) => (exitCode = code))
        channel.on('close', () => resolve({ output, exitCode }))
      })
    })
  }

  dispose(): void {
    try {
      this.shell?.end()
    } catch {
      /* ignore */
    }
    try {
      this.client?.end()
    } catch {
      /* ignore */
    }
  }
}
