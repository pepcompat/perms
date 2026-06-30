import { getDb } from '../index'
import { upsertSecret, deleteSecret, revealSecret } from '../../secrets/safe-store'
import type { AiProvider, AiMode, AppSettings, AiSettings } from '@shared/types'

const DEFAULT_MODELS: Record<AiProvider, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-opus-4-8',
  google: 'gemini-2.0-flash'
}

const PROVIDERS: AiProvider[] = ['openai', 'anthropic', 'google']

function getRaw(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

function setRaw(key: string, value: string): void {
  getDb()
    .prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    )
    .run(key, value)
}

function deleteRaw(key: string): void {
  getDb().prepare('DELETE FROM settings WHERE key = ?').run(key)
}

function apiKeySecretKey(provider: AiProvider): string {
  return `ai.${provider}.secretId`
}

function modelKey(provider: AiProvider): string {
  return `ai.${provider}.model`
}

export function getAiSettings(): AiSettings {
  const models = { ...DEFAULT_MODELS }
  const configured = {} as Record<AiProvider, boolean>
  for (const p of PROVIDERS) {
    const m = getRaw(modelKey(p))
    if (m) models[p] = m
    configured[p] = !!getRaw(apiKeySecretKey(p))
  }
  return {
    defaultProvider: (getRaw('ai.defaultProvider') as AiProvider) ?? 'anthropic',
    defaultMode: (getRaw('ai.defaultMode') as AiMode) ?? 'approve',
    models,
    configured
  }
}

export function getAppSettings(): AppSettings {
  return {
    ai: getAiSettings(),
    theme: getRaw('theme') ?? 'dark',
    // optimistic — ตรวจจริง (และเข้าถึง Keychain) เฉพาะตอนบันทึก/ใช้ secret จริง
    // เพื่อไม่ให้ macOS เด้งขอ Keychain ตั้งแต่เปิดแอป
    encryptionAvailable: true
  }
}

export function setAiKey(provider: AiProvider, apiKey: string): void {
  const existing = getRaw(apiKeySecretKey(provider))
  const secretId = upsertSecret(existing, 'api_key', apiKey)
  setRaw(apiKeySecretKey(provider), secretId)
}

export function clearAiKey(provider: AiProvider): void {
  const existing = getRaw(apiKeySecretKey(provider))
  if (existing) deleteSecret(existing)
  deleteRaw(apiKeySecretKey(provider))
}

/** คืน API key ดิบ สำหรับใช้ภายใน main เท่านั้น */
export function revealAiKey(provider: AiProvider): string | null {
  const secretId = getRaw(apiKeySecretKey(provider))
  return revealSecret(secretId)
}

export function updateAiSettings(patch: {
  defaultProvider?: AiProvider
  defaultMode?: AiMode
  models?: Partial<Record<AiProvider, string>>
}): void {
  if (patch.defaultProvider) setRaw('ai.defaultProvider', patch.defaultProvider)
  if (patch.defaultMode) setRaw('ai.defaultMode', patch.defaultMode)
  if (patch.models) {
    for (const p of PROVIDERS) {
      const m = patch.models[p]
      if (m) setRaw(modelKey(p), m)
    }
  }
}

export function setTheme(theme: string): void {
  setRaw('theme', theme)
}
