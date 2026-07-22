import { describe, it, expect } from 'vitest'
import {
  retryDelayMs,
  isRetryableError,
  shouldRetry,
  nextQueued,
  summarize,
  resumeOffset,
  MAX_ATTEMPTS,
  type TransferItem
} from './transfer-queue'

const item = (over: Partial<TransferItem> = {}): TransferItem => ({
  id: 'i1',
  kind: 'download',
  sessionId: 's1',
  remotePath: '/a/b.txt',
  localPath: '/tmp/b.txt',
  name: 'b.txt',
  size: 1000,
  transferred: 0,
  status: 'queued',
  attempts: 0,
  ...over
})

describe('retryDelayMs', () => {
  it('เพิ่มเป็นเท่าตัวตามจำนวนครั้ง', () => {
    expect(retryDelayMs(1)).toBe(1000)
    expect(retryDelayMs(2)).toBe(2000)
    expect(retryDelayMs(3)).toBe(4000)
    expect(retryDelayMs(4)).toBe(8000)
  })
  it('ตันที่ 30 วินาที ไม่โตไปเรื่อย ๆ', () => {
    expect(retryDelayMs(20)).toBe(30_000)
  })
  it('ครั้งที่ 0 หรือติดลบ ไม่พัง', () => {
    expect(retryDelayMs(0)).toBe(1000)
    expect(retryDelayMs(-5)).toBe(1000)
  })
})

describe('isRetryableError', () => {
  it('ปัญหาเน็ต/ชั่วคราว → ลองใหม่ได้', () => {
    expect(isRetryableError('read ECONNRESET')).toBe(true)
    expect(isRetryableError('Operation timed out')).toBe(true)
    expect(isRetryableError('Channel open failure')).toBe(true)
    expect(isRetryableError('socket hang up')).toBe(true)
  })
  it('ปัญหาถาวร → ลองใหม่ก็เหมือนเดิม', () => {
    expect(isRetryableError('Permission denied')).toBe(false)
    expect(isRetryableError('No such file or directory')).toBe(false)
    expect(isRetryableError('No space left on device')).toBe(false)
    expect(isRetryableError('Disk quota exceeded')).toBe(false)
  })
  it('error ที่ไม่รู้จัก → ไม่ลองใหม่ (ปลอดภัยกว่าวนไม่จบ)', () => {
    expect(isRetryableError('something weird')).toBe(false)
    expect(isRetryableError('')).toBe(false)
  })
})

describe('shouldRetry', () => {
  it('error ชั่วคราว + ยังไม่ครบโควตา → ลองใหม่', () => {
    expect(shouldRetry(item({ status: 'failed', attempts: 1, error: 'ETIMEDOUT' }))).toBe(true)
  })
  it('ครบโควตาแล้ว → หยุด', () => {
    expect(
      shouldRetry(item({ status: 'failed', attempts: MAX_ATTEMPTS, error: 'ETIMEDOUT' }))
    ).toBe(false)
  })
  it('ผู้ใช้ยกเลิก → ไม่ลองใหม่แม้ error ชั่วคราว', () => {
    expect(shouldRetry(item({ status: 'canceled', attempts: 1, error: 'ETIMEDOUT' }))).toBe(false)
  })
  it('สำเร็จแล้ว → ไม่ลองใหม่', () => {
    expect(shouldRetry(item({ status: 'done', attempts: 1, error: 'ETIMEDOUT' }))).toBe(false)
  })
  it('error ถาวร → ไม่ลองใหม่', () => {
    expect(shouldRetry(item({ status: 'failed', attempts: 1, error: 'Permission denied' }))).toBe(
      false
    )
  })
})

describe('nextQueued', () => {
  it('คืนงานแรกที่รอ', () => {
    const items = [item({ id: 'a', status: 'done' }), item({ id: 'b' }), item({ id: 'c' })]
    expect(nextQueued(items)?.id).toBe('b')
  })
  it('มีงานกำลังทำอยู่ → ไม่หยิบงานใหม่ (ทำทีละงาน)', () => {
    const items = [item({ id: 'a', status: 'running' }), item({ id: 'b' })]
    expect(nextQueued(items)).toBeNull()
  })
  it('ไม่มีงานรอ → null', () => {
    expect(nextQueued([item({ status: 'done' })])).toBeNull()
  })
})

describe('summarize', () => {
  it('นับสถานะและคิดเปอร์เซ็นต์ตามไบต์', () => {
    const s = summarize([
      item({ id: 'a', status: 'done', size: 100, transferred: 100 }),
      item({ id: 'b', status: 'running', size: 100, transferred: 50 }),
      item({ id: 'c', status: 'queued', size: 100 })
    ])
    expect(s.total).toBe(3)
    expect(s.done).toBe(1)
    expect(s.running).toBe(1)
    expect(s.percent).toBe(50) // (100+50+0)/300
  })
  it('ไม่นับงานที่ยกเลิกเข้ายอดรวม', () => {
    const s = summarize([item({ id: 'a', status: 'canceled' }), item({ id: 'b', status: 'done' })])
    expect(s.total).toBe(1)
  })
  it('คิวว่าง / ไม่รู้ขนาด → 0% ไม่หารด้วยศูนย์', () => {
    expect(summarize([]).percent).toBe(0)
    expect(summarize([item({ size: 0 })]).percent).toBe(0)
  })
})

describe('resumeOffset', () => {
  it('มีไฟล์ค้างอยู่บางส่วน → ต่อจากตรงนั้น', () => {
    expect(resumeOffset(400, 1000)).toBe(400)
  })
  it('ยังไม่มีไฟล์ → เริ่มต้นใหม่', () => {
    expect(resumeOffset(0, 1000)).toBe(0)
  })
  it('ไฟล์ปลายทางใหญ่กว่าหรือเท่าต้นทาง → เริ่มใหม่ (ของคนละตัว/พัง)', () => {
    expect(resumeOffset(1000, 1000)).toBe(0)
    expect(resumeOffset(2000, 1000)).toBe(0)
  })
})
