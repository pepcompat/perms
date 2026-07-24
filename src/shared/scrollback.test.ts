import { describe, it, expect } from 'vitest'
import { appendScrollback, overlapLength, dedupeLive } from './scrollback'

describe('appendScrollback', () => {
  it('ยังไม่เต็มโควตา → ต่อท้ายเฉย ๆ', () => {
    expect(appendScrollback('abc', 'def', 100)).toBe('abcdef')
  })

  it('เกินโควตา → ตัดของเก่าทิ้ง เหลือไม่เกินที่กำหนด', () => {
    const out = appendScrollback('a\nb\nc\n', 'd\ne\n', 6)
    expect(out.length).toBeLessThanOrEqual(6)
    expect(out.endsWith('e\n')).toBe(true)
  })

  it('ตัดที่ท้ายบรรทัด ไม่ตัดกลางบรรทัด (กัน escape sequence ขาด)', () => {
    const buf = 'บรรทัดหนึ่ง\nบรรทัดสอง\nบรรทัดสาม\n'
    const out = appendScrollback(buf, '', 20)
    // ต้องไม่ขึ้นต้นด้วยเศษของบรรทัดที่ถูกตัด
    expect(out.startsWith('บรรทัด')).toBe(true)
  })

  it('ไม่มีขึ้นบรรทัดใหม่เลย (progress bar ยาว ๆ) → ตัดตรง ๆ ไม่ทิ้งทั้งหมด', () => {
    const out = appendScrollback('x'.repeat(50), 'y'.repeat(50), 10)
    expect(out).toBe('y'.repeat(10))
  })

  it('ข้อความว่าง ไม่พัง', () => {
    expect(appendScrollback('', '', 10)).toBe('')
  })
})

describe('overlapLength', () => {
  it('ข้อความสดซ้ำกับท้าย buffer ทั้งก้อน', () => {
    expect(overlapLength('hello world', 'world')).toBe(5)
  })

  it('ซ้ำบางส่วน — คืนความยาวที่ทับกัน', () => {
    expect(overlapLength('abcdef', 'defghi')).toBe(3)
  })

  it('ไม่ซ้ำเลย → 0', () => {
    expect(overlapLength('abc', 'xyz')).toBe(0)
  })

  it('ฝั่งใดว่าง → 0', () => {
    expect(overlapLength('', 'abc')).toBe(0)
    expect(overlapLength('abc', '')).toBe(0)
  })
})

describe('dedupeLive', () => {
  it('ตัดส่วนซ้ำออก เหลือเฉพาะของใหม่จริง ๆ', () => {
    expect(dedupeLive('$ ls\nfile.txt\n', 'file.txt\n$ ')).toBe('$ ')
  })

  it('ไม่ซ้ำ → ได้ทั้งก้อนเหมือนเดิม', () => {
    expect(dedupeLive('$ ls\n', 'total 4\n')).toBe('total 4\n')
  })

  it('ซ้ำทั้งก้อน → ไม่เหลืออะไร (ไม่เขียนซ้ำสองรอบ)', () => {
    expect(dedupeLive('abc123', '123')).toBe('')
  })
})
