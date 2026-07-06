import { describe, it, expect } from 'vitest'
import { redactSecrets } from './redact'

const hidden = (s: string): boolean => /\[REDACTED/i.test(s)

describe('redactSecrets — ต้องกรองความลับออก', () => {
  const cases: [string, string][] = [
    ['OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwx1234', 'openai key'],
    ['ANTHROPIC=sk-ant-abcdefghijklmnop1234567890', 'anthropic key'],
    ['GOOGLE_KEY=AIzaSyD_ABCDEFGHIJKLMNOPQRSTUVWXYZ12345', 'google key'],
    ['AWS=AKIAIOSFODNN7EXAMPLE', 'aws key'],
    ['token ghp_1234567890abcdefghijklmnopqrstuvwxyz', 'github token'],
    ['export DB_PASSWORD=SuperSecret123', 'password assignment'],
    ['postgres://admin:hunter2@db.local:5432/app', 'url password'],
    ['Authorization: Bearer abcdef0123456789xyz', 'bearer'],
    ['mysql -uroot -pMyP4ssw0rd mydb', 'mysql -p'],
    ['api_key: "abcd1234efgh5678"', 'api_key assignment']
  ]
  for (const [input, name] of cases) {
    it(`กรอง: ${name}`, () => {
      const out = redactSecrets(input)
      expect(hidden(out)).toBe(true)
      // ค่าจริงต้องไม่หลงเหลือ
      expect(out).not.toContain('SuperSecret123')
      expect(out).not.toContain('hunter2')
      expect(out).not.toContain('MyP4ssw0rd')
    })
  }

  it('กรอง PEM private key block ทั้งก้อน', () => {
    const pem =
      '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAA\nAAAA\n-----END OPENSSH PRIVATE KEY-----'
    const out = redactSecrets(pem)
    expect(hidden(out)).toBe(true)
    expect(out).not.toContain('b3BlbnNzaC1rZXktdjEAAAA')
  })
})

describe('redactSecrets — ต้องไม่แตะข้อความปกติ (ไม่ false positive)', () => {
  const safe = [
    'total 40\ndrwxr-xr-x 3 root root 4096 Jan 1 12:00 app',
    'ssh -p 22 user@host',
    'mkdir -p /var/www/app',
    'ping 192.168.0.20',
    'npm install express',
    'git commit -m "fix bug"',
    'CPU usage: 42%'
  ]
  for (const s of safe) {
    it(`ไม่แตะ: ${s.slice(0, 30)}`, () => {
      expect(redactSecrets(s)).toBe(s)
    })
  }
})
