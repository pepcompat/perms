import { describe, it, expect } from 'vitest'
import { KILL_LINE, moveCursorSeq, cellFromPoint, deleteSelectionSeq } from './line-edit'

describe('KILL_LINE', () => {
  it('คือ ^E ตามด้วย ^U', () => {
    expect(KILL_LINE).toBe('\x05\x15')
  })
})

describe('moveCursorSeq', () => {
  it('ไปขวาเมื่อ to > from (→ ต่อกันตามจำนวน)', () => {
    expect(moveCursorSeq(5, 8)).toBe('\x1b[C\x1b[C\x1b[C')
  })
  it('ไปซ้ายเมื่อ to < from', () => {
    expect(moveCursorSeq(8, 5)).toBe('\x1b[D\x1b[D\x1b[D')
  })
  it('ว่างเมื่อไม่ต้องขยับ', () => {
    expect(moveCursorSeq(4, 4)).toBe('')
  })
  it('ปัดเศษคอลัมน์ก่อนคำนวณ', () => {
    expect(moveCursorSeq(4.4, 6.6)).toBe('\x1b[C\x1b[C\x1b[C') // 4 → 7
  })
})

describe('cellFromPoint', () => {
  const rect = { left: 12, top: 8, width: 800, height: 480 } // 80 cols × 24 rows → cell 10×20
  it('คำนวณคอลัมน์/แถวจากพิกัดคลิก', () => {
    expect(cellFromPoint(12 + 105, 8 + 50, rect, 80, 24)).toEqual({ col: 11, row: 2 }) // 105/10≈11, 50/20=2
  })
  it('คลิกซ้ายสุด = คอลัมน์ 0 (ไม่ติดลบ)', () => {
    expect(cellFromPoint(0, 8, rect, 80, 24)).toEqual({ col: 0, row: 0 })
  })
  it('กัน cols/rows = 0', () => {
    expect(cellFromPoint(100, 100, rect, 0, 0)).toEqual({ col: 0, row: 0 })
  })
})

describe('deleteSelectionSeq', () => {
  it('ย้ายไปท้ายช่วงแล้ว backspace เท่าจำนวนตัวอักษร', () => {
    // เคอร์เซอร์คอลัมน์ 10, เลือกเริ่มคอลัมน์ 3 ยาว 4 ตัว → ท้ายช่วง = 7 → ซ้าย 3 + BS 4
    expect(deleteSelectionSeq(10, 3, 4)).toBe('\x1b[D\x1b[D\x1b[D' + '\x7f\x7f\x7f\x7f')
  })
  it('เคอร์เซอร์อยู่ก่อนช่วงเลือก → เดินหน้าไปท้ายช่วงก่อนลบ', () => {
    // เคอร์เซอร์ 2, เลือกเริ่ม 5 ยาว 2 → ท้ายช่วง = 7 → ขวา 5 + BS 2
    expect(deleteSelectionSeq(2, 5, 2)).toBe('\x1b[C'.repeat(5) + '\x7f\x7f')
  })
  it('ว่างเมื่อไม่มีอะไรเลือก', () => {
    expect(deleteSelectionSeq(10, 3, 0)).toBe('')
  })
})
