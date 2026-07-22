import { createServer, connect as netConnect, type Server } from 'net'
import { nanoid } from 'nanoid'
import { BrowserWindow } from 'electron'
import type { Client } from 'ssh2'
import { IPC } from '@shared/ipc-channels'
import type { TunnelInfo } from '@shared/types'
import { getSessionHandle } from '../terminal/session-manager'
import { SshSession } from '../terminal/ssh-session'

interface Entry {
  info: TunnelInfo
  /** listener ฝั่งเครื่องเรา (เฉพาะ type=local) */
  server?: Server
  client: Client
}

const tunnels = new Map<string, Entry>()

function broadcast(): void {
  const list = [...tunnels.values()].map((t) => t.info)
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.tunnelUpdate, list)
  }
}

export function listTunnels(sessionId?: string): TunnelInfo[] {
  return [...tunnels.values()]
    .map((t) => t.info)
    .filter((t) => !sessionId || t.sessionId === sessionId)
}

function clientOf(sessionId: string): Client {
  const s = getSessionHandle(sessionId)
  if (!(s instanceof SshSession)) throw new Error('อุโมงค์ใช้ได้เฉพาะ session แบบ SSH')
  return s.getClient()
}

/**
 * local forward: เปิดพอร์ตบนเครื่องเรา แล้วส่งต่อผ่าน SSH ไปยัง destHost:destPort
 * (เช่น เปิด 5433 ในเครื่อง → ชนไปที่ localhost:5432 บนเซิร์ฟเวอร์)
 *
 * ผูก listener ไว้ที่ 127.0.0.1 เท่านั้น — ถ้า bind 0.0.0.0 คนอื่นในวง LAN
 * จะทะลุเข้าเซิร์ฟเวอร์ผ่านเครื่องเราได้โดยไม่ต้องมี credential
 */
export async function openLocalTunnel(input: {
  sessionId: string
  listenPort: number
  destHost: string
  destPort: number
}): Promise<TunnelInfo> {
  const client = clientOf(input.sessionId)
  const info: TunnelInfo = {
    id: nanoid(),
    sessionId: input.sessionId,
    type: 'local',
    listenPort: input.listenPort,
    destHost: input.destHost,
    destPort: input.destPort,
    status: 'open',
    connections: 0,
    createdAt: Date.now()
  }

  const server = createServer((sock) => {
    client.forwardOut(
      '127.0.0.1',
      sock.remotePort ?? 0,
      input.destHost,
      input.destPort,
      (err, stream) => {
        if (err) {
          sock.destroy()
          return
        }
        info.connections++
        broadcast()
        sock.pipe(stream).pipe(sock)
        const close = (): void => {
          sock.destroy()
          stream.destroy()
        }
        sock.on('error', close)
        stream.on('error', close)
      }
    )
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(input.listenPort, '127.0.0.1', () => {
      server.removeListener('error', reject)
      resolve()
    })
  })

  server.on('error', (e) => {
    info.status = 'error'
    info.error = e.message
    broadcast()
  })

  tunnels.set(info.id, { info, server, client })
  broadcast()
  return info
}

/**
 * remote forward: เปิดพอร์ตบนเซิร์ฟเวอร์ แล้วส่งกลับมาที่ destHost:destPort ในเครื่องเรา
 * (เช่น เปิด 8080 บนเซิร์ฟเวอร์ → ชนกลับมา localhost:3000 ในเครื่อง)
 */
export async function openRemoteTunnel(input: {
  sessionId: string
  listenPort: number
  destHost: string
  destPort: number
}): Promise<TunnelInfo> {
  const client = clientOf(input.sessionId)
  const info: TunnelInfo = {
    id: nanoid(),
    sessionId: input.sessionId,
    type: 'remote',
    listenPort: input.listenPort,
    destHost: input.destHost,
    destPort: input.destPort,
    status: 'open',
    connections: 0,
    createdAt: Date.now()
  }

  await new Promise<void>((resolve, reject) => {
    client.forwardIn('127.0.0.1', input.listenPort, (err) => (err ? reject(err) : resolve()))
  })

  const onConn = (
    details: { destPort: number },
    accept: () => NodeJS.ReadWriteStream & { destroy: () => void },
    reject: () => void
  ): void => {
    if (details.destPort !== input.listenPort) return reject()
    const stream = accept()
    info.connections++
    broadcast()
    const local = netConnect(input.destPort, input.destHost, () => {
      stream.pipe(local).pipe(stream)
    })
    local.on('error', () => stream.destroy())
    stream.on('error', () => local.destroy())
  }
  client.on('tcp connection', onConn as never)

  tunnels.set(info.id, { info, client })
  broadcast()
  return info
}

export async function closeTunnel(id: string): Promise<void> {
  const t = tunnels.get(id)
  if (!t) return
  if (t.server) {
    await new Promise<void>((resolve) => t.server!.close(() => resolve()))
  } else {
    // remote forward — บอกเซิร์ฟเวอร์ให้เลิกฟังพอร์ตนั้น
    try {
      t.client.unforwardIn('127.0.0.1', t.info.listenPort, () => undefined)
    } catch {
      /* connection อาจปิดไปแล้ว */
    }
  }
  tunnels.delete(id)
  broadcast()
}

/** ปิดอุโมงค์ทั้งหมดของ session — เรียกตอน session ปิด กันพอร์ตค้าง */
export function closeTunnelsOfSession(sessionId: string): void {
  for (const [id, t] of tunnels) {
    if (t.info.sessionId === sessionId) void closeTunnel(id)
  }
}
