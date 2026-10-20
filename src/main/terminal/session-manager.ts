import { nanoid } from 'nanoid'
import { BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { OpenSessionInput, OpenSessionResult, LiveSession } from '@shared/types'
import { appendScrollback } from '@shared/scrollback'
import { stripAnsi, tailLines } from '@shared/ansi'
import { wrapWithCwd, splitCwdMarker } from '@shared/cwd-exec'
import { clearServerStats } from '../server-stats'
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

/** ผู้ฟัง output ชั่วคราวต่อ session (ใช้เก็บผลของคำสั่งที่ AI พิมพ์ลง terminal) */
const taps = new Map<string, Set<(data: string) => void>>()

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
  taps.get(id)?.forEach((cb) => cb(data))
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
    clearServerStats(id)
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
    clearServerStats(id)
    endSession(id, 'closed')
  }
}

export function getSessionHandle(id: string): TermSession | undefined {
  return sessions.get(id)
}

/**
 * ใช้โดย AI agent: รันคำสั่ง + บันทึกประวัติ + echo ลง terminal ของ user
 * opts.cwd (ส่งมา = ใช้โหมดจำ cwd): เริ่มที่ cwd นั้น (null = home) และคืน cwd หลังรันกลับไป
 */
export async function execInSession(
  id: string,
  command: string,
  source: 'user' | 'ai' = 'ai',
  opts: { cwd?: string | null } = {}
): Promise<{ output: string; exitCode: number | null; cwd: string | null }> {
  const s = sessions.get(id)
  if (!s) throw new Error('Session not found or not active')
  // shell ฝั่ง Windows ไม่ใช่ POSIX — ห่อ cd/printf ไม่ได้
  const track = opts.cwd !== undefined && !(s.kind === 'local' && process.platform === 'win32')
  // echo คำสั่งให้ user เห็นใน terminal
  emitData(id, `\r\n\x1b[36m$ ${command}\x1b[0m\r\n`)
  const result = await s.exec(track ? wrapWithCwd(command, opts.cwd ?? null) : command)
  let output = result.output
  let cwd: string | null = opts.cwd ?? null
  if (track) {
    const split = splitCwdMarker(output)
    output = split.output
    cwd = split.cwd ?? cwd
  }
  emitData(id, output.replace(/\n/g, '\r\n'))
  const preview = output.slice(0, 2000)
  recordCommand(id, command, source, preview, result.exitCode)
  return { output, exitCode: result.exitCode, cwd }
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

/**
 * เหมือน runInTerminal แต่รอเก็บ output ที่ตามมาด้วย — ให้ AI อ่านผลแล้วทำขั้นต่อไปได้
 * ถือว่าจบเมื่อ output เงียบไป idleMs (หรือครบ maxMs) — คำสั่งยาว/รอ input จะได้ผลเท่าที่มี
 */
export function runInTerminalCapture(
  id: string,
  command: string,
  opts: { idleMs?: number; maxMs?: number; signal?: AbortSignal } = {}
): Promise<{ output: string; settled: boolean }> {
  const idleMs = opts.idleMs ?? 2000
  const maxMs = opts.maxMs ?? 30000
  const s = sessions.get(id)
  if (!s) throw new Error('Session not found or not active')
  return new Promise((resolve) => {
    let buf = ''
    let idleTimer: ReturnType<typeof setTimeout> | null = null
    const set = taps.get(id) ?? new Set()
    taps.set(id, set)
    const finish = (settled: boolean): void => {
      if (idleTimer) clearTimeout(idleTimer)
      clearTimeout(maxTimer)
      set.delete(onData)
      opts.signal?.removeEventListener('abort', onAbort)
      resolve({ output: buf, settled })
    }
    const armIdle = (): void => {
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => finish(true), idleMs)
    }
    const onData = (d: string): void => {
      buf += d
      if (buf.length > 512 * 1024) buf = buf.slice(-256 * 1024)
      armIdle()
    }
    const onAbort = (): void => finish(false)
    const maxTimer = setTimeout(() => finish(false), maxMs)
    opts.signal?.addEventListener('abort', onAbort)
    set.add(onData)
    s.write(command + '\n')
    recordCommand(id, command, 'ai', null, null)
    armIdle()
  })
}

/** สภาพ terminal ตอนนี้ (cwd จริงถ้าหาได้ + output ล่าสุดแบบข้อความล้วน) — ใส่เป็น context ให้ AI */
export async function terminalContext(
  id: string,
  maxLines = 40
): Promise<{ cwd: string | null; recentOutput: string }> {
  const s = sessions.get(id)
  const cwd = s?.getCwd ? await s.getCwd().catch(() => null) : null
  const raw = terminalText(meta.get(id)?.scrollback.slice(-64 * 1024) ?? '')
  return { cwd, recentOutput: tailLines(raw.trimEnd(), maxLines) }
}

/** แปลง output ดิบของ terminal เป็นข้อความล้วน — ตัดโค้ดสี และเก็บแค่ส่วนท้ายของบรรทัดที่ถูก \r เขียนทับ (progress bar) */
export function terminalText(raw: string): string {
  return stripAnsi(raw)
    .split('\n')
    .map((l) => {
      let t = l.replace(/\r+$/, '')
      t = t.slice(t.lastIndexOf('\r') + 1)
      // backspace (line editor ของ zsh ลบ/พิมพ์ทับ) — ลบตัวก่อนหน้าทิ้ง
      // eslint-disable-next-line no-control-regex
      while (t.includes('\x08')) t = t.replace(/[^\x08]?\x08/, '')
      return t
    })
    .join('\n')
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
