import { describe, it, expect } from 'vitest'
import { diffLines, diffStat, toHunks, splitLines } from './diff'

const ops = (a: string, b: string): string => diffLines(a, b).map((l) => l.op[0]).join('')

describe('diffLines', () => {
  it('ข้อความเหมือนกัน → eq ทั้งหมด ไม่มีการเปลี่ยนแปลง', () => {
    const d = diffLines('a\nb\nc', 'a\nb\nc')
    expect(d.every((l) => l.op === 'eq')).toBe(true)
    expect(diffStat(d).changed).toBe(false)
  })

  it('เพิ่มบรรทัดกลาง → add หนึ่งบรรทัด ที่เหลือ eq', () => {
    expect(ops('a\nc', 'a\nb\nc')).toBe('eae')
    expect(diffStat(diffLines('a\nc', 'a\nb\nc'))).toEqual({
      added: 1,
      removed: 0,
      changed: true
    })
  })

  it('ลบบรรทัด → del', () => {
    expect(ops('a\nb\nc', 'a\nc')).toBe('ede')
  })

  it('แก้บรรทัด → นับเป็นลบ 1 เพิ่ม 1', () => {
    expect(diffStat(diffLines('a\nb\nc', 'a\nB\nc'))).toEqual({
      added: 1,
      removed: 1,
      changed: true
    })
  })

  it('เลขบรรทัดอ้างอิงถูกต้องทั้งสองฝั่ง', () => {
    const d = diffLines('a\nb', 'a\nx\nb')
    expect(d.map((l) => [l.op, l.aLine, l.bLine])).toEqual([
      ['eq', 1, 1],
      ['add', null, 2],
      ['eq', 2, 3]
    ])
  })

  it('จากว่างเปล่า → add ล้วน / เหลือว่างเปล่า → del ล้วน', () => {
    expect(ops('', 'a\nb')).toBe('aa')
    expect(ops('a\nb', '')).toBe('dd')
    expect(diffLines('', '')).toEqual([])
  })

  it('มองข้ามความต่างของ CRLF กับ LF', () => {
    expect(diffStat(diffLines('a\r\nb', 'a\nb')).changed).toBe(false)
  })

  it('ไฟล์ใหญ่ที่ต่างกันทั้งก้อน ไม่ค้าง (ตกไปทาง fallback)', () => {
    const a = Array.from({ length: 2500 }, (_, i) => `left-${i}`).join('\n')
    const b = Array.from({ length: 2500 }, (_, i) => `right-${i}`).join('\n')
    const d = diffLines(a, b)
    const st = diffStat(d)
    expect(st.added).toBe(2500)
    expect(st.removed).toBe(2500)
  })

  it('ไฟล์ใหญ่ที่ต่างกันไม่กี่บรรทัด ยังทำ diff ละเอียดได้ (เพราะตัดหัวท้ายก่อน)', () => {
    const base = Array.from({ length: 5000 }, (_, i) => `line-${i}`)
    const changed = [...base]
    changed[2500] = 'CHANGED'
    const st = diffStat(diffLines(base.join('\n'), changed.join('\n')))
    expect(st).toEqual({ added: 1, removed: 1, changed: true })
  })
})

describe('splitLines', () => {
  it('ข้อความว่าง = ศูนย์บรรทัด (ไม่ใช่หนึ่งบรรทัดว่าง)', () => {
    expect(splitLines('')).toEqual([])
    expect(splitLines('a')).toEqual(['a'])
    expect(splitLines('a\n')).toEqual(['a', ''])
  })
})

describe('toHunks', () => {
  it('ยุบบรรทัดเหมือนกันยาว ๆ เหลือแค่ context รอบจุดที่เปลี่ยน', () => {
    const a = Array.from({ length: 40 }, (_, i) => `l${i}`).join('\n')
    const b = a.replace('l20', 'CHANGED')
    const hunks = toHunks(diffLines(a, b), 2)
    expect(hunks).toHaveLength(1)
    // 2 บรรทัดบน + del + add + 2 บรรทัดล่าง
    expect(hunks[0].lines).toHaveLength(6)
    expect(hunks[0].skippedBefore).toBe(18)
  })

  it('เปลี่ยนหลายจุดห่างกัน → แยกเป็นหลาย hunk', () => {
    const a = Array.from({ length: 60 }, (_, i) => `l${i}`).join('\n')
    const b = a.replace('l10', 'X').replace('l50', 'Y')
    expect(toHunks(diffLines(a, b), 2)).toHaveLength(2)
  })

  it('ไม่มีอะไรเปลี่ยน → ไม่มี hunk', () => {
    expect(toHunks(diffLines('a\nb', 'a\nb'))).toEqual([])
  })
})
