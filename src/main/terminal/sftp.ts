import type { SFTPWrapper, FileEntryWithStats } from 'ssh2'
import { posix } from 'path'
import type { SftpEntry } from '@shared/types'
import { getSessionHandle } from './session-manager'
import { SshSession } from './ssh-session'

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
