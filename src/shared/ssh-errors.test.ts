import { describe, it, expect } from 'vitest'
import { friendlySshError } from './ssh-errors'

describe('friendlySshError', () => {
  it('auth ล้มเหลว → บอกให้ตรวจ credential', () => {
    expect(friendlySshError(new Error('All configured authentication methods failed'))).toContain(
      'ยืนยันตัวตนไม่สำเร็จ'
    )
  })
  it('เชื่อมต่อถูกปฏิเสธ (ECONNREFUSED)', () => {
    expect(friendlySshError(new Error('connect ECONNREFUSED 10.0.0.5:22'))).toContain('ปฏิเสธ')
  })
  it('หมดเวลา (ETIMEDOUT / timed out)', () => {
    expect(friendlySshError(new Error('Timed out while waiting for handshake'))).toContain(
      'หมดเวลา'
    )
    expect(friendlySshError('connect ETIMEDOUT')).toContain('หมดเวลา')
  })
  it('หา host ไม่เจอ (DNS)', () => {
    expect(friendlySshError(new Error('getaddrinfo ENOTFOUND badhost'))).toContain('หา')
  })
  it('key พัง / passphrase ผิด', () => {
    expect(friendlySshError(new Error('Cannot parse privateKey: bad passphrase'))).toContain(
      'private key'
    )
  })
  it('host key เปลี่ยน', () => {
    expect(friendlySshError(new Error('Handshake failed: host key verification'))).toContain(
      'host key'
    )
  })
  it('error ที่ไม่รู้จัก → คืนข้อความเดิม', () => {
    expect(friendlySshError(new Error('something totally unexpected'))).toBe(
      'something totally unexpected'
    )
  })
  it('ค่าว่าง/undefined → ข้อความสำรอง ไม่คืนสตริงว่าง', () => {
    expect(friendlySshError(undefined)).toBe('เชื่อมต่อไม่สำเร็จ')
    expect(friendlySshError('')).toBe('เชื่อมต่อไม่สำเร็จ')
  })
})
