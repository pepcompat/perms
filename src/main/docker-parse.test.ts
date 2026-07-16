import { describe, it, expect } from 'vitest'
import { parseDockerPs, isValidContainerId } from './docker-parse'

const line = (o: Record<string, string>): string => JSON.stringify(o)

describe('parseDockerPs', () => {
  it('parse container ที่ running + ดึง compose project/service', () => {
    const out = line({
      ID: 'abc123',
      Names: 'kat-backend-dev',
      Image: 'node:22-alpine',
      Status: 'Up 4 hours',
      State: 'running',
      Ports: '0.0.0.0:9001->3000/tcp',
      Labels: 'com.docker.compose.project=kat,com.docker.compose.service=backend,foo=bar'
    })
    const [c] = parseDockerPs(out)
    expect(c).toMatchObject({
      id: 'abc123',
      name: 'kat-backend-dev',
      image: 'node:22-alpine',
      state: 'running',
      ports: '0.0.0.0:9001->3000/tcp',
      project: 'kat',
      service: 'backend'
    })
  })

  it('container ที่ไม่มี field State → เดา state จาก Status', () => {
    const up = parseDockerPs(line({ ID: '1', Status: 'Up 2 hours' }))[0]
    const down = parseDockerPs(line({ ID: '2', Status: 'Exited (0) 5 minutes ago' }))[0]
    expect(up.state).toBe('running')
    expect(down.state).toBe('exited')
  })

  it('container แยกเดี่ยว (ไม่มี compose label) → project/service ว่าง', () => {
    const c = parseDockerPs(line({ ID: 'x', Names: 'redis', Labels: 'maintainer=redis' }))[0]
    expect(c.project).toBe('')
    expect(c.service).toBe('')
  })

  it('หลาย container + ข้าม line ที่ว่าง/ไม่ใช่ JSON', () => {
    const out = [
      line({ ID: 'a', Names: 'one' }),
      '',
      'docker: command not found',
      line({ ID: 'b', Names: 'two' })
    ].join('\n')
    const list = parseDockerPs(out)
    expect(list.map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('output ว่าง → array ว่าง', () => {
    expect(parseDockerPs('')).toEqual([])
  })
})

describe('isValidContainerId — กัน command injection', () => {
  it('id/name ปกติ ผ่าน', () => {
    for (const id of ['abc123', 'my-app_1', 'app.web.1', 'f28e6fb9a15b']) {
      expect(isValidContainerId(id)).toBe(true)
    }
  })
  it('id ที่มีอักขระอันตราย ถูกปฏิเสธ', () => {
    for (const id of ['abc; rm -rf /', '$(whoami)', 'a b', 'a|b', 'a&&b', 'a/b', '`id`', '', 'a>b']) {
      expect(isValidContainerId(id)).toBe(false)
    }
  })
})
