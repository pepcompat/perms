// เปรียบเทียบข้อความทีละบรรทัดด้วย LCS — ใช้โชว์ diff ของ snapshot ไฟล์
// (บริสุทธิ์ ไม่พึ่ง node/electron จะได้เทสได้และใช้ได้ทั้ง main/renderer)

export type DiffOp = 'eq' | 'add' | 'del'

export interface DiffLine {
  op: DiffOp
  text: string
  /** เลขบรรทัดฝั่งเดิม (1-based) — null ถ้าเป็นบรรทัดที่เพิ่มเข้ามา */
  aLine: number | null
  /** เลขบรรทัดฝั่งใหม่ (1-based) — null ถ้าเป็นบรรทัดที่ถูกลบ */
  bLine: number | null
}

// เพดานขนาดตาราง DP — เกินนี้ถือว่าไฟล์ใหญ่เกินจะทำ LCS เต็มรูปแบบ
// (2000×2000 = 4M ช่อง × 4 ไบต์ ≈ 16MB ซึ่งยังรับไหว)
const MAX_CELLS = 4_000_000

export function splitLines(s: string): string[] {
  if (s === '') return []
  return s.replace(/\r\n/g, '\n').split('\n')
}

/**
 * diff ทีละบรรทัด — ตัดส่วนหัว/ท้ายที่เหมือนกันออกก่อน แล้วค่อยทำ LCS เฉพาะช่วงกลาง
 * ถ้าช่วงกลางยังใหญ่เกินเพดาน จะถอยไปเป็น "ลบทั้งก้อน แล้วเพิ่มทั้งก้อน" แทน
 * (ยังถูกต้อง เพียงแต่ละเอียดน้อยลง) — ดีกว่าค้างหรือกินแรมจนแอปตาย
 */
export function diffLines(aText: string, bText: string): DiffLine[] {
  const a = splitLines(aText)
  const b = splitLines(bText)

  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head++

  let tail = 0
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  ) {
    tail++
  }

  const out: DiffLine[] = []
  for (let i = 0; i < head; i++) {
    out.push({ op: 'eq', text: a[i], aLine: i + 1, bLine: i + 1 })
  }

  const aMid = a.slice(head, a.length - tail)
  const bMid = b.slice(head, b.length - tail)

  if (aMid.length * bMid.length > MAX_CELLS) {
    aMid.forEach((t, i) => out.push({ op: 'del', text: t, aLine: head + i + 1, bLine: null }))
    bMid.forEach((t, i) => out.push({ op: 'add', text: t, aLine: null, bLine: head + i + 1 }))
  } else {
    out.push(...lcsDiff(aMid, bMid, head))
  }

  for (let i = 0; i < tail; i++) {
    const ai = a.length - tail + i
    const bi = b.length - tail + i
    out.push({ op: 'eq', text: a[ai], aLine: ai + 1, bLine: bi + 1 })
  }
  return out
}

function lcsDiff(a: string[], b: string[], offset: number): DiffLine[] {
  const n = a.length
  const m = b.length
  if (n === 0 && m === 0) return []
  if (n === 0) return b.map((t, i) => ({ op: 'add' as const, text: t, aLine: null, bLine: offset + i + 1 }))
  if (m === 0) return a.map((t, i) => ({ op: 'del' as const, text: t, aLine: offset + i + 1, bLine: null }))

  // dp[i][j] = ความยาว LCS ของ a[i..] กับ b[j..] — เก็บเป็น flat array กันสร้าง object เยอะ
  const w = m + 1
  const dp = new Uint32Array((n + 1) * w)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] =
        a[i] === b[j]
          ? dp[(i + 1) * w + (j + 1)] + 1
          : Math.max(dp[(i + 1) * w + j], dp[i * w + (j + 1)])
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ op: 'eq', text: a[i], aLine: offset + i + 1, bLine: offset + j + 1 })
      i++
      j++
    } else if (dp[(i + 1) * w + j] >= dp[i * w + (j + 1)]) {
      out.push({ op: 'del', text: a[i], aLine: offset + i + 1, bLine: null })
      i++
    } else {
      out.push({ op: 'add', text: b[j], aLine: null, bLine: offset + j + 1 })
      j++
    }
  }
  while (i < n) {
    out.push({ op: 'del', text: a[i], aLine: offset + i + 1, bLine: null })
    i++
  }
  while (j < m) {
    out.push({ op: 'add', text: b[j], aLine: null, bLine: offset + j + 1 })
    j++
  }
  return out
}

export interface DiffStat {
  added: number
  removed: number
  changed: boolean
}

export function diffStat(lines: DiffLine[]): DiffStat {
  let added = 0
  let removed = 0
  for (const l of lines) {
    if (l.op === 'add') added++
    else if (l.op === 'del') removed++
  }
  return { added, removed, changed: added > 0 || removed > 0 }
}

/**
 * ยุบบรรทัดที่เหมือนกันยาว ๆ ให้เหลือแค่ context รอบจุดที่เปลี่ยน
 * คืนเป็น "hunk" พร้อมจำนวนบรรทัดที่ถูกซ่อน เพื่อให้ UI แสดง "… ซ่อน N บรรทัด"
 */
export interface DiffHunk {
  lines: DiffLine[]
  /** จำนวนบรรทัดเหมือนกันที่ถูกซ่อนก่อนหน้า hunk นี้ */
  skippedBefore: number
}

export function toHunks(lines: DiffLine[], context = 3): DiffHunk[] {
  const keep = new Array<boolean>(lines.length).fill(false)
  lines.forEach((l, i) => {
    if (l.op === 'eq') return
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) {
      keep[k] = true
    }
  })

  const hunks: DiffHunk[] = []
  let cur: DiffLine[] = []
  let skipped = 0
  let pendingSkip = 0

  for (let i = 0; i < lines.length; i++) {
    if (keep[i]) {
      if (cur.length === 0) {
        skipped = pendingSkip
        pendingSkip = 0
      }
      cur.push(lines[i])
    } else {
      if (cur.length) {
        hunks.push({ lines: cur, skippedBefore: skipped })
        cur = []
      }
      pendingSkip++
    }
  }
  if (cur.length) hunks.push({ lines: cur, skippedBefore: skipped })
  return hunks
}
