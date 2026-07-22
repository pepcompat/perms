// ชั้นกรองคำสั่งของ AI ก่อนรันจริง — ต่อยอดจาก dangerous-commands.ts
// dangerous-commands = "คำสั่งนี้อันตรายโดยธรรมชาติไหม"
// ai-guard        = "ตามนโยบายที่ผู้ใช้ตั้งไว้ ควรปล่อย / ถาม / บล็อค"

export type GuardAction = 'allow' | 'confirm' | 'block'

export interface GuardPolicy {
  /** regex (string) ที่ถ้าคำสั่งเข้าเงื่อนไข = บล็อคทันที ไม่ต้องถาม */
  denyPatterns: string[]
  /** บังคับขออนุมัติทุกคำสั่งที่เขียน/เปลี่ยนแปลง แม้อยู่โหมด agentic */
  requireApprovalForAll: boolean
  /** จำนวนคำสั่งสูงสุดต่อการสนทนา 1 รอบ (กัน loop รันรัว ๆ) — 0 = ไม่จำกัด */
  maxCallsPerRun: number
}

export const DEFAULT_GUARD_POLICY: GuardPolicy = {
  denyPatterns: [],
  requireApprovalForAll: false,
  maxCallsPerRun: 25
}

export interface GuardInput {
  toolName: string
  args: Record<string, unknown>
  /** tool นี้เปลี่ยนแปลงระบบไหม (มาจาก MUTATING_TOOLS) */
  mutating: boolean
  /** เหตุผลจาก dangerous-commands (null = ไม่เข้าข่ายอันตราย) */
  dangerReason: string | null
  /** คำสั่งนี้เป็นลำดับที่เท่าไรของรอบนี้ (เริ่ม 0) */
  callIndex: number
  mode: 'suggest' | 'approve' | 'agentic'
  policy: GuardPolicy
}

export interface GuardVerdict {
  action: GuardAction
  /** เหตุผลทั้งหมด — เอาไปโชว์ใน payload preview ให้ผู้ใช้เห็นว่าทำไมต้องถาม/ถูกบล็อค */
  reasons: string[]
}

/** ดึงข้อความคำสั่งจาก arguments (tool ต่างกันใช้คีย์ต่างกัน) */
export function commandTextOf(args: Record<string, unknown>): string {
  const c = args.command ?? args.cmd ?? args.script
  return typeof c === 'string' ? c : ''
}

function safeRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, 'i')
  } catch {
    return null // ผู้ใช้พิมพ์ regex ผิด — ข้ามไป ดีกว่าทำให้ทั้งระบบพัง
  }
}

/**
 * ตัดสินว่าจะทำอะไรกับ tool call นี้
 * ลำดับความสำคัญ: บล็อคก่อนเสมอ → แล้วค่อยพิจารณาว่าต้องถามไหม → ไม่งั้นปล่อย
 */
export function evaluateCall(input: GuardInput): GuardVerdict {
  const reasons: string[] = []

  // tool อ่านอย่างเดียว ไม่ต้องกรอง
  if (!input.mutating) return { action: 'allow', reasons }

  const cmd = commandTextOf(input.args)

  // 1) เกินโควตาคำสั่งต่อรอบ = บล็อค (กัน agent วนรันไม่จบ)
  if (input.policy.maxCallsPerRun > 0 && input.callIndex >= input.policy.maxCallsPerRun) {
    reasons.push(`เกินขีดจำกัด ${input.policy.maxCallsPerRun} คำสั่งต่อรอบ`)
    return { action: 'block', reasons }
  }

  // 2) เข้าเงื่อนไข deny ที่ผู้ใช้ตั้งเอง = บล็อค
  for (const p of input.policy.denyPatterns) {
    if (!p.trim()) continue
    const re = safeRegex(p)
    if (re && cmd && re.test(cmd)) {
      reasons.push(`ตรงกับรูปแบบที่ห้ามไว้: ${p}`)
      return { action: 'block', reasons }
    }
  }

  // 3) โหมดแนะนำ ไม่รันอยู่แล้ว
  if (input.mode === 'suggest') {
    reasons.push('โหมดแนะนำ — ไม่รันให้อัตโนมัติ')
    return { action: 'block', reasons }
  }

  // 4) คำสั่งอันตราย = ถามเสมอ แม้โหมด agentic
  if (input.dangerReason) {
    reasons.push(input.dangerReason)
    return { action: 'confirm', reasons }
  }

  // 5) ตามโหมด / นโยบาย
  if (input.mode === 'approve' || input.policy.requireApprovalForAll) {
    reasons.push(
      input.mode === 'approve' ? 'โหมดอนุมัติก่อนรัน' : 'ตั้งค่าให้ขออนุมัติทุกคำสั่ง'
    )
    return { action: 'confirm', reasons }
  }

  return { action: 'allow', reasons }
}

/** ข้อมูลที่ส่งให้ UI แสดงก่อนผู้ใช้กดอนุมัติ */
export interface PayloadPreview {
  toolName: string
  command: string
  /** อาร์กิวเมนต์อื่น ๆ นอกจากคำสั่ง (โชว์เป็นตาราง) */
  extraArgs: { key: string; value: string }[]
  /** ปลายทางที่จะรัน — เช่น "web-01 (deploy@10.0.0.5:22)" หรือ "เครื่องนี้ (local)" */
  target: string
  reasons: string[]
  danger: string | null
}

/** ย่ออาร์กิวเมนต์ให้อ่านง่าย ตัดของยาวเกิน และไม่โชว์คำสั่งซ้ำ */
export function buildExtraArgs(args: Record<string, unknown>): { key: string; value: string }[] {
  const skip = new Set(['command', 'cmd', 'script'])
  return Object.entries(args)
    .filter(([k]) => !skip.has(k))
    .map(([key, v]) => {
      const s = typeof v === 'string' ? v : JSON.stringify(v)
      return { key, value: s.length > 200 ? `${s.slice(0, 200)}…` : s }
    })
}
