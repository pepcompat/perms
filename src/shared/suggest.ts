// จัดอันดับคำแนะนำคำสั่ง (ghost text) — pure, เทสต์ได้
// หลักการ: ต้อง prefix ตรงตัวพิมพ์ (เพื่อให้ ghost ต่อท้ายได้ถูกต้อง) แล้วจัดอันดับด้วย
// frecency = ความถี่ (count) + ความสด (lastRan) + โบนัสถ้าเคยใช้บน server เดียวกัน

export interface CommandStat {
  command: string
  /** จำนวนครั้งที่เคยรัน */
  count: number
  /** epoch ms ของครั้งล่าสุด */
  lastRan: number
  /** 1 = เคยรันบน server/เครื่องเดียวกับ session ปัจจุบัน */
  sameServer?: number
}

const DAY = 86_400_000

/** คะแนนความสด: ยิ่งใช้ล่าสุดยิ่งได้เยอะ */
function recencyScore(now: number, lastRan: number): number {
  const days = Math.max(0, (now - lastRan) / DAY)
  if (days < 1) return 20
  if (days < 7) return 14
  if (days < 30) return 8
  return 3
}

/**
 * คืนคำสั่งที่แนะนำ เรียงจากดีสุด
 * @param input บรรทัดที่ผู้ใช้พิมพ์อยู่
 * @param stats ประวัติคำสั่งพร้อมสถิติ
 * @param now epoch ms ปัจจุบัน (ส่งเข้ามาเพื่อให้ pure/เทสต์ได้)
 */
export function rankSuggestions(
  input: string,
  stats: CommandStat[],
  now: number,
  limit = 3
): string[] {
  if (input.length < 2) return []
  const scored: { cmd: string; score: number }[] = []
  const seen = new Set<string>()

  for (const s of stats) {
    const cmd = s.command
    // ต้องขึ้นต้นตรงกันเป๊ะ และยาวกว่าที่พิมพ์ (มีส่วนต่อให้แนะนำ)
    if (cmd.length <= input.length || !cmd.startsWith(input)) continue
    if (seen.has(cmd)) continue
    seen.add(cmd)
    const freq = Math.log2(1 + Math.max(1, s.count)) * 8
    const score = 100 + freq + recencyScore(now, s.lastRan) + (s.sameServer ? 25 : 0)
    scored.push({ cmd, score })
  }

  scored.sort((a, b) => b.score - a.score || a.cmd.length - b.cmd.length)
  return scored.slice(0, limit).map((s) => s.cmd)
}
