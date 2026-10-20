// ให้ AI ใช้ cd ข้ามหลายคำสั่งได้ — exec แต่ละครั้งเป็น shell ใหม่ ปกติสถานะ cd จะหาย
// วิธี: ห่อคำสั่งให้เริ่มที่ cwd ที่จำไว้ แล้วพิมพ์ cwd สุดท้ายต่อท้าย output (marker) ให้แกะกลับมา
import { shQuote } from './shell-quote'

const CWD_MARK = '__PERMS_CWD__'

/** ห่อคำสั่ง (POSIX shell) — cwd null = home · exit code เดิมของคำสั่งยังอยู่ */
export function wrapWithCwd(command: string, cwd: string | null): string {
  const enter = cwd ? `cd -- ${shQuote(cwd)} 2>/dev/null || cd` : 'cd'
  return `${enter}\n${command}\n__perms_rc=$?\nprintf '\\n%s%s\\n' '${CWD_MARK}' "$(pwd)"\nexit $__perms_rc`
}

/** แกะ marker ออกจาก output → { output เดิม, cwd หลังรัน (null = ไม่เจอ marker เช่นคำสั่ง exit เอง) } */
export function splitCwdMarker(output: string): { output: string; cwd: string | null } {
  const at = output.lastIndexOf(CWD_MARK)
  if (at === -1) return { output, cwd: null }
  return {
    output: output.slice(0, at).replace(/\n$/, ''),
    cwd: output.slice(at + CWD_MARK.length).trim() || null
  }
}
