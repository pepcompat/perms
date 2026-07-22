// สถานะคิวรับส่งไฟล์ + กติกาการลองใหม่ — ส่วนที่ตัดสินใจล้วน ๆ (เทสได้)
// การโอนจริงอยู่ที่ src/main/terminal/transfer-queue.ts

export type TransferStatus = 'queued' | 'running' | 'done' | 'failed' | 'canceled'
export type TransferKind = 'upload' | 'download'

export interface TransferItem {
  id: string
  kind: TransferKind
  sessionId: string
  remotePath: string
  localPath: string
  name: string
  size: number
  transferred: number
  status: TransferStatus
  attempts: number
  error?: string
  /** sha256 ที่ตรวจได้หลังโอนเสร็จ (ถ้าตรวจได้) */
  checksum?: string
  /** ตรวจ checksum แล้วผลเป็นอย่างไร */
  verified?: 'ok' | 'mismatch' | 'skipped'
}

export const MAX_ATTEMPTS = 4

/**
 * หน่วงก่อนลองใหม่แบบ exponential — 1s, 2s, 4s, 8s แล้วตันที่ 30s
 * ไม่ใส่ jitter เพราะคิวนี้ทำทีละงาน ไม่มีปัญหา thundering herd
 */
export function retryDelayMs(attempt: number): number {
  const base = 1000 * Math.pow(2, Math.max(0, attempt - 1))
  return Math.min(base, 30_000)
}

/**
 * error แบบไหนที่ลองใหม่แล้วมีโอกาสสำเร็จ
 * เน็ตหลุด/timeout = ลองใหม่ได้ ส่วนสิทธิ์ไม่พอ/ไม่มีไฟล์ = ลองกี่ทีก็เหมือนเดิม
 */
export function isRetryableError(message: string): boolean {
  const m = message.toLowerCase()
  // หมายเหตุ: อย่าใส่คำกว้าง ๆ อย่าง "failure" ตรงนี้ — มันจะกลืน "Channel open failure"
  // ซึ่งเป็นอาการเน็ตหลุด (ควรลองใหม่) ทำให้คิว retry ไม่ทำงานเลย
  const permanent = [
    'permission denied',
    'no such file',
    'not a directory',
    'is a directory',
    'quota',
    'no space left',
    'unsupported'
  ]
  if (permanent.some((p) => m.includes(p))) return false

  const transient = [
    'timeout',
    'timed out',
    'etimedout', // ชื่อ error code ของ node ไม่มีคำว่า timeout ตรง ๆ
    'econnreset',
    'econnrefused',
    'econnaborted',
    'epipe',
    'ehostunreach',
    'enetunreach',
    'enetdown',
    'socket',
    'closed',
    'disconnect',
    'channel open failure'
  ]
  return transient.some((p) => m.includes(p))
}

export function shouldRetry(item: TransferItem, maxAttempts = MAX_ATTEMPTS): boolean {
  if (item.status === 'canceled' || item.status === 'done') return false
  if (item.attempts >= maxAttempts) return false
  return isRetryableError(item.error ?? '')
}

/** งานถัดไปที่ควรทำ — ทำทีละงานกันแย่ง bandwidth กันเอง */
export function nextQueued(items: TransferItem[]): TransferItem | null {
  if (items.some((i) => i.status === 'running')) return null
  return items.find((i) => i.status === 'queued') ?? null
}

export interface QueueSummary {
  total: number
  running: number
  queued: number
  done: number
  failed: number
  /** เปอร์เซ็นต์รวมทั้งคิว คิดตามไบต์ถ้ารู้ขนาด */
  percent: number
}

export function summarize(items: TransferItem[]): QueueSummary {
  const active = items.filter((i) => i.status !== 'canceled')
  const totalBytes = active.reduce((s, i) => s + (i.size || 0), 0)
  const doneBytes = active.reduce(
    (s, i) => s + (i.status === 'done' ? i.size || 0 : i.transferred || 0),
    0
  )
  return {
    total: active.length,
    running: items.filter((i) => i.status === 'running').length,
    queued: items.filter((i) => i.status === 'queued').length,
    done: items.filter((i) => i.status === 'done').length,
    failed: items.filter((i) => i.status === 'failed').length,
    percent: totalBytes > 0 ? Math.min(100, Math.round((doneBytes / totalBytes) * 100)) : 0
  }
}

/**
 * ตำแหน่งที่ควรเริ่มโอนต่อ — ถ้าไฟล์ปลายทางมีอยู่แล้วบางส่วนให้ต่อจากตรงนั้น
 * ถ้าปลายทางใหญ่กว่าต้นทาง แปลว่าไฟล์คนละตัว/พัง ต้องเริ่มใหม่
 */
export function resumeOffset(existingSize: number, totalSize: number): number {
  if (existingSize <= 0) return 0
  if (existingSize >= totalSize) return 0
  return existingSize
}
