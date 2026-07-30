import { describe, it, expect } from 'vitest'
import { stripAnsi, tailLines } from './ansi'

describe('stripAnsi', () => {
  it('ล้างโค้ดสี (SGR) ออก เหลือข้อความ', () => {
    expect(stripAnsi('\x1b[32m[Nest]\x1b[39m started')).toBe('[Nest] started')
  })
  it('ล้างโค้ดแบบ 256 สี', () => {
    expect(stripAnsi('\x1b[38;5;3mWARN\x1b[39m x')).toBe('WARN x')
  })
  it('ล้าง OSC (เช่น ตั้ง title)', () => {
    expect(stripAnsi('\x1b]0;my title\x07hello')).toBe('hello')
  })
  it('ข้อความปกติไม่ถูกแตะ', () => {
    expect(stripAnsi('plain text 123')).toBe('plain text 123')
  })
  it('log docker/nest จริง → อ่านออก', () => {
    const raw = '\x1b[32m[Nest]\x1b[39m \x1b[38;5;3m158\x1b[39m LOG \x1b[33mRabbitMqService\x1b[39m'
    expect(stripAnsi(raw)).toBe('[Nest] 158 LOG RabbitMqService')
  })
})

describe('tailLines', () => {
  it('น้อยกว่าเพดาน → คงเดิม', () => {
    expect(tailLines('a\nb\nc', 10)).toBe('a\nb\nc')
  })
  it('เกินเพดาน → เก็บเฉพาะบรรทัดท้าย', () => {
    expect(tailLines('1\n2\n3\n4\n5', 2)).toBe('4\n5')
  })
  it('พอดีเพดาน → คงเดิม', () => {
    expect(tailLines('1\n2\n3', 3)).toBe('1\n2\n3')
  })
})
