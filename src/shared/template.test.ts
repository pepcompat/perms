import { describe, it, expect } from 'vitest'
import { extractPlaceholders, extractPlaceholdersAll, fillTemplate } from './template'

describe('extractPlaceholders', () => {
  it('ดึงชื่อไม่ซ้ำ เรียงตามที่พบ', () => {
    expect(extractPlaceholders('./build.sh {{version}} {{service}} {{version}}')).toEqual([
      'version',
      'service'
    ])
  })
  it('เว้นวรรคในวงเล็บได้', () => {
    expect(extractPlaceholders('deploy {{ env }}')).toEqual(['env'])
  })
  it('ไม่มี placeholder → array ว่าง', () => {
    expect(extractPlaceholders('ls -la')).toEqual([])
  })
  it('รองรับ . - _ ในชื่อ', () => {
    expect(extractPlaceholders('{{app.name}} {{db-host}} {{a_b}}')).toEqual([
      'app.name',
      'db-host',
      'a_b'
    ])
  })
})

describe('extractPlaceholdersAll', () => {
  it('รวมหลายบรรทัด ไม่ซ้ำ', () => {
    expect(
      extractPlaceholdersAll(['git pull {{branch}}', 'pm2 reload {{app}}', 'echo {{branch}}'])
    ).toEqual(['branch', 'app'])
  })
})

describe('fillTemplate', () => {
  it('แทนค่าตามชื่อ', () => {
    expect(fillTemplate('./b.sh {{v}} {{s}}', { v: 'v1.0.0', s: 'backend' })).toBe(
      './b.sh v1.0.0 backend'
    )
  })
  it('แทนได้แม้เว้นวรรคในวงเล็บ', () => {
    expect(fillTemplate('run {{ env }}', { env: 'prod' })).toBe('run prod')
  })
  it('key ไม่มีใน values → คงข้อความเดิมไว้', () => {
    expect(fillTemplate('a {{x}} b', {})).toBe('a {{x}} b')
  })
  it('ค่าว่างถ้ามี key นั้น → แทนด้วยว่าง', () => {
    expect(fillTemplate('a{{x}}b', { x: '' })).toBe('ab')
  })
})
