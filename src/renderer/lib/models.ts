import type { AiProvider } from '@shared/types'
import { AI_PROVIDERS } from '@shared/ai-providers'

// derive จาก registry กลาง (src/shared/ai-providers.ts) — จุดเดียวที่นิยาม provider/โมเดล
// พิมพ์ชื่อโมเดลเองได้ถ้าไม่มีในลิสต์
export const MODEL_PRESETS = Object.fromEntries(
  AI_PROVIDERS.map((p) => [p.id, p.models])
) as Record<AiProvider, string[]>

export const PROVIDER_LABEL = Object.fromEntries(
  AI_PROVIDERS.map((p) => [p.id, p.label])
) as Record<AiProvider, string>
