import { createHash } from 'crypto'
import { createReadStream, createWriteStream, existsSync, statSync, unlinkSync } from 'fs'
import { basename } from 'path'
import { nanoid } from 'nanoid'
import { BrowserWindow } from 'electron'
import type { SFTPWrapper, Stats } from 'ssh2'
import { IPC } from '@shared/ipc-channels'
import { shQuote } from '@shared/shell-quote'
import {
  retryDelayMs,
  shouldRetry,
  nextQueued,
  resumeOffset,
  type TransferItem,
  type TransferKind
} from '@shared/transfer-queue'
import { getSessionHandle, execSilent } from './session-manager'
import { SshSession } from './ssh-session'

const items = new Map<string, TransferItem>()
/** ยกเลิกงานที่กำลังวิ่ง — เก็บฟังก์ชันปิด stream ไว้ */
const aborters = new Map<string, () => void>()
let pumping = false

function broadcast(): void {
  const list = [...items.values()]
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.transferUpdate, list)
  }
}

export function listTransfers(): TransferItem[] {
  return [...items.values()]
}

async function sftpOf(sessionId: string): Promise<SFTPWrapper> {
  const s = getSessionHandle(sessionId)
  if (!(s instanceof SshSession)) throw new Error('ต้องเป็น session แบบ SSH เท่านั้น')
  return s.getSftp()
}

function statRemote(sftp: SFTPWrapper, path: string): Promise<Stats> {
  return new Promise((resolve, reject) => sftp.stat(path, (e, s) => (e ? reject(e) : resolve(s))))
}

/** sha256 ของไฟล์ในเครื่อง (อ่านเป็น stream กันไฟล์ใหญ่กินแรม) */
function localSha256(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256')
    createReadStream(path)
      .on('data', (d) => h.update(d))
      .on('error', reject)
      .on('end', () => resolve(h.digest('hex')))
  })
}

/**
 * sha256 ของไฟล์บนเซิร์ฟเวอร์ — ลอง sha256sum ก่อน ไม่มีค่อยใช้ shasum
 * คืน null ถ้าเครื่องปลายทางไม่มีทั้งคู่ (จะข้ามการตรวจ ไม่ถือว่าโอนพลาด)
 */
async function remoteSha256(sessionId: string, path: string): Promise<string | null> {
  const q = shQuote(path)
  for (const cmd of [`sha256sum ${q}`, `shasum -a 256 ${q}`]) {
    const r = await execSilent(sessionId, cmd).catch(() => null)
    if (r && r.exitCode === 0) {
      const hash = r.output.trim().split(/\s+/)[0]
      if (/^[a-f0-9]{64}$/i.test(hash)) return hash.toLowerCase()
    }
  }
  return null
}

export async function enqueue(input: {
  sessionId: string
  kind: TransferKind
  remotePath: string
  localPath: string
}): Promise<TransferItem> {
  let size = 0
  if (input.kind === 'upload') {
    size = existsSync(input.localPath) ? statSync(input.localPath).size : 0
  } else {
    const sftp = await sftpOf(input.sessionId)
    size = (await statRemote(sftp, input.remotePath)).size ?? 0
  }

  const item: TransferItem = {
    id: nanoid(),
    kind: input.kind,
    sessionId: input.sessionId,
    remotePath: input.remotePath,
    localPath: input.localPath,
    name: basename(input.kind === 'upload' ? input.localPath : input.remotePath),
    size,
    transferred: 0,
    status: 'queued',
    attempts: 0
  }
  items.set(item.id, item)
  broadcast()
  void pump()
  return item
}

export function cancelTransfer(id: string): void {
  const it = items.get(id)
  if (!it) return
  aborters.get(id)?.()
  aborters.delete(id)
  it.status = 'canceled'
  broadcast()
  void pump()
}

export function retryTransfer(id: string): void {
  const it = items.get(id)
  if (!it || it.status === 'running') return
  it.status = 'queued'
  it.error = undefined
  broadcast()
  void pump()
}

export function clearFinished(): void {
  for (const [id, it] of items) {
    if (it.status === 'done' || it.status === 'canceled') items.delete(id)
  }
  broadcast()
}

/** ทำทีละงาน — โอนพร้อมกันหลายไฟล์บน connection เดียวมีแต่จะช้าลง */
async function pump(): Promise<void> {
  if (pumping) return
  const next = nextQueued([...items.values()])
  if (!next) return

  pumping = true
  next.status = 'running'
  next.attempts++
  broadcast()

  try {
    await runTransfer(next)
    next.status = 'done'
    next.transferred = next.size
    next.error = undefined
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (items.get(next.id)?.status === 'canceled') {
      // ผู้ใช้กดยกเลิกเอง ไม่ใช่ error
    } else {
      next.error = msg
      next.status = 'failed'
      if (shouldRetry(next)) {
        const delay = retryDelayMs(next.attempts)
        next.status = 'queued'
        setTimeout(() => void pump(), delay).unref?.()
      }
    }
  } finally {
    aborters.delete(next.id)
    pumping = false
    broadcast()
    // งานถัดไป (ถ้าไม่ได้ตั้ง timer รอ retry ไว้)
    if (nextQueued([...items.values()])) void pump()
  }
}

async function runTransfer(item: TransferItem): Promise<void> {
  const sftp = await sftpOf(item.sessionId)
  const canceled = (): boolean => items.get(item.id)?.status === 'canceled'

  if (item.kind === 'download') {
    const remoteSize = (await statRemote(sftp, item.remotePath)).size ?? 0
    item.size = remoteSize
    const existing = existsSync(item.localPath) ? statSync(item.localPath).size : 0
    const offset = resumeOffset(existing, remoteSize)

    // เริ่มใหม่ทั้งไฟล์ → ทิ้งของค้างก่อน กันเนื้อหาปนกัน
    if (offset === 0 && existing > 0) unlinkSync(item.localPath)

    await new Promise<void>((resolve, reject) => {
      const rs = sftp.createReadStream(item.remotePath, { start: offset })
      const ws = createWriteStream(item.localPath, { flags: offset > 0 ? 'a' : 'w' })
      let got = offset
      aborters.set(item.id, () => {
        rs.destroy()
        ws.destroy()
      })
      rs.on('data', (c: Buffer) => {
        got += c.length
        item.transferred = got
        if (canceled()) rs.destroy()
      })
      rs.on('error', reject)
      ws.on('error', reject)
      ws.on('finish', () => (canceled() ? reject(new Error('canceled')) : resolve()))
      rs.pipe(ws)
    })

    const remote = await remoteSha256(item.sessionId, item.remotePath)
    if (remote) {
      const local = await localSha256(item.localPath)
      item.checksum = local
      item.verified = local === remote ? 'ok' : 'mismatch'
      if (item.verified === 'mismatch') {
        // ไฟล์ที่ได้ไม่ตรงต้นทาง — ทิ้งแล้วให้ลองใหม่ตั้งแต่ต้น ดีกว่าเก็บไฟล์พังไว้
        try {
          unlinkSync(item.localPath)
        } catch {
          /* ลบไม่ได้ก็ปล่อย */
        }
        throw new Error('checksum ไม่ตรงกับต้นทาง — ไฟล์อาจเสียหายระหว่างโอน')
      }
    } else {
      item.verified = 'skipped'
    }
    return
  }

  // upload
  const localSize = statSync(item.localPath).size
  item.size = localSize
  const remoteExisting = await statRemote(sftp, item.remotePath).catch(() => null)
  const offset = resumeOffset(remoteExisting?.size ?? 0, localSize)

  await new Promise<void>((resolve, reject) => {
    const rs = createReadStream(item.localPath, { start: offset })
    const ws = sftp.createWriteStream(item.remotePath, { flags: offset > 0 ? 'a' : 'w' })
    let sent = offset
    aborters.set(item.id, () => {
      rs.destroy()
      ws.destroy()
    })
    rs.on('data', (c: string | Buffer) => {
      sent += typeof c === 'string' ? Buffer.byteLength(c) : c.length
      item.transferred = sent
      if (canceled()) rs.destroy()
    })
    rs.on('error', reject)
    ws.on('error', reject)
    ws.on('close', () => (canceled() ? reject(new Error('canceled')) : resolve()))
    rs.pipe(ws)
  })

  const remote = await remoteSha256(item.sessionId, item.remotePath)
  if (remote) {
    const local = await localSha256(item.localPath)
    item.checksum = local
    item.verified = local === remote ? 'ok' : 'mismatch'
    if (item.verified === 'mismatch') {
      throw new Error('checksum ไม่ตรงกับต้นทาง — ไฟล์อาจเสียหายระหว่างโอน')
    }
  } else {
    item.verified = 'skipped'
  }
}
