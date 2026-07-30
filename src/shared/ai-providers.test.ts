import { describe, it, expect } from 'vitest'
import { AI_PROVIDERS, AI_PROVIDER_IDS, providerMeta } from './ai-providers'

describe('AI provider registry', () => {
  it('มี provider ที่ต้องการครบ (รวมของจีน + openrouter)', () => {
    for (const id of ['openai', 'anthropic', 'google', 'openrouter', 'deepseek', 'kimi', 'glm']) {
      expect(AI_PROVIDER_IDS).toContain(id)
    }
  })

  it('ทุก provider มีข้อมูลจำเป็นครบ และ defaultModel อยู่ในลิสต์', () => {
    for (const p of AI_PROVIDERS) {
      expect(p.label).toBeTruthy()
      expect(p.keyHint).toBeTruthy()
      expect(p.keyUrl).toMatch(/^https:\/\//)
      expect(p.models.length).toBeGreaterThan(0)
      expect(p.models).toContain(p.defaultModel)
    }
  })

  it('openai-compat ต้องมี baseURL (https) · เจ้าอื่นห้ามมี', () => {
    for (const p of AI_PROVIDERS) {
      if (p.kind === 'openai-compat') {
        expect(p.baseURL).toMatch(/^https:\/\//)
      } else {
        expect(p.baseURL).toBeUndefined()
      }
    }
  })

  it('id ไม่ซ้ำกัน', () => {
    expect(new Set(AI_PROVIDER_IDS).size).toBe(AI_PROVIDER_IDS.length)
  })

  it('providerMeta คืนของถูก · id แปลก ๆ → fallback ตัวแรก', () => {
    expect(providerMeta('deepseek').label).toBe('DeepSeek')
    // @ts-expect-error ทดสอบ id ที่ไม่มีจริง
    expect(providerMeta('nope')).toBe(AI_PROVIDERS[0])
  })
})
