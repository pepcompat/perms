import { describe, it, expect } from 'vitest'
import { nextCwd, resolveCwd, cwdFromPrompt } from './cwd-track'

describe('cwdFromPrompt', () => {
  it('prompt root ค่าเริ่มต้น → path เต็ม', () => {
    expect(cwdFromPrompt('root@dev:/srv/dev# ')).toBe('/srv/dev')
    expect(cwdFromPrompt('root@dev:/srv/dev#')).toBe('/srv/dev')
  })
  it('prompt user ปกติ (ลงท้าย $)', () => {
    expect(cwdFromPrompt('deploy@web-01:/var/www$ ')).toBe('/var/www')
  })
  it('อยู่ที่ home (~) หรือใต้ home', () => {
    expect(cwdFromPrompt('root@dev:~# ')).toBe('~')
    expect(cwdFromPrompt('user@host:~/projects/app$ ')).toBe('~/projects/app')
  })
  it('มีคำสั่งพิมพ์ค้างอยู่ท้าย prompt → ไม่จับ (ไม่ใช่ cwd)', () => {
    expect(cwdFromPrompt('root@dev:/srv/dev# ls -la')).toBeNull()
  })
  it('prompt ที่ปรับแต่ง/มี git branch → คืน null (ให้ fallback)', () => {
    expect(cwdFromPrompt('root@dev:/srv/dev (main)# ')).toBeNull()
    expect(cwdFromPrompt('❯ ')).toBeNull()
  })
  it('บรรทัดที่ไม่ใช่ prompt → null', () => {
    expect(cwdFromPrompt('Welcome to Ubuntu 24.04.3 LTS')).toBeNull()
    expect(cwdFromPrompt('')).toBeNull()
  })
})

describe('nextCwd', () => {
  it('ไม่ใช่คำสั่ง cd → cwd เดิม', () => {
    expect(nextCwd('~/proj', 'ls -la')).toBe('~/proj')
    expect(nextCwd('/var', 'npm run build')).toBe('/var')
  })

  it('cd เปล่า / cd ~ / cd $HOME → กลับ home', () => {
    expect(nextCwd('/var/log', 'cd')).toBe('~')
    expect(nextCwd('/var/log', 'cd ~')).toBe('~')
    expect(nextCwd('/var/log', 'cd $HOME')).toBe('~')
  })

  it('cd absolute → ใช้ path นั้น (ตัด . .. ให้)', () => {
    expect(nextCwd('~', 'cd /etc/nginx')).toBe('/etc/nginx')
    expect(nextCwd('~', 'cd /var/www/../log')).toBe('/var/log')
  })

  it('cd ~/sub → อยู่ใต้ home', () => {
    expect(nextCwd('/tmp', 'cd ~/projects/app')).toBe('~/projects/app')
  })

  it('cd relative → ต่อจากที่อยู่ปัจจุบัน', () => {
    expect(nextCwd('~/proj', 'cd src')).toBe('~/proj/src')
    expect(nextCwd('/var', 'cd log/nginx')).toBe('/var/log/nginx')
  })

  it('cd .. → ถอยขึ้นหนึ่งชั้น', () => {
    expect(nextCwd('~/proj/src', 'cd ..')).toBe('~/proj')
    expect(nextCwd('/var/log', 'cd ..')).toBe('/var')
  })

  it('.. ทะลุเหนือ home → null (ไม่รู้ path)', () => {
    expect(nextCwd('~', 'cd ..')).toBeNull()
  })

  it('.. ที่ราก / → ยังเป็นราก', () => {
    expect(nextCwd('/', 'cd ..')).toBe('/')
  })

  it('cd - (กลับที่เดิม) → null เพราะไม่ได้ track ที่ก่อนหน้า', () => {
    expect(nextCwd('~/a', 'cd -')).toBeNull()
  })

  it('cd relative ทั้งที่ยังไม่รู้ที่อยู่ → null', () => {
    expect(nextCwd(null, 'cd src')).toBeNull()
  })

  it('cd ปนกับคำสั่งอื่น → null (เดาไม่ได้)', () => {
    expect(nextCwd('~', 'cd /app && npm start')).toBeNull()
    expect(nextCwd('~', 'foo; cd /bar')).toBeNull()
  })

  it('คำสั่งอื่นที่มี operator แต่ไม่มี cd → cwd เดิม', () => {
    expect(nextCwd('~/x', 'ls && pwd')).toBe('~/x')
  })

  it('cd ในเครื่องหมายคำพูด', () => {
    expect(nextCwd('~', "cd '/var/log'")).toBe('/var/log')
    expect(nextCwd('~', 'cd "src"')).toBe('~/src')
  })

  it('บรรทัดว่าง → cwd เดิม', () => {
    expect(nextCwd('~/a', '   ')).toBe('~/a')
  })
})

describe('resolveCwd', () => {
  const home = '/home/deploy'

  it('null → null (ให้ผู้เรียกใช้ home เอง)', () => {
    expect(resolveCwd(null, home)).toBeNull()
  })
  it('~ → home', () => {
    expect(resolveCwd('~', home)).toBe('/home/deploy')
  })
  it('~/sub → home + sub', () => {
    expect(resolveCwd('~/projects/app', home)).toBe('/home/deploy/projects/app')
  })
  it('absolute → ใช้ตามนั้น', () => {
    expect(resolveCwd('/etc/nginx', home)).toBe('/etc/nginx')
  })
  it('home ที่มี / ต่อท้าย ไม่ทำให้ slash ซ้อน', () => {
    expect(resolveCwd('~/app', '/root/')).toBe('/root/app')
  })
})
