import { describe, it, expect } from 'vitest'
import { rankSuggestions, type CommandStat } from './suggest'

const NOW = 1_800_000_000_000
const DAY = 86_400_000
const stat = (command: string, o: Partial<CommandStat> = {}): CommandStat => ({
  command,
  count: 1,
  lastRan: NOW - DAY,
  ...o
})

describe('rankSuggestions', () => {
  it('พิมพ์สั้นกว่า 2 ตัว → ไม่แนะนำ', () => {
    expect(rankSuggestions('d', [stat('docker ps')], NOW)).toEqual([])
  })

  it('แนะนำเฉพาะที่ขึ้นต้นตรงกันและยาวกว่าที่พิมพ์', () => {
    const stats = [stat('docker ps'), stat('ls -la'), stat('do')]
    expect(rankSuggestions('do', stats, NOW)).toEqual(['docker ps'])
  })

  it('ตัวพิมพ์ต้องตรง (กัน ghost ต่อท้ายผิด)', () => {
    expect(rankSuggestions('DO', [stat('docker ps')], NOW)).toEqual([])
  })

  it('ใช้บ่อยกว่า มาก่อน (frequency)', () => {
    const stats = [stat('git status', { count: 1 }), stat('git stash', { count: 20 })]
    expect(rankSuggestions('git st', stats, NOW)[0]).toBe('git stash')
  })

  it('ใช้ล่าสุดกว่า มาก่อน เมื่อความถี่เท่ากัน (recency)', () => {
    const stats = [
      stat('npm run build', { lastRan: NOW - 60 * DAY }),
      stat('npm run dev', { lastRan: NOW - 60_000 })
    ]
    expect(rankSuggestions('npm run ', stats, NOW)[0]).toBe('npm run dev')
  })

  it('คำสั่งที่เคยใช้บน server เดียวกัน ได้โบนัส', () => {
    const stats = [
      stat('systemctl restart nginx', { count: 3, sameServer: 0 }),
      stat('systemctl restart app', { count: 3, sameServer: 1 })
    ]
    expect(rankSuggestions('systemctl restart ', stats, NOW)[0]).toBe('systemctl restart app')
  })

  it('ตัดซ้ำ และจำกัดจำนวนตาม limit', () => {
    const stats = [stat('docker ps'), stat('docker ps'), stat('docker logs'), stat('docker exec')]
    const r = rankSuggestions('docker ', stats, NOW, 2)
    expect(r).toHaveLength(2)
    expect(new Set(r).size).toBe(2)
  })

  it('ไม่มีอะไรตรง → array ว่าง', () => {
    expect(rankSuggestions('kubectl ', [stat('docker ps')], NOW)).toEqual([])
  })
})
