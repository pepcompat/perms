import type { SystemdUnit, JournalLine } from '@shared/types'
import { shQuote } from '@shared/shell-quote'
import { execSilent } from './terminal/session-manager'
import { parseSystemdUnits, parseJournal, isValidUnitName } from './systemd-parse'

export type SystemdAction = 'start' | 'stop' | 'restart' | 'reload' | 'enable' | 'disable'

/** action ที่เปลี่ยนสถานะจริง — ให้ฝั่งเรียกตัดสินใจว่าต้องขอยืนยันไหม */
export const SYSTEMD_MUTATING: ReadonlySet<string> = new Set([
  'start',
  'stop',
  'restart',
  'reload',
  'enable',
  'disable'
])

function needsPrivilege(output: string): boolean {
  return /access denied|permission denied|authentication is required|interactive authentication/i.test(
    output
  )
}

/**
 * รันคำสั่ง systemctl — ลองแบบธรรมดาก่อน ถ้าติดสิทธิ์ค่อยลอง sudo -n
 * (-n = ไม่ถามรหัสผ่าน ถ้าต้องถามให้ล้มไปเลย ดีกว่าค้างรอ input ที่ไม่มีใครกรอก)
 */
async function run(sessionId: string, args: string): Promise<{ ok: boolean; output: string }> {
  const first = await execSilent(sessionId, `systemctl ${args} 2>&1`)
  if (first.exitCode === 0) return { ok: true, output: first.output }
  if (!needsPrivilege(first.output)) return { ok: false, output: first.output }

  const sudo = await execSilent(sessionId, `sudo -n systemctl ${args} 2>&1`)
  return { ok: sudo.exitCode === 0, output: sudo.output || first.output }
}

/** รายการ service ทั้งหมด (รวมที่ไม่ได้รันอยู่) */
export async function systemdList(sessionId: string): Promise<SystemdUnit[]> {
  const r = await execSilent(
    sessionId,
    'systemctl list-units --type=service --all --no-pager --plain --no-legend 2>/dev/null'
  )
  if (r.exitCode !== 0) return []
  return parseSystemdUnits(r.output)
}

/** เครื่องปลายทางใช้ systemd ไหม — ใช้ตัดสินว่าจะโชว์ปุ่มหรือเปล่า */
export async function hasSystemd(sessionId: string): Promise<boolean> {
  const r = await execSilent(sessionId, 'command -v systemctl >/dev/null 2>&1 && echo yes')
  return r.output.trim() === 'yes'
}

export async function systemdAction(
  sessionId: string,
  unit: string,
  action: SystemdAction
): Promise<{ ok: boolean; output: string }> {
  // ชื่อ unit ถูกเอาไปต่อเป็นคำสั่ง shell — ตรวจให้แน่ใจว่าไม่มีอะไรแปลกปลอม
  if (!isValidUnitName(unit)) throw new Error(`ชื่อ service ไม่ถูกต้อง: ${unit}`)
  if (!SYSTEMD_MUTATING.has(action)) throw new Error(`คำสั่งไม่รองรับ: ${action}`)
  return run(sessionId, `${action} ${shQuote(unit)}`)
}

export async function systemdStatus(sessionId: string, unit: string): Promise<string> {
  if (!isValidUnitName(unit)) throw new Error(`ชื่อ service ไม่ถูกต้อง: ${unit}`)
  const r = await execSilent(sessionId, `systemctl status ${shQuote(unit)} --no-pager -l 2>&1`)
  return r.output
}

/** log ของ service จาก journalctl */
export async function journalLogs(
  sessionId: string,
  unit: string,
  lines = 200
): Promise<JournalLine[]> {
  if (!isValidUnitName(unit)) throw new Error(`ชื่อ service ไม่ถูกต้อง: ${unit}`)
  const n = Math.min(2000, Math.max(10, Math.floor(lines) || 200))
  const cmd = `journalctl -u ${shQuote(unit)} -n ${n} --no-pager 2>&1`
  const r = await execSilent(sessionId, cmd)
  if (r.exitCode !== 0 && needsPrivilege(r.output)) {
    const sudo = await execSilent(sessionId, `sudo -n ${cmd}`)
    return parseJournal(sudo.output)
  }
  return parseJournal(r.output)
}
