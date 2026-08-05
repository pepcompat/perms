// แปลง "การแก้ไขบรรทัด" ในเทอร์มินัล (คลิกวาง cursor / ลบทั้งบรรทัด / ลบส่วนที่ลากคลุม)
// ให้เป็นซีเควนซ์คีย์ที่ shell เข้าใจ — เพราะ shell (bash/zsh) เป็นเจ้าของ line buffer เราแก้ตรงๆ ไม่ได้
// อาศัย readline/zle: ←/→ = ถอย/เดินหน้าทีละตัว · ^E = ไปท้ายบรรทัด · ^U = ลบทั้งบรรทัด · DEL(0x7f) = ลบถอยหลัง

const LEFT = '\x1b[D'
const RIGHT = '\x1b[C'
const BACKSPACE = '\x7f'

/** ^E (ไปท้ายบรรทัด) + ^U (ลบจากเคอร์เซอร์ถึงต้นบรรทัด) → ลบทั้งบรรทัดไม่ว่าเคอร์เซอร์อยู่ตรงไหน */
export const KILL_LINE = '\x05\x15'

/** ซีเควนซ์ลูกศรย้ายเคอร์เซอร์จากคอลัมน์ from → to (บวก = ไปขวา, ลบ = ไปซ้าย) */
export function moveCursorSeq(fromCol: number, toCol: number): string {
  const d = Math.round(toCol) - Math.round(fromCol)
  if (d === 0) return ''
  return (d > 0 ? RIGHT : LEFT).repeat(Math.abs(d))
}

/** คอลัมน์/แถวของจุดที่คลิก อิงกริดเซลล์จริงของ xterm (rect = กล่องของ .xterm-screen)
 *  ปัดคอลัมน์ให้ใกล้ "ช่องว่างระหว่างตัวอักษร" ที่สุด → วางเคอร์เซอร์ได้ตรงใจ */
export function cellFromPoint(
  x: number,
  y: number,
  rect: { left: number; top: number; width: number; height: number },
  cols: number,
  rows: number
): { col: number; row: number } {
  const cellW = cols > 0 ? rect.width / cols : 0
  const cellH = rows > 0 ? rect.height / rows : 0
  const col = cellW > 0 ? Math.max(0, Math.round((x - rect.left) / cellW)) : 0
  const row = cellH > 0 ? Math.floor((y - rect.top) / cellH) : 0
  return { col, row }
}

/** ลบข้อความที่ลากคลุมไว้บนบรรทัดเดียว: ย้ายเคอร์เซอร์ไปท้ายช่วง แล้ว backspace เท่าจำนวนตัวอักษร
 *  cursorX = ตำแหน่งเคอร์เซอร์ปัจจุบัน, startX = คอลัมน์แรกที่เลือก, charCount = จำนวนตัวอักษรที่เลือก */
export function deleteSelectionSeq(cursorX: number, startX: number, charCount: number): string {
  if (charCount <= 0) return ''
  return moveCursorSeq(cursorX, startX + charCount) + BACKSPACE.repeat(charCount)
}
