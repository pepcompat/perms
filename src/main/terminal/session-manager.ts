import { nanoid } from 'nanoid'
import { BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { OpenSessionInput, OpenSessionResult } from '@shared/types'
import { PtySession } from './pty-session'
import { SshSession } from './ssh-session'
import type { TermSession } from './types'
import { getServer } from '../db/repos/servers-repo'
import { createSession, endSession, recordCommand } from '../db/repos/sessions-repo'

const sessions = new Map<string, TermSession>()

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

export async function openSession(input: OpenSessionInput): Promise<OpenSessionResult> {
  const id = nanoid()
  let term: TermSession
  let title: string
  let serverId: string | null = null

  if (input.serverId) {
    const server = getServer(input.serverId)
    if (!server) throw new Error('Server not found')
    serverId = server.id
    title = `${server.username}@${server.host}`
    term = await SshSession.open(id, server.id, input.cols, input.rows)
  } else {
    title = 'local'
    term = new PtySession(id, input.cols, input.rows, input.shell)
  }

  // ผูก event ส่งข้อมูลกลับ renderer
  term.onData((data) => broadcast(IPC.terminalDataPrefix + id, data))
  term.onExit((code) => {
    broadcast(IPC.terminalExitPrefix + id, code)
    endSession(id, code === 0 || code === null ? 'closed' : 'error')
    sessions.delete(id)
  })

  sessions.set(id, term)
  createSession(term.kind, serverId, title)
  return { sessionId: id, kind: term.kind, title }
}

export function writeSession(id: string, data: string): void {
  sessions.get(id)?.write(data)
}

export function resizeSession(id: string, cols: number, rows: number): void {
  sessions.get(id)?.resize(cols, rows)
}

export function closeSession(id: string): void {
  const s = sessions.get(id)
  if (s) {
    s.dispose()
    sessions.delete(id)
    endSession(id, 'closed')
  }
}

export function getSessionHandle(id: string): TermSession | undefined {
  return sessions.get(id)
}

/** ใช้โดย AI agent: รันคำสั่ง + บันทึกประวัติ + echo ลง terminal ของ user */
export async function execInSession(
  id: string,
  command: string,
  source: 'user' | 'ai' = 'ai'
): Promise<{ output: string; exitCode: number | null }> {
  const s = sessions.get(id)
  if (!s) throw new Error('Session not found or not active')
  // echo คำสั่งให้ user เห็นใน terminal
  broadcast(IPC.terminalDataPrefix + id, `\r\n\x1b[36m$ ${command}\x1b[0m\r\n`)
  const result = await s.exec(command)
  broadcast(IPC.terminalDataPrefix + id, result.output.replace(/\n/g, '\r\n'))
  const preview = result.output.slice(0, 2000)
  recordCommand(id, command, source, preview, result.exitCode)
  return result
}

export function disposeAll(): void {
  for (const [, s] of sessions) s.dispose()
  sessions.clear()
}
