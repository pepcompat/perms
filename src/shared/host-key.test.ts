import { describe, it, expect } from 'vitest'
import { hostKeyId, formatFingerprint, shortFingerprint, verifyHostKey } from './host-key'

describe('hostKeyId', () => {
  it('ไม่สนตัวพิมพ์เล็กใหญ่และช่องว่าง', () => {
    expect(hostKeyId('  Example.COM ', 22)).toBe('example.com:22')
  })
  it('พอร์ตว่าง/0 → ใช้ 22', () => {
    expect(hostKeyId('h', 0)).toBe('h:22')
  })
  it('คนละพอร์ต = คนละ host key', () => {
    expect(hostKeyId('h', 22)).not.toBe(hostKeyId('h', 2222))
  })
})

describe('formatFingerprint', () => {
  it('เติม SHA256: และตัด = ท้ายออกตามแบบ OpenSSH', () => {
    expect(formatFingerprint('abc123==')).toBe('SHA256:abc123')
  })
  it('ไม่มี = ท้ายก็ไม่กระทบ', () => {
    expect(formatFingerprint('abc')).toBe('SHA256:abc')
  })
})

describe('shortFingerprint', () => {
  it('ย่อของยาวให้เหลือหัวท้าย', () => {
    const long = `SHA256:${'x'.repeat(43)}`
    const s = shortFingerprint(long)
    expect(s.startsWith('SHA256:xxxxxxxxxx')).toBe(true)
    expect(s).toContain('…')
    expect(s.length).toBeLessThan(long.length)
  })
  it('ของสั้นอยู่แล้ว ปล่อยผ่าน', () => {
    expect(shortFingerprint('SHA256:abc')).toBe('SHA256:abc')
  })
})

describe('verifyHostKey', () => {
  const incoming = { keyType: 'ssh-ed25519', fingerprint: 'SHA256:aaa' }

  it('ไม่เคยเจอ → new (ต้องให้ผู้ใช้ยืนยันครั้งแรก)', () => {
    expect(verifyHostKey(null, incoming)).toBe('new')
  })

  it('ตรงทั้งชนิดและลายนิ้วมือ → match', () => {
    expect(verifyHostKey({ host: 'h', port: 22, ...incoming }, incoming)).toBe('match')
  })

  it('ลายนิ้วมือเปลี่ยน → changed (สัญญาณ MITM)', () => {
    const stored = { host: 'h', port: 22, keyType: 'ssh-ed25519', fingerprint: 'SHA256:bbb' }
    expect(verifyHostKey(stored, incoming)).toBe('changed')
  })

  it('ชนิดคีย์เปลี่ยนแม้ลายนิ้วมือเดิม → changed (ไม่เดาแทนผู้ใช้)', () => {
    const stored = { host: 'h', port: 22, keyType: 'ssh-rsa', fingerprint: 'SHA256:aaa' }
    expect(verifyHostKey(stored, incoming)).toBe('changed')
  })
})
