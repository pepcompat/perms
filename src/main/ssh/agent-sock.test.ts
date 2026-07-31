import { describe, it, expect } from 'vitest'
import { chooseAgentSock, WIN_OPENSSH_PIPE } from './agent-sock'

describe('chooseAgentSock', () => {
  it('มี SSH_AUTH_SOCK → ใช้ตามนั้นเสมอ (ทุก OS)', () => {
    expect(
      chooseAgentSock({ authSock: '/tmp/agent.sock', platform: 'darwin', opensshPipeExists: false })
    ).toBe('/tmp/agent.sock')
    expect(
      chooseAgentSock({ authSock: '/tmp/a', platform: 'win32', opensshPipeExists: true })
    ).toBe('/tmp/a')
  })

  it('Windows + มี OpenSSH agent pipe → ใช้ pipe นั้น (ไม่ใช่ pageant)', () => {
    expect(chooseAgentSock({ platform: 'win32', opensshPipeExists: true })).toBe(WIN_OPENSSH_PIPE)
  })

  it('Windows + ไม่มี pipe → fallback เป็น pageant (PuTTY)', () => {
    expect(chooseAgentSock({ platform: 'win32', opensshPipeExists: false })).toBe('pageant')
  })

  it('mac/linux ไม่มี SSH_AUTH_SOCK → undefined (ให้ผู้เรียกแจ้งว่าไม่มี agent)', () => {
    expect(chooseAgentSock({ platform: 'darwin', opensshPipeExists: false })).toBeUndefined()
    expect(chooseAgentSock({ platform: 'linux', opensshPipeExists: false })).toBeUndefined()
  })
})
