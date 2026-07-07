import { describe, it, expect } from 'vitest'
import { whatsNewFor } from './changelog'

describe('whatsNewFor', () => {
  it('current ไม่มีใน changelog → ไม่โชว์', () => {
    expect(whatsNewFor('1.2.0', '9.9.9')).toEqual([])
  })
  it('เห็นเวอร์ชันนี้แล้ว (lastSeen = current) → ไม่โชว์ซ้ำ', () => {
    expect(whatsNewFor('1.3.0', '1.3.0')).toEqual([])
  })
  it('ยังไม่เคยเห็น version ใด (null) → โชว์เฉพาะ current', () => {
    expect(whatsNewFor(null, '1.3.0').map((e) => e.version)).toEqual(['1.3.0'])
  })
  it('อัป 1.3.0 → 1.4.0 → โชว์เฉพาะ 1.4.0', () => {
    expect(whatsNewFor('1.3.0', '1.4.0').map((e) => e.version)).toEqual(['1.4.0'])
  })
  it('อัปจากเวอร์ชันก่อนหน้า → โชว์เฉพาะที่ใหม่กว่า', () => {
    expect(whatsNewFor('1.2.0', '1.3.0').map((e) => e.version)).toEqual(['1.3.0', '1.2.1'])
  })
  it('อัปข้ามหลายเวอร์ชัน → โชว์ทุกอันระหว่างนั้น (ใหม่→เก่า)', () => {
    expect(whatsNewFor('1.1.0', '1.3.0').map((e) => e.version)).toEqual([
      '1.3.0',
      '1.2.1',
      '1.2.0',
      '1.1.1'
    ])
  })
})
