import { readdirSync, readFileSync, statSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { dialog, BrowserWindow } from 'electron'

const SKIP = new Set([
  'known_hosts',
  'known_hosts.old',
  'config',
  'authorized_keys',
  'environment',
  'agent.sock'
])

/** ย่อ path ที่อยู่ใต้ home เป็น ~ ให้อ่านง่าย (expandHome ฝั่ง connect รองรับ ~) */
function toTilde(full: string): string {
  const h = homedir()
  return full.startsWith(h + '/') ? '~' + full.slice(h.length) : full
}

/** สแกน ~/.ssh หา private key (มีไฟล์ .pub คู่ หรือเนื้อหาเป็น PRIVATE KEY) */
export function listPrivateKeys(): string[] {
  const dir = join(homedir(), '.ssh')
  if (!existsSync(dir)) return []
  const out: string[] = []
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  for (const name of names) {
    if (name.endsWith('.pub') || name.startsWith('.') || SKIP.has(name)) continue
    const full = join(dir, name)
    try {
      if (!statSync(full).isFile()) continue
      let isKey = existsSync(full + '.pub')
      if (!isKey) {
        const head = readFileSync(full, 'utf8').slice(0, 60)
        isKey = head.includes('PRIVATE KEY')
      }
      if (isKey) out.push(toTilde(full))
    } catch {
      /* ข้ามไฟล์ที่อ่านไม่ได้ */
    }
  }
  return out.sort()
}

/** เปิด native dialog ให้เลือกไฟล์ private key เอง */
export async function pickKeyFile(): Promise<string | null> {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const res = await dialog.showOpenDialog(win, {
    title: 'เลือก private key',
    defaultPath: join(homedir(), '.ssh'),
    properties: ['openFile', 'showHiddenFiles', 'treatPackageAsDirectory']
  })
  if (res.canceled || !res.filePaths[0]) return null
  return toTilde(res.filePaths[0])
}
