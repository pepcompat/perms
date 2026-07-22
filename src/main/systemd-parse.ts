// แปลงผลลัพธ์ systemctl/journalctl เป็นโครงสร้างข้อมูล — แยกออกมาให้เทสได้
// (ตัวเรียกคำสั่งจริงอยู่ที่ systemd.ts)

import type { SystemdUnit, JournalLine } from '@shared/types'

export type { SystemdUnit, JournalLine }

/** ชื่อ unit ที่ยอมรับ — กันคำสั่งแปลกปลอมถูกยัดผ่านชื่อ unit */
const UNIT_RE = /^[A-Za-z0-9_.@:\\-]{1,128}$/

export function isValidUnitName(name: string): boolean {
  if (!UNIT_RE.test(name)) return false
  // ต้องลงท้ายด้วยชนิดที่รองรับ กัน path/ตัวแปรหลุดเข้ามา
  return /\.(service|socket|timer|target|mount|path)$/.test(name)
}

/**
 * แปลงผลของ `systemctl list-units --type=service --all --no-pager --plain`
 * รูปแบบ: UNIT LOAD ACTIVE SUB DESCRIPTION (คั่นด้วยช่องว่างหลายตัว)
 * unit ที่ทำงานผิดพลาดจะมี ● หรือ * นำหน้า — ตัดทิ้ง
 */
export function parseSystemdUnits(output: string): SystemdUnit[] {
  const units: SystemdUnit[] = []
  for (const raw of output.split('\n')) {
    const line = raw.replace(/^[\s●*✔✖x]+/u, '').trimEnd()
    if (!line.trim()) continue

    const parts = line.trim().split(/\s+/)
    if (parts.length < 4) continue

    const [unit, load, active, sub] = parts
    // ข้ามหัวตาราง / บรรทัดสรุปท้าย
    if (unit.toUpperCase() === 'UNIT' || load.toUpperCase() === 'LOAD') continue
    if (!unit.includes('.')) continue
    if (!/^(loaded|not-found|bad-setting|error|masked)$/i.test(load)) continue

    units.push({
      unit,
      load,
      active,
      sub,
      description: parts.slice(4).join(' ')
    })
  }
  return units
}

/**
 * แปลงบรรทัด journalctl แบบ short (ค่าเริ่มต้น)
 * `Jul 23 08:12:01 web-01 nginx[1234]: started`
 * บรรทัดที่ไม่เข้ารูปแบบ (เช่น "-- Logs begin at --") จะคืน message ล้วน
 */
export function parseJournal(output: string): JournalLine[] {
  const re = /^(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+([^:]+):\s?(.*)$/
  const out: JournalLine[] = []
  for (const line of output.split('\n')) {
    if (!line.trim()) continue
    const m = re.exec(line)
    if (m) {
      out.push({ time: m[1], host: m[2], source: m[3], message: m[4] })
    } else {
      out.push({ time: '', host: '', source: '', message: line })
    }
  }
  return out
}
