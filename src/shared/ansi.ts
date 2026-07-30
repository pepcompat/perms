// ล้าง ANSI escape sequence ออกจากข้อความ — ใช้โชว์ log แบบข้อความล้วน
// (log ของ docker/nest มักมีโค้ดสี เช่น \x1b[32m ถ้าไม่ล้างจะเห็นเป็น [32m เต็มไปหมด)

// ครอบคลุม: CSI (สี/เคอร์เซอร์ ...[...m), OSC (...] ... BEL/ST), และ escape เดี่ยว ๆ
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g

export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '')
}

/**
 * ตัด buffer log ให้เหลือ N บรรทัดท้าย — กัน log ยาว ๆ กินแรมไม่จำกัด
 * (live stream ที่ไหลตลอดเวลาต้องมีเพดาน)
 */
export function tailLines(text: string, maxLines: number): string {
  const lines = text.split('\n')
  if (lines.length <= maxLines) return text
  return lines.slice(lines.length - maxLines).join('\n')
}
