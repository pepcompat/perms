import { describe, it, expect } from 'vitest'
import { parseGitInfo } from './git-info'

describe('parseGitInfo', () => {
  it('อ่าน branch/commits/dirty ได้', () => {
    expect(parseGitInfo('BR:main\nCO:42\nDI:3\n')).toEqual({ branch: 'main', commits: 42, dirty: 3 })
  })

  it('branch มี / (เช่น feature/x) อ่านได้', () => {
    expect(parseGitInfo('BR:feature/login\nCO:5\nDI:0\n')?.branch).toBe('feature/login')
  })

  it('ไม่ใช่ repo (ไม่มี BR) → null', () => {
    expect(parseGitInfo('')).toBeNull()
    expect(parseGitInfo('fatal: not a git repository')).toBeNull()
  })

  it('BR ว่าง (detached/repo เปล่า) → null', () => {
    expect(parseGitInfo('BR:\nCO:0\nDI:0\n')).toBeNull()
  })

  it('ค่าที่หายไป → 0 ไม่ NaN', () => {
    expect(parseGitInfo('BR:main\n')).toEqual({ branch: 'main', commits: 0, dirty: 0 })
  })
})
