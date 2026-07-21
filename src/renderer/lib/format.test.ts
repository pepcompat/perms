import { describe, it, expect } from 'vitest'
import { humanSize, joinRemote, parentPath, isArchive } from './format'

describe('humanSize', () => {
  it('ต่ำกว่า 1KB → เป็น B', () => {
    expect(humanSize(0)).toBe('0 B')
    expect(humanSize(512)).toBe('512 B')
    expect(humanSize(1023)).toBe('1023 B')
  })
  it('เลื่อนหน่วยเมื่อถึง 1024', () => {
    expect(humanSize(1024)).toBe('1.0 KB')
    expect(humanSize(1536)).toBe('1.5 KB')
    expect(humanSize(1048576)).toBe('1.0 MB')
    expect(humanSize(1073741824)).toBe('1.0 GB')
  })
})

describe('joinRemote', () => {
  it('ต่อ path ปกติ', () => {
    expect(joinRemote('/home/user', 'file.txt')).toBe('/home/user/file.txt')
  })
  it('ราก /', () => {
    expect(joinRemote('/', 'etc')).toBe('/etc')
  })
  it('dir ที่ลงท้ายด้วย / ไม่ซ้อน slash', () => {
    expect(joinRemote('/home/', 'x')).toBe('/home/x')
  })
})

describe('isArchive', () => {
  it('ไฟล์บีบอัด → true', () => {
    for (const n of ['a.zip', 'b.tar.gz', 'c.tgz', 'd.tar', 'e.gz', 'f.tar.bz2', 'g.txz', 'H.ZIP']) {
      expect(isArchive(n)).toBe(true)
    }
  })
  it('ไฟล์ทั่วไป → false', () => {
    for (const n of ['a.txt', '.env', 'docker-compose.yml', 'image.png', 'script.sh']) {
      expect(isArchive(n)).toBe(false)
    }
  })
})

describe('parentPath', () => {
  it('ขึ้นไปโฟลเดอร์แม่', () => {
    expect(parentPath('/home/user/app')).toBe('/home/user')
  })
  it('ชั้นเดียว → ราก', () => {
    expect(parentPath('/home')).toBe('/')
  })
  it('รากอยู่แล้ว → คงเป็นราก', () => {
    expect(parentPath('/')).toBe('/')
  })
})
