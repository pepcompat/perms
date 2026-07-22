import { describe, it, expect } from 'vitest'
import {
  evaluateCall,
  commandTextOf,
  buildExtraArgs,
  DEFAULT_GUARD_POLICY,
  type GuardInput
} from './ai-guard'

const base = (over: Partial<GuardInput> = {}): GuardInput => ({
  toolName: 'run_command',
  args: { command: 'ls -la' },
  mutating: true,
  dangerReason: null,
  callIndex: 0,
  mode: 'agentic',
  policy: { ...DEFAULT_GUARD_POLICY },
  ...over
})

describe('evaluateCall', () => {
  it('tool อ่านอย่างเดียว → ปล่อยผ่านเสมอ แม้โหมดอนุมัติ', () => {
    const v = evaluateCall(base({ mutating: false, mode: 'approve' }))
    expect(v.action).toBe('allow')
  })

  it('agentic + คำสั่งธรรมดา → ปล่อย', () => {
    expect(evaluateCall(base()).action).toBe('allow')
  })

  it('โหมดอนุมัติ → ถามก่อน', () => {
    const v = evaluateCall(base({ mode: 'approve' }))
    expect(v.action).toBe('confirm')
    expect(v.reasons.join()).toContain('อนุมัติ')
  })

  it('โหมดแนะนำ → ไม่รันให้', () => {
    expect(evaluateCall(base({ mode: 'suggest' })).action).toBe('block')
  })

  it('คำสั่งอันตราย → ถามเสมอ แม้ agentic', () => {
    const v = evaluateCall(base({ dangerReason: 'ลบไฟล์ทั้งระบบ' }))
    expect(v.action).toBe('confirm')
    expect(v.reasons).toContain('ลบไฟล์ทั้งระบบ')
  })

  it('ตรง deny pattern → บล็อค ไม่ถาม', () => {
    const v = evaluateCall(
      base({
        args: { command: 'kubectl delete ns prod' },
        policy: { ...DEFAULT_GUARD_POLICY, denyPatterns: ['kubectl\\s+delete'] }
      })
    )
    expect(v.action).toBe('block')
    expect(v.reasons.join()).toContain('kubectl')
  })

  it('deny pattern ชนะคำสั่งอันตราย (บล็อคก่อนถาม)', () => {
    const v = evaluateCall(
      base({
        args: { command: 'rm -rf /' },
        dangerReason: 'ลบไฟล์ทั้งระบบ',
        policy: { ...DEFAULT_GUARD_POLICY, denyPatterns: ['rm\\s+-rf'] }
      })
    )
    expect(v.action).toBe('block')
  })

  it('regex ที่พิมพ์ผิด ไม่ทำให้ระบบพัง — ข้ามไปเฉย ๆ', () => {
    const v = evaluateCall(
      base({ policy: { ...DEFAULT_GUARD_POLICY, denyPatterns: ['[unclosed'] } })
    )
    expect(v.action).toBe('allow')
  })

  it('เกินโควตาคำสั่งต่อรอบ → บล็อค', () => {
    const p = { ...DEFAULT_GUARD_POLICY, maxCallsPerRun: 3 }
    expect(evaluateCall(base({ callIndex: 2, policy: p })).action).toBe('allow')
    expect(evaluateCall(base({ callIndex: 3, policy: p })).action).toBe('block')
  })

  it('โควตา 0 = ไม่จำกัด', () => {
    const p = { ...DEFAULT_GUARD_POLICY, maxCallsPerRun: 0 }
    expect(evaluateCall(base({ callIndex: 999, policy: p })).action).toBe('allow')
  })

  it('ตั้งให้ขออนุมัติทุกคำสั่ง → ถามแม้ agentic', () => {
    const v = evaluateCall(
      base({ policy: { ...DEFAULT_GUARD_POLICY, requireApprovalForAll: true } })
    )
    expect(v.action).toBe('confirm')
  })
})

describe('commandTextOf', () => {
  it('อ่านได้ทั้ง command / cmd / script', () => {
    expect(commandTextOf({ command: 'a' })).toBe('a')
    expect(commandTextOf({ cmd: 'b' })).toBe('b')
    expect(commandTextOf({ script: 'c' })).toBe('c')
  })
  it('ไม่มีคำสั่ง → คืนสตริงว่าง ไม่ throw', () => {
    expect(commandTextOf({})).toBe('')
    expect(commandTextOf({ command: 123 })).toBe('')
  })
})

describe('buildExtraArgs', () => {
  it('ตัดคีย์คำสั่งออก เหลือเฉพาะอาร์กิวเมนต์อื่น', () => {
    expect(buildExtraArgs({ command: 'ls', title: 'x', n: 3 })).toEqual([
      { key: 'title', value: 'x' },
      { key: 'n', value: '3' }
    ])
  })
  it('ตัดค่าที่ยาวเกิน', () => {
    const [arg] = buildExtraArgs({ note: 'x'.repeat(500) })
    expect(arg.value.length).toBe(201)
    expect(arg.value.endsWith('…')).toBe(true)
  })
})
