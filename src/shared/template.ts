// Template คำสั่งที่มีช่องกรอก — placeholder รูปแบบ {{name}}
// ใช้ร่วมกันทั้ง main (AI run_runbook) และ renderer (ฟอร์มกรอกค่า)

const PLACEHOLDER_RE = /\{\{\s*([\w.-]+)\s*\}\}/g

/** ดึงชื่อ placeholder ที่ไม่ซ้ำจากข้อความเดียว เรียงตามลำดับที่พบ */
export function extractPlaceholders(text: string): string[] {
  const seen = new Set<string>()
  for (const m of text.matchAll(PLACEHOLDER_RE)) seen.add(m[1])
  return [...seen]
}

/** ดึง placeholder จากหลายบรรทัด/หลาย step รวมกัน (ไม่ซ้ำ เรียงตามลำดับที่พบ) */
export function extractPlaceholdersAll(texts: string[]): string[] {
  const seen = new Set<string>()
  for (const t of texts) for (const p of extractPlaceholders(t)) seen.add(p)
  return [...seen]
}

/** แทนค่า {{name}} ด้วย values[name]; ถ้าไม่มี key นั้นเลย คงข้อความเดิมไว้ */
export function fillTemplate(text: string, values: Record<string, string>): string {
  return text.replace(PLACEHOLDER_RE, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : whole
  )
}
