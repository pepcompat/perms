import type { AiProvider } from '@shared/types'

/** preset โมเดลให้เลือก (พิมพ์เองได้ถ้าไม่มีในลิสต์) — ใช้ร่วมกัน Settings + AI input */
export const MODEL_PRESETS: Record<AiProvider, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o3', 'o4-mini', 'gpt-4-turbo'],
  anthropic: [
    'claude-opus-4-8',
    'claude-sonnet-4-6',
    'claude-haiku-4-5-20251001',
    'claude-fable-5',
    'claude-3-7-sonnet-latest',
    'claude-3-5-haiku-latest'
  ],
  google: [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.0-pro',
    'gemini-1.5-pro',
    'gemini-1.5-flash'
  ]
}

export const PROVIDER_LABEL: Record<AiProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google'
}
