// แปลงสถานะ systemd เป็นโทนสีสำหรับ UI — อยู่ใน shared เพราะทั้ง main และ renderer ใช้

export type UnitTone = 'ok' | 'warn' | 'error' | 'idle'

export function unitTone(u: { active: string; sub: string }): UnitTone {
  const a = u.active.toLowerCase()
  const s = u.sub.toLowerCase()
  if (a === 'failed' || s === 'failed') return 'error'
  if (a === 'active' && s === 'running') return 'ok'
  if (a === 'activating' || a === 'deactivating' || s === 'auto-restart') return 'warn'
  if (a === 'active' && s === 'exited') return 'idle'
  return 'idle'
}
