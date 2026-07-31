import { describe, it, expect } from 'vitest'
import { parseProcStats, computeStats, parseProcessList } from './server-stats'

const sample = (
  cpu: number[],
  memTotal: number,
  memAvail: number,
  rx: number,
  tx: number,
  disk?: { total: number; used: number }
): string =>
  [
    `cpu  ${cpu.join(' ')}\ncpu0 1 2 3 4 5 6 7`,
    `MemTotal:       ${memTotal} kB\nMemFree: 100 kB\nMemAvailable:   ${memAvail} kB`,
    `Inter-|   Receive\n face |bytes\n    lo: 999 0 0 0 0 0 0 0 999 0\n  eth0: ${rx} 0 0 0 0 0 0 0 ${tx} 0`,
    disk
      ? `Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/sda1 ${disk.total} ${disk.used} 1 22% /`
      : ''
  ].join('@@PERMS@@')

describe('parseProcStats', () => {
  it('อ่าน cpu/mem/net ได้ครบ และข้าม lo', () => {
    const r = parseProcStats(sample([100, 0, 50, 800, 50, 0, 0, 0], 8_000_000, 2_000_000, 1234, 5678))
    expect(r).not.toBeNull()
    expect(r!.cpuTotal).toBe(1000) // 100+0+50+800+50
    expect(r!.cpuIdle).toBe(850) // idle 800 + iowait 50
    expect(r!.memTotalKb).toBe(8_000_000)
    expect(r!.memAvailableKb).toBe(2_000_000)
    expect(r!.rxBytes).toBe(1234) // เฉพาะ eth0 (lo ถูกข้าม)
    expect(r!.txBytes).toBe(5678)
  })

  it('อ่าน df ของราก / ได้ (ความจุ ใช้/ทั้งหมด)', () => {
    const r = parseProcStats(
      sample([100, 0, 50, 800, 50, 0, 0, 0], 8_000_000, 2_000_000, 0, 0, {
        total: 41_152_736,
        used: 8_234_567
      })
    )
    expect(r!.diskTotalKb).toBe(41_152_736)
    expect(r!.diskUsedKb).toBe(8_234_567)
  })

  it('ไม่มี df section → disk เป็น undefined แต่ที่เหลือยังอ่านได้', () => {
    const r = parseProcStats(sample([100, 0, 50, 800, 50, 0, 0, 0], 8_000_000, 2_000_000, 0, 0))
    expect(r).not.toBeNull()
    expect(r!.diskTotalKb).toBeUndefined()
  })

  it('ไม่ใช่ Linux / output ขยะ → null', () => {
    expect(parseProcStats('command not found')).toBeNull()
    expect(parseProcStats('')).toBeNull()
  })

  it('ไม่มี MemTotal → null', () => {
    expect(parseProcStats('cpu  1 2 3 4 5@@PERMS@@nothing@@PERMS@@x')).toBeNull()
  })
})

describe('parseProcessList', () => {
  const ps = `  PID %CPU %MEM   RSS COMMAND
 1234 25.0  4.5 512000 node
   42  3.2  1.0  65536 nginx
    1  0.0  0.1   8192 systemd`

  it('อ่าน pid/cpu/mem/rss/command และข้ามหัวตาราง', () => {
    const list = parseProcessList(ps)
    expect(list).toHaveLength(3)
    expect(list[0]).toEqual({ pid: 1234, cpu: 25, mem: 4.5, rssBytes: 512000 * 1024, command: 'node' })
    expect(list[1].command).toBe('nginx')
  })

  it('ว่าง/undefined → []', () => {
    expect(parseProcessList(undefined)).toEqual([])
    expect(parseProcessList('')).toEqual([])
  })

  it('command ที่มีช่องว่าง เก็บครบ', () => {
    const list = parseProcessList('  10  1.0  2.0 1000 my worker')
    expect(list[0].command).toBe('my worker')
  })
})

describe('computeStats', () => {
  const raw = parseProcStats(sample([100, 0, 50, 800, 50, 0, 0, 0], 8_000_000, 2_000_000, 1000, 500))!

  it('ครั้งแรก (ไม่มี prev) → cpu% และ net เป็น null แต่ mem คิดได้เลย', () => {
    const s = computeStats(raw, null, 1000)
    expect(s.cpuPercent).toBeNull()
    expect(s.rxPerSec).toBeNull()
    expect(s.memPercent).toBe(75) // used 6M / total 8M
    expect(s.memUsedBytes).toBe(6_000_000 * 1024)
  })

  it('disk: มีข้อมูล df → คิด % · ไม่มี → null', () => {
    const withDisk = parseProcStats(
      sample([100, 0, 50, 800, 50, 0, 0, 0], 8_000_000, 2_000_000, 0, 0, { total: 1000, used: 250 })
    )!
    const s = computeStats(withDisk, null, 1000)
    expect(s.diskPercent).toBe(25)
    expect(s.diskUsedBytes).toBe(250 * 1024)
    expect(s.diskTotalBytes).toBe(1000 * 1024)
    // ไม่มี df
    expect(computeStats(raw, null, 1000).diskPercent).toBeNull()
  })

  it('มี prev → คิด cpu% จาก delta idle/total', () => {
    // prev: total 900, idle 800 · cur: total 1000, idle 850
    const prevRaw = parseProcStats(sample([100, 0, 50, 750, 50, 0, 0, 0], 8_000_000, 2_000_000, 0, 0))!
    // prevRaw: total = 100+0+50+750+50 = 950, idle = 750+50 = 800
    const s = computeStats(raw, { raw: prevRaw, at: 0 }, 1000)
    // totalDelta = 1000-950 = 50, idleDelta = 850-800 = 50 → busy 0%
    expect(s.cpuPercent).toBe(0)
  })

  it('คิด network rate เป็นไบต์/วินาที', () => {
    const prevRaw = { ...raw, rxBytes: 0, txBytes: 0 }
    const s = computeStats(raw, { raw: prevRaw, at: 0 }, 2000) // dt = 2 วินาที
    expect(s.rxPerSec).toBe(500) // 1000 ไบต์ / 2 วิ
    expect(s.txPerSec).toBe(250)
  })

  it('CPU% ไม่หลุดกรอบ 0–100', () => {
    const s = computeStats(raw, { raw: { ...raw, cpuTotal: raw.cpuTotal - 10, cpuIdle: raw.cpuIdle }, at: 0 }, 1000)
    expect(s.cpuPercent).toBeGreaterThanOrEqual(0)
    expect(s.cpuPercent).toBeLessThanOrEqual(100)
  })
})
