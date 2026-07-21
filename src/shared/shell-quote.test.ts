import { describe, it, expect } from 'vitest'
import { shQuote } from './shell-quote'

describe('shQuote', () => {
  it('ชื่อไฟล์ปกติ', () => {
    expect(shQuote('file.txt')).toBe("'file.txt'")
  })
  it('มีช่องว่าง', () => {
    expect(shQuote('my file.txt')).toBe("'my file.txt'")
  })
  it('อักขระพิเศษของ shell ถูกครอบไว้ (ไม่ถูกตีความ)', () => {
    for (const s of ['a;rm -rf /', '$(whoami)', '`id`', 'a|b', 'a&&b', 'a>b', '*.txt', 'a\\b']) {
      const q = shQuote(s)
      expect(q.startsWith("'")).toBe(true)
      expect(q.endsWith("'")).toBe(true)
      // เนื้อหาเดิมอยู่ครบ ไม่มี quote เดี่ยวหลุด
      expect(q.slice(1, -1)).toBe(s)
    }
  })
  it('มี single quote ในชื่อ → escape แบบ \'\\\'\'', () => {
    expect(shQuote("it's")).toBe(`'it'\\''s'`)
  })
  it('หลาย single quote', () => {
    expect(shQuote("a'b'c")).toBe(`'a'\\''b'\\''c'`)
  })
  it('สตริงว่าง → quote ว่าง (ไม่กลายเป็น argument หาย)', () => {
    expect(shQuote('')).toBe("''")
  })
})
