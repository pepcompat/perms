import type { AiProvider } from './types'

// registry กลางของ AI provider — source of truth เดียว ใช้ทั้ง main และ renderer
// provider จีน/รวม (openrouter, deepseek, kimi, glm) เป็น OpenAI-compatible ทั้งหมด
// → ใช้ SDK ของ openai ตัวเดิม แค่เปลี่ยน baseURL

export type ProviderKind = 'openai' | 'anthropic' | 'google' | 'openai-compat' | 'cli'

export interface ProviderMeta {
  id: AiProvider
  label: string
  /** ใช้ SDK ตัวไหน — 'openai-compat' = openai SDK + baseURL */
  kind: ProviderKind
  /** endpoint สำหรับ openai-compat */
  baseURL?: string
  /** โมเดลให้เลือก (พิมพ์เองได้ถ้าไม่มีในลิสต์) */
  models: string[]
  /** โมเดลเริ่มต้น */
  defaultModel: string
  /** hint ในช่องกรอก API key */
  keyHint: string
  /** ลิงก์ไปหน้าออก API key */
  keyUrl: string
  /** คำอธิบายสั้น ๆ โชว์ใน UI */
  note?: string
  /** kind 'cli': ชื่อโปรแกรม + คำสั่ง login ที่ให้ผู้ใช้รันเองใน terminal */
  cli?: { bin: 'codex' | 'claude'; loginCommand: string; experimental?: boolean }
}

export const AI_PROVIDERS: ProviderMeta[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    kind: 'openai',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o3', 'o4-mini', 'gpt-4-turbo'],
    defaultModel: 'gpt-4o',
    keyHint: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys'
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    kind: 'anthropic',
    models: [
      'claude-opus-5-5',
      'claude-sonnet-5-5',
      'claude-haiku-5-5',
      'claude-fable-5-1',
      'claude-opus-4-8',
      'claude-sonnet-4-6',
      'claude-haiku-4-5'
    ],
    defaultModel: 'claude-opus-5-5',
    keyHint: 'sk-ant-…',
    keyUrl: 'https://console.anthropic.com/settings/keys'
  },
  {
    id: 'google',
    label: 'Google Gemini',
    kind: 'google',
    models: [
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-2.0-pro',
      'gemini-1.5-pro',
      'gemini-1.5-flash'
    ],
    defaultModel: 'gemini-2.0-flash',
    keyHint: 'AIza…',
    keyUrl: 'https://aistudio.google.com/apikey'
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'openai-compat',
    baseURL: 'https://openrouter.ai/api/v1',
    models: [
      'deepseek/deepseek-chat',
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'google/gemini-2.0-flash-exp:free',
      'meta-llama/llama-3.3-70b-instruct',
      'qwen/qwen-2.5-72b-instruct',
      'moonshotai/kimi-k2'
    ],
    defaultModel: 'deepseek/deepseek-chat',
    keyHint: 'sk-or-…',
    keyUrl: 'https://openrouter.ai/keys',
    note: 'รวมหลายโมเดลไว้ในที่เดียว (จ่ายผ่านเครดิตเดียว)'
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: 'openai-compat',
    baseURL: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
    keyHint: 'sk-…',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    note: 'โมเดลจีน คุ้มค่า เขียนโค้ด/เหตุผลดี'
  },
  {
    id: 'kimi',
    label: 'Kimi (Moonshot)',
    kind: 'openai-compat',
    baseURL: 'https://api.moonshot.ai/v1',
    models: ['kimi-k2-0711-preview', 'moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    defaultModel: 'moonshot-v1-8k',
    keyHint: 'sk-…',
    keyUrl: 'https://platform.moonshot.ai/console/api-keys',
    note: 'โมเดลจีน context ยาว'
  },
  {
    id: 'glm',
    label: 'GLM (Zhipu)',
    kind: 'openai-compat',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-plus', 'glm-4', 'glm-4-air', 'glm-4-flash', 'glm-4v-plus'],
    defaultModel: 'glm-4-flash',
    keyHint: '••••••.••••••',
    keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    note: 'โมเดลจีน (智谱 GLM)'
  },
  {
    id: 'codex-cli',
    label: 'ChatGPT (subscription)',
    kind: 'cli',
    // 'default' = ตามที่ตั้งใน ~/.codex/config.toml · พิมพ์ชื่ออื่นเองได้
    models: ['default', 'gpt-6-luna', 'gpt-5.6-terra', 'gpt-5.6-luna'],
    defaultModel: 'default',
    keyHint: 'codex login',
    keyUrl: 'https://developers.openai.com/codex/auth',
    note: 'ใช้แพ็ก ChatGPT ของคุณผ่าน Codex CLI ที่ติดตั้งและ login ไว้ในเครื่อง — Perms ไม่เห็น/ไม่เก็บ token',
    cli: { bin: 'codex', loginCommand: 'codex login' }
  },
  {
    id: 'claude-cli',
    label: 'Claude (subscription · ทดลอง)',
    kind: 'cli',
    models: ['default', 'opus', 'sonnet', 'haiku'],
    defaultModel: 'default',
    keyHint: 'claude auth login',
    keyUrl: 'https://code.claude.com/docs/en/legal-and-compliance',
    note: 'ใช้แพ็ก Claude ของคุณผ่าน Claude Code CLI ที่ติดตั้งและ login ไว้ในเครื่อง — Perms ไม่เห็น/ไม่เก็บ token',
    cli: { bin: 'claude', loginCommand: 'claude auth login', experimental: true }
  }
]

export const AI_PROVIDER_IDS = AI_PROVIDERS.map((p) => p.id)

export function providerMeta(id: AiProvider): ProviderMeta {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0]
}
