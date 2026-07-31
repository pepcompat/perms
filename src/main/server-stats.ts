import type { ServerStats } from '@shared/types'
import { execSilent } from './terminal/session-manager'

// อ่าน CPU/RAM/Network ของเซิร์ฟเวอร์ Linux จาก /proc (ไม่ต้องลง agent)
// ดึงทั้ง 3 อย่างในคำสั่งเดียว แล้ว parse + คิด delta เทียบ sample ก่อนหน้าใน main

// คำสั่ง: dump /proc/stat, /proc/meminfo, /proc/net/dev + df ของ / คั่นด้วย marker
const CMD =
  "cat /proc/stat; echo '@@PERMS@@'; cat /proc/meminfo; echo '@@PERMS@@'; cat /proc/net/dev; echo '@@PERMS@@'; df -kP / 2>/dev/null"

export interface RawStats {
  /** ผลรวม jiffies ทุก field ของ cpu รวม */
  cpuTotal: number
  /** idle + iowait */
  cpuIdle: number
  memTotalKb: number
  memAvailableKb: number
  /** ผลรวม rx/tx ทุก interface (ไม่รวม lo) หน่วยไบต์ */
  rxBytes: number
  txBytes: number
  /** ความจุดิสก์ราก / (kB) — undefined ถ้าอ่าน df ไม่ได้ */
  diskTotalKb?: number
  diskUsedKb?: number
}

/** parse ผลลัพธ์ของ CMD — คืน null ถ้าไม่ใช่ Linux/ไม่มี /proc */
export function parseProcStats(output: string): RawStats | null {
  const [statPart, memPart, netPart, diskPart] = output.split('@@PERMS@@')
  if (!statPart || !memPart || !netPart) return null

  // /proc/stat: บรรทัด "cpu  user nice system idle iowait irq softirq steal ..."
  const cpuLine = statPart.split('\n').find((l) => /^cpu\s/.test(l))
  if (!cpuLine) return null
  const nums = cpuLine.trim().split(/\s+/).slice(1).map(Number)
  if (nums.length < 5 || nums.some((n) => Number.isNaN(n))) return null
  const cpuTotal = nums.reduce((a, b) => a + b, 0)
  const cpuIdle = (nums[3] ?? 0) + (nums[4] ?? 0) // idle + iowait

  // /proc/meminfo: MemTotal / MemAvailable (kB)
  const memTotalKb = readMeminfo(memPart, 'MemTotal')
  const memAvailableKb = readMeminfo(memPart, 'MemAvailable')
  if (memTotalKb <= 0) return null

  // /proc/net/dev: "iface: rxbytes ... txbytes ..." (field 1 = rx, field 9 = tx)
  let rxBytes = 0
  let txBytes = 0
  for (const line of netPart.split('\n')) {
    const m = /^\s*([\w.-]+):\s*(.+)$/.exec(line)
    if (!m) continue
    if (m[1] === 'lo') continue // ข้าม loopback
    const f = m[2].trim().split(/\s+/).map(Number)
    if (f.length >= 9) {
      rxBytes += f[0] || 0
      txBytes += f[8] || 0
    }
  }

  // df -kP /: บรรทัดข้อมูล = "fs  1024-blocks  used  available  capacity  mount"
  // อ่าน df ไม่ได้ก็ข้าม (ปล่อย disk เป็น undefined) ไม่ให้ทั้งชุดพัง
  let diskTotalKb: number | undefined
  let diskUsedKb: number | undefined
  if (diskPart) {
    for (const line of diskPart.trim().split('\n')) {
      if (/^Filesystem/i.test(line)) continue
      const f = line.trim().split(/\s+/)
      // ต้องมี blocks/used เป็นตัวเลข (รองรับกรณี fs name ยาวจน df ขึ้นบรรทัดใหม่ → มี 5 คอลัมน์)
      const nums = f.filter((x) => /^\d+$/.test(x)).map(Number)
      if (nums.length >= 2) {
        diskTotalKb = nums[0]
        diskUsedKb = nums[1]
        break
      }
    }
  }

  return { cpuTotal, cpuIdle, memTotalKb, memAvailableKb, rxBytes, txBytes, diskTotalKb, diskUsedKb }
}

function readMeminfo(text: string, key: string): number {
  const m = new RegExp(`^${key}:\\s*(\\d+)`, 'm').exec(text)
  return m ? Number(m[1]) : 0
}

/**
 * คิด stats จาก raw ปัจจุบัน + ก่อนหน้า
 * CPU% และ network rate ต้องมี sample ก่อนหน้า (ครั้งแรกจะเป็น null)
 */
export function computeStats(
  cur: RawStats,
  prev: { raw: RawStats; at: number } | null,
  now: number
): ServerStats {
  const memUsedKb = cur.memTotalKb - cur.memAvailableKb
  const hasDisk = !!cur.diskTotalKb && cur.diskTotalKb > 0
  const stats: ServerStats = {
    cpuPercent: null,
    memPercent: Math.round((memUsedKb / cur.memTotalKb) * 100),
    memUsedBytes: memUsedKb * 1024,
    memTotalBytes: cur.memTotalKb * 1024,
    diskPercent: hasDisk ? Math.round(((cur.diskUsedKb ?? 0) / cur.diskTotalKb!) * 100) : null,
    diskUsedBytes: hasDisk ? (cur.diskUsedKb ?? 0) * 1024 : null,
    diskTotalBytes: hasDisk ? cur.diskTotalKb! * 1024 : null,
    rxPerSec: null,
    txPerSec: null
  }
  if (prev) {
    const totalDelta = cur.cpuTotal - prev.raw.cpuTotal
    const idleDelta = cur.cpuIdle - prev.raw.cpuIdle
    if (totalDelta > 0) {
      stats.cpuPercent = Math.max(0, Math.min(100, Math.round((1 - idleDelta / totalDelta) * 100)))
    }
    const dt = (now - prev.at) / 1000
    if (dt > 0) {
      stats.rxPerSec = Math.max(0, Math.round((cur.rxBytes - prev.raw.rxBytes) / dt))
      stats.txPerSec = Math.max(0, Math.round((cur.txBytes - prev.raw.txBytes) / dt))
    }
  }
  return stats
}

const lastBySession = new Map<string, { raw: RawStats; at: number }>()

/** เก็บ 1 sample แล้วคืน stats (คิด delta กับครั้งก่อน) — คืน null ถ้าอ่านไม่ได้ */
export async function sampleServerStats(sessionId: string): Promise<ServerStats | null> {
  const r = await execSilent(sessionId, CMD).catch(() => null)
  if (!r || r.exitCode !== 0) return null
  const raw = parseProcStats(r.output)
  if (!raw) return null
  const now = Date.now()
  const prev = lastBySession.get(sessionId) ?? null
  lastBySession.set(sessionId, { raw, at: now })
  return computeStats(raw, prev, now)
}

/** ล้าง sample ที่เก็บไว้ตอน session ปิด */
export function clearServerStats(sessionId: string): void {
  lastBySession.delete(sessionId)
}
