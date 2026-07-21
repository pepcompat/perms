import { describe, it, expect } from 'vitest'
import { translate } from './i18n'

describe('translate', () => {
  it('ภาษาไทย → คืนข้อความเดิมเสมอ (UI ไทยไม่เปลี่ยน)', () => {
    expect(translate('บันทึก', 'th')).toBe('บันทึก')
    expect(translate('ข้อความที่ไม่มีในดิกชันนารี', 'th')).toBe('ข้อความที่ไม่มีในดิกชันนารี')
  })
  it('ภาษาอังกฤษ → แปลตามดิกชันนารี', () => {
    expect(translate('บันทึก', 'en')).toBe('Save')
    expect(translate('ยกเลิก', 'en')).toBe('Cancel')
    expect(translate('ดาวน์โหลด', 'en')).toBe('Download')
  })
  it('ไม่มีคำแปล → fallback เป็นไทย (ไม่โชว์ค่าว่าง)', () => {
    const s = 'ข้อความที่ยังไม่ได้แปล ๆๆ'
    expect(translate(s, 'en')).toBe(s)
  })
})
