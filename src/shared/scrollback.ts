// เก็บ output ล่าสุดของแต่ละ session ไว้ใน main — ใช้เล่นซ้ำเมื่อ renderer ต่อกลับ
// (เช่นหลังกด refresh) จะได้ไม่เห็นจอเปล่า ๆ ทั้งที่ shell ยังทำงานอยู่

/** เก็บย้อนหลังกี่ตัวอักษรต่อ session */
export const SCROLLBACK_MAX = 256 * 1024

/**
 * ต่อ output ใหม่เข้าไป แล้วตัดของเก่าทิ้งถ้าเกินโควตา
 * ตัดที่ท้ายบรรทัดเสมอ — ถ้าตัดกลางบรรทัดอาจไปตัดกลาง escape sequence
 * ทำให้ตอนเล่นซ้ำมีอักขระขยะโผล่หรือสีเพี้ยนทั้งจอ
 */
export function appendScrollback(buf: string, chunk: string, max = SCROLLBACK_MAX): string {
  const next = buf + chunk
  if (next.length <= max) return next

  const cut = next.slice(next.length - max)
  const nl = cut.indexOf('\n')
  // ถ้าทั้งก้อนไม่มีขึ้นบรรทัดใหม่เลย (เช่น progress bar ยาว ๆ) ก็ตัดตรง ๆ
  return nl === -1 ? cut : cut.slice(nl + 1)
}

/**
 * หาว่าข้อความที่รับมาสด ๆ ทับกับท้าย buffer ที่เล่นซ้ำไปแล้วกี่ตัว
 *
 * จำเป็นเพราะตอนต่อกลับมี ช่องว่างเสี้ยววินาที: renderer ผูก listener แล้ว
 * แต่ยังไม่ได้ buffer กลับมา — output ที่เกิดพอดีจังหวะนั้นจะมาทั้งสองทาง
 * ถ้าไม่ตัดออกจะเห็นข้อความซ้ำสองรอบ
 */
export function overlapLength(replayed: string, live: string): number {
  const maxK = Math.min(replayed.length, live.length)
  for (let k = maxK; k > 0; k--) {
    if (replayed.endsWith(live.slice(0, k))) return k
  }
  return 0
}

/** ตัดส่วนที่ซ้ำออกจากข้อความสด ก่อนเขียนต่อท้ายของที่เล่นซ้ำไปแล้ว */
export function dedupeLive(replayed: string, live: string): string {
  return live.slice(overlapLength(replayed, live))
}
