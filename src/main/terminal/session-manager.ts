import { nanoid } from 'nanoid'
import { BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { OpenSessionInput, OpenSessionResult, LiveSession } from '@shared/types'
import { appendScrollback } from '@shared/scrollback'
import { PtySession } from './pty-session'
import { SshSession } from './ssh-session'
import type { TermSession } from './types'
import { getServer } from '../db/repos/servers-repo'
import { createSession, endSession, recordCommand } from '../db/repos/sessions-repo'

const sessions = new Map<string, TermSession>()

/** ข้อมูลประกอบ + output ล่าสุด เก็บไว้ให้ UI ต่อกลับได้หลัง refresh */
interface SessionMeta {
  kind: OpenSessionResult['kind']
  title: string
  serverId: string | null
  scrollback: string
  openedAt: number
}
const meta = new Map<string, SessionMeta>()

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

/**
 * ส่ง output ให้ renderer พร้อมเก็บสำเนาไว้เล่นซ้ำ
 * ต้องเรียกผ่านตัวนี้ทุกที่ ไม่งั้น output บางส่วนจะหายไปตอนต่อกลับ
 */
function emitData(id: string, data: string): void {
  const m = meta.get(id)
  if (m) m.scrollback = appendScrollback(m.scrollback, data)
  broadcast(IPC.terminalDataPrefix + id, data)
}

/** session ที่ยังเปิดอยู่จริงใน main — UI ใช้สร้าง tab กลับมาหลัง refresh */
export function listLiveSessions(): LiveSession[] {
  return [...sessions.keys()]
    .map((id) => {
      const m = meta.get(id)
      return m
        ? { sessionId: id, kind: m.kind, title: m.title, serverId: m.serverId, openedAt: m.openedAt }
        : null
    })
    .filter((s): s is LiveSession => s !== null)
    .sort((a, b) => a.openedAt - b.openedAt)
}

/** output ล่าสุดของ session (ใช้ตอน renderer ต่อกลับ) */
export function replaySession(id: string): string {
  return meta.get(id)?.scrollback ?? ''
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

  meta.set(id, { kind: term.kind, title, serverId, scrollback: '', openedAt: Date.now() })

  // ผูก event ส่งข้อมูลกลับ renderer
  term.onData((data) => emitData(id, data))
  term.onExit((code) => {
    broadcast(IPC.terminalExitPrefix + id, code)
    endSession(id, code === 0 || code === null ? 'closed' : 'error')
    sessions.delete(id)
    meta.delete(id)
  })

  // สร้าง row ใน DB ด้วย id เดียวกับ terminal session (กัน FK พังตอน recordCommand)
  createSession(id, term.kind, serverId, title)
  sessions.set(id, term)
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
    meta.delete(id)
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
  emitData(id, `\r\n\x1b[36m$ ${command}\x1b[0m\r\n`)
  const result = await s.exec(command)
  emitData(id, result.output.replace(/\n/g, '\r\n'))
  const preview = result.output.slice(0, 2000)
  recordCommand(id, command, source, preview, result.exitCode)
  return result
}

/**
 * ใช้โดย AI agent: พิมพ์คำสั่งลง terminal จริง (interactive) ที่ user เห็น
 * เหมาะกับ installer/TUI/คำสั่งที่ถาม y/n หรือคำสั่งที่ต้องคงสถานะ shell
 * (cd, source ...) — user ตอบโต้เองได้ แต่ AI จะไม่ได้ output กลับมาตรง ๆ
 */
export function runInTerminal(id: string, command: string): void {
  const s = sessions.get(id)
  if (!s) throw new Error('Session not found or not active')
  s.write(command + '\n')
  recordCommand(id, command, 'ai', null, null)
}

/** รันคำสั่งเบื้องหลัง (ไม่ echo ลง terminal, ไม่บันทึกประวัติ) — ใช้ query สถานะ เช่น docker */
export async function execSilent(
  id: string,
  command: string
): Promise<{ output: string; exitCode: number | null }> {
  const s = sessions.get(id)
  if (!s) throw new Error('Session not found or not active')
  return s.exec(command)
}

export function disposeAll(): void {
  for (const [, s] of sessions) s.dispose()
  sessions.clear()
}
