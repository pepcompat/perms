// ตรวจสอบ host key ของ SSH — ป้องกัน MITM (ต่อไปเจอ key คนละตัวแปลว่ามีคนคั่นกลาง)
// ไฟล์นี้เก็บเฉพาะ logic บริสุทธิ์ ส่วนการ hash จริงอยู่ฝั่ง main (ใช้ node:crypto)
// เพราะ shared ถูก import จาก renderer ด้วย จะพึ่ง node module ไม่ได้

export type HostKeyVerdict =
  /** ยังไม่เคยเจอ server นี้ — ต้องให้ผู้ใช้ยืนยันครั้งแรก (TOFU) */
  | 'new'
  /** ตรงกับที่เคยบันทึกไว้ — ผ่าน */
  | 'match'
  /** เคยบันทึกไว้แต่ key เปลี่ยน — อันตราย ต้องบล็อค */
  | 'changed'

export interface KnownHost {
  host: string
  port: number
  keyType: string
  fingerprint: string
}

/** คีย์สำหรับค้น known host — host+port (ไม่รวม user เพราะ key ผูกกับเครื่อง ไม่ใช่บัญชี) */
export function hostKeyId(host: string, port: number): string {
  return `${host.trim().toLowerCase()}:${port || 22}`
}

/**
 * แปลง base64 ของ SHA256 digest เป็นรูปแบบเดียวกับ OpenSSH
 * เช่น "SHA256:47DEQpj8HBSa+/TImW+5JC..." (ตัด = ท้ายออกตามสเปก)
 */
export function formatFingerprint(base64Digest: string): string {
  return `SHA256:${base64Digest.replace(/=+$/, '')}`
}

/** ตัดให้สั้นพอจำได้ เวลาโชว์ใน UI แคบ ๆ */
export function shortFingerprint(fp: string): string {
  const body = fp.startsWith('SHA256:') ? fp.slice(7) : fp
  if (body.length <= 20) return fp
  return `SHA256:${body.slice(0, 10)}…${body.slice(-6)}`
}

/**
 * ตัดสินว่า key ที่เพิ่งได้รับ ตรงกับที่เคยบันทึกไว้ไหม
 * เทียบทั้ง fingerprint และชนิดคีย์ — ถ้าชนิดเดียวกันแต่ fingerprint ต่าง = ถูกสวมรอย
 * ถ้าคนละชนิด (เช่น server เพิ่ม ed25519) ก็ยังถือว่า 'changed' ให้ผู้ใช้ตัดสินเอง
 * ปลอดภัยกว่าเดาแทนผู้ใช้
 */
export function verifyHostKey(stored: KnownHost | null, incoming: Omit<KnownHost, 'host' | 'port'>): HostKeyVerdict {
  if (!stored) return 'new'
  if (stored.fingerprint === incoming.fingerprint && stored.keyType === incoming.keyType) return 'match'
  return 'changed'
}

/** ข้อความอธิบายผลตรวจ (ไทย) — ใช้ทั้งใน dialog และ log */
export function hostKeyMessage(verdict: HostKeyVerdict, host: string): string {
  switch (verdict) {
    case 'new':
      return `ยังไม่เคยเชื่อมต่อ ${host} มาก่อน — ตรวจสอบลายนิ้วมือให้ตรงกับเซิร์ฟเวอร์จริงก่อนยอมรับ`
    case 'changed':
      return `ลายนิ้วมือของ ${host} เปลี่ยนไปจากที่เคยบันทึกไว้ — อาจมีคนดักกลางทาง (MITM) หรือเซิร์ฟเวอร์ถูกติดตั้งใหม่`
    default:
      return `ยืนยันตัวตน ${host} สำเร็จ`
  }
}
