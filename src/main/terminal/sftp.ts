import type { SFTPWrapper, FileEntryWithStats, Stats } from 'ssh2'
import { posix } from 'path'
import { nanoid } from 'nanoid'
import type { SftpEntry, SftpFileContent } from '@shared/types'
import { shQuote } from '@shared/shell-quote'
import { getSessionHandle, execSilent } from './session-manager'
import { SshSession } from './ssh-session'
import { getSession } from '../db/repos/sessions-repo'
import { addSnapshot } from '../db/repos/snapshots-repo'

const MAX_EDIT_BYTES = 2 * 1024 * 1024 // 2MB — กันเปิดไฟล์ใหญ่/log มหึมามาแก้เป็นข้อความ

async function sftpOf(id: string): Promise<SFTPWrapper> {
  const s = getSessionHandle(id)
  if (!(s instanceof SshSession)) {
    throw new Error('SFTP ใช้ได้เฉพาะ session แบบ SSH เท่านั้น')
  }
  return s.getSftp()
}

function realpath(sftp: SFTPWrapper, p: string): Promise<string> {
  return new Promise((resolve) => sftp.realpath(p || '.', (err, abs) => resolve(err ? p || '/' : abs)))
}

/** โฟลเดอร์เริ่มต้น (home) ของ session */
export async function sftpHome(id: string): Promise<string> {
  const sftp = await sftpOf(id)
  return realpath(sftp, '.')
}

/** list โฟลเดอร์ — คืน absolute path + รายการ (โฟลเดอร์ก่อน แล้วเรียงชื่อ) */
export async function sftpList(
  id: string,
  path: string
): Promise<{ path: string; entries: SftpEntry[] }> {
  const sftp = await sftpOf(id)
  const abs = await realpath(sftp, path)
  const list = await new Promise<FileEntryWithStats[]>((resolve, reject) => {
    sftp.readdir(abs, (err, l) => (err ? reject(err) : resolve(l)))
  })
  const entries: SftpEntry[] = list.map((f) => ({
    name: f.filename,
    type: f.attrs.isDirectory() ? 'dir' : f.attrs.isSymbolicLink() ? 'link' : 'file',
    size: f.attrs.size ?? 0,
    mtime: (f.attrs.mtime ?? 0) * 1000
  }))
  entries.sort((a, b) => {
    const ad = a.type === 'dir'
    const bd = b.type === 'dir'
    if (ad !== bd) return ad ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return { path: abs, entries }
}

export async function sftpMkdir(id: string, path: string): Promise<void> {
  const sftp = await sftpOf(id)
  await new Promise<void>((resolve, reject) => sftp.mkdir(path, (e) => (e ? reject(e) : resolve())))
}

export async function sftpDelete(id: string, path: string, isDir: boolean): Promise<void> {
  const sftp = await sftpOf(id)
  await new Promise<void>((resolve, reject) => {
    const cb = (e?: Error | null): void => (e ? reject(e) : resolve())
    if (isDir) sftp.rmdir(path, cb)
    else sftp.unlink(path, cb)
  })
}

export async function sftpRename(id: string, from: string, to: string): Promise<void> {
  const sftp = await sftpOf(id)
  await new Promise<void>((resolve, reject) => sftp.rename(from, to, (e) => (e ? reject(e) : resolve())))
}

type Progress = (transferred: number, total: number) => void

/** ดาวน์โหลด remote → local (streaming, มี progress) */
export async function sftpDownload(
  id: string,
  remotePath: string,
  localPath: string,
  onProgress: Progress
): Promise<void> {
  const sftp = await sftpOf(id)
  await new Promise<void>((resolve, reject) => {
    sftp.fastGet(
      remotePath,
      localPath,
      { step: (transferred, _chunk, total) => onProgress(transferred, total) },
      (err) => (err ? reject(err) : resolve())
    )
  })
}

/** อัปโหลด local → remote (streaming, มี progress) */
export async function sftpUpload(
  id: string,
  localPath: string,
  remotePath: string,
  onProgress: Progress
): Promise<void> {
  const sftp = await sftpOf(id)
  await new Promise<void>((resolve, reject) => {
    sftp.fastPut(
      localPath,
      remotePath,
      { step: (transferred, _chunk, total) => onProgress(transferred, total) },
      (err) => (err ? reject(err) : resolve())
    )
  })
}

/** ต่อ path แบบ posix (remote เป็น unix เสมอ) */
export function remoteJoin(dir: string, name: string): string {
  return posix.join(dir, name)
}

/** นามสกุลไฟล์บีบอัดที่แตกได้ */
export function archiveKind(name: string): 'zip' | 'tar.gz' | 'tar.bz2' | 'tar.xz' | 'tar' | 'gz' | null {
  const n = name.toLowerCase()
  if (n.endsWith('.zip')) return 'zip'
  if (n.endsWith('.tar.gz') || n.endsWith('.tgz')) return 'tar.gz'
  if (n.endsWith('.tar.bz2') || n.endsWith('.tbz2')) return 'tar.bz2'
  if (n.endsWith('.tar.xz') || n.endsWith('.txz')) return 'tar.xz'
  if (n.endsWith('.tar')) return 'tar'
  if (n.endsWith('.gz')) return 'gz'
  return null
}

/**
 * บีบอัดรายการใน dir → archive ที่ destDir/base.(zip|tar.gz)
 * ใช้ zip ก่อน ถ้าไม่มีบนเครื่องปลายทางจะ fallback เป็น tar.gz
 */
export async function sftpArchive(
  sessionId: string,
  dir: string,
  names: string[],
  destDir: string,
  base: string
): Promise<{ path: string; name: string }> {
  if (!names.length) throw new Error('ไม่ได้เลือกไฟล์')
  const items = names.map(shQuote).join(' ')
  const d = shQuote(dir)

  const zipName = `${base}.zip`
  const zipPath = posix.join(destDir, zipName)
  const zip = await execSilent(sessionId, `cd ${d} && zip -qr ${shQuote(zipPath)} ${items}`)
  if (zip.exitCode === 0) return { path: zipPath, name: zipName }

  const tarName = `${base}.tar.gz`
  const tarPath = posix.join(destDir, tarName)
  const tar = await execSilent(sessionId, `cd ${d} && tar -czf ${shQuote(tarPath)} ${items}`)
  if (tar.exitCode !== 0) {
    throw new Error(`บีบอัดไม่สำเร็จ: ${(zip.output + '\n' + tar.output).trim().slice(0, 300)}`)
  }
  return { path: tarPath, name: tarName }
}

/** แตกไฟล์บีบอัดในโฟลเดอร์เดียวกัน */
export async function sftpExtract(sessionId: string, dir: string, name: string): Promise<void> {
  const kind = archiveKind(name)
  if (!kind) throw new Error('ไม่รู้จักรูปแบบไฟล์บีบอัดนี้')
  const f = shQuote(name)
  const d = shQuote(dir)
  const cmd =
    kind === 'zip'
      ? `cd ${d} && unzip -o ${f}`
      : kind === 'gz'
        ? `cd ${d} && gunzip -kf ${f}`
        : `cd ${d} && tar -x${kind === 'tar.gz' ? 'z' : kind === 'tar.bz2' ? 'j' : kind === 'tar.xz' ? 'J' : ''}f ${f}`
  const r = await execSilent(sessionId, cmd)
  if (r.exitCode !== 0) throw new Error(`แตกไฟล์ไม่สำเร็จ: ${r.output.trim().slice(0, 300)}`)
}

/** ลบไฟล์บน remote (ใช้เก็บกวาด archive ชั่วคราว) */
export async function sftpRemoveRemote(sessionId: string, path: string): Promise<void> {
  await execSilent(sessionId, `rm -f ${shQuote(path)}`)
}

function statP(sftp: SFTPWrapper, path: string): Promise<Stats> {
  return new Promise((resolve, reject) => sftp.stat(path, (e, s) => (e ? reject(e) : resolve(s))))
}

/** อ่านไฟล์มาแก้ — กันไฟล์ใหญ่เกิน + ไฟล์ไบนารี, คืนสิทธิ์+mtime เดิมไว้ */
export async function sftpReadFile(id: string, path: string): Promise<SftpFileContent> {
  const sftp = await sftpOf(id)
  const st = await statP(sftp, path)
  if (!st.isFile()) throw new Error('ไม่ใช่ไฟล์ปกติ เปิดแก้ไม่ได้')
  if ((st.size ?? 0) > MAX_EDIT_BYTES) throw new Error('ไฟล์ใหญ่เกิน 2MB — เปิดแก้ในตัวไม่ได้')
  const buf = await new Promise<Buffer>((resolve, reject) =>
    sftp.readFile(path, (e, d) => (e ? reject(e) : resolve(d as Buffer)))
  )
  if (buf.includes(0)) throw new Error('ไฟล์นี้เป็นไบนารี — แก้เป็นข้อความไม่ได้')
  return {
    content: buf.toString('utf8'),
    mode: (st.mode ?? 0o644) & 0o7777,
    mtime: (st.mtime ?? 0) * 1000,
    size: st.size ?? 0
  }
}

// แทนที่ target ด้วย tmp แบบ atomic: ใช้ posix-rename ext (OpenSSH) ถ้ามี ไม่งั้น unlink+rename
function atomicReplace(sftp: SFTPWrapper, tmp: string, target: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const fallback = (): void =>
      sftp.unlink(target, () => sftp.rename(tmp, target, (e) => (e ? reject(e) : resolve())))
    const ext = (
      sftp as unknown as {
        ext_openssh_rename?: (o: string, n: string, cb: (e?: Error | null) => void) => void
      }
    ).ext_openssh_rename
    if (typeof ext === 'function') {
      ext.call(sftp, tmp, target, (e) => (e ? fallback() : resolve()))
    } else {
      fallback()
    }
  })
}

/**
 * เขียนไฟล์แบบปลอดภัย: เขียนลงไฟล์ชั่วคราวก่อน (คงสิทธิ์เดิม) แล้ว atomic-rename ทับ
 * — ถ้าเน็ตหลุดกลางคัน ไฟล์เดิมไม่พัง. เช็ค mtime กันเขียนทับการแก้จากที่อื่น
 */
export async function sftpWriteFile(
  id: string,
  path: string,
  content: string,
  mode: number,
  expectedMtime: number | null
): Promise<{ mtime: number }> {
  const sftp = await sftpOf(id)
  if (expectedMtime != null) {
    const cur = await statP(sftp, path).catch(() => null)
    if (cur && (cur.mtime ?? 0) * 1000 - expectedMtime > 1500) throw new Error('EXTERNAL_CHANGED')
  }

  // เก็บสำเนาของเดิมไว้ก่อนทับ — พลาดแล้วย้อนกลับได้
  // ถ้าอ่านของเดิมไม่ได้ (ไฟล์ใหม่/สิทธิ์ไม่พอ) ก็ข้ามไป ไม่ควรทำให้บันทึกไม่ได้
  try {
    const before = await new Promise<Buffer>((resolve, reject) =>
      sftp.readFile(path, (e, d) => (e ? reject(e) : resolve(d as Buffer)))
    )
    if (!before.includes(0)) {
      addSnapshot({
        serverId: getSession(id)?.serverId ?? null,
        path,
        content: before.toString('utf8'),
        mode: mode || null,
        reason: 'save'
      })
    }
  } catch {
    /* ไม่มีของเดิมให้เก็บ */
  }

  const tmp = `${path}.perms~${nanoid(6)}`
  const data = Buffer.from(content, 'utf8')
  await new Promise<void>((resolve, reject) =>
    sftp.writeFile(tmp, data, { mode: mode || 0o644 }, (e) => (e ? reject(e) : resolve()))
  )
  await atomicReplace(sftp, tmp, path)
  const after = await statP(sftp, path).catch(() => null)
  return { mtime: after ? (after.mtime ?? 0) * 1000 : expectedMtime ?? 0 }
}
