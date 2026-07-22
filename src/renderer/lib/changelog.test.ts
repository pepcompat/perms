import { describe, it, expect } from 'vitest'
import { whatsNewFor, CHANGELOG, pickLang } from './changelog'

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
  it('อัป 1.4.0 → 1.5.0 → โชว์เฉพาะ 1.5.0', () => {
    expect(whatsNewFor('1.4.0', '1.5.0').map((e) => e.version)).toEqual(['1.5.0'])
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

describe('changelog 2 ภาษา', () => {
  // กันเวอร์ชันใหม่ถูกเพิ่มโดยลืมเขียนภาษาอังกฤษ
  it('ทุก entry มีทั้งไทยและอังกฤษ', () => {
    const missing: string[] = []
    for (const e of CHANGELOG) {
      if (!e.title.trim()) missing.push(`${e.version}: title`)
      if (!e.titleEn.trim()) missing.push(`${e.version}: titleEn`)
      e.items.forEach((it, i) => {
        if (!it.text.trim()) missing.push(`${e.version}: items[${i}].text`)
        if (!it.textEn.trim()) missing.push(`${e.version}: items[${i}].textEn`)
      })
    }
    expect(missing).toEqual([])
  })

  it('ข้อความอังกฤษต้องไม่มีอักษรไทยปน', () => {
    const thai = /[฀-๿]/
    const bad = CHANGELOG.flatMap((e) => [
      ...(thai.test(e.titleEn) ? [`${e.version}: titleEn`] : []),
      ...e.items.flatMap((it, i) => (thai.test(it.textEn) ? [`${e.version}: items[${i}]`] : []))
    ])
    expect(bad).toEqual([])
  })

  it('pickLang เลือกตามภาษา และ fallback เป็นไทยถ้า en ว่าง', () => {
    expect(pickLang('ไทย', 'English', 'th')).toBe('ไทย')
    expect(pickLang('ไทย', 'English', 'en')).toBe('English')
    expect(pickLang('ไทย', '', 'en')).toBe('ไทย')
  })
})
