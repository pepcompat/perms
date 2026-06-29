import { create } from 'zustand'
import type { AppSettings } from '@shared/types'

interface SettingsState {
  settings: AppSettings | null
  refresh: () => Promise<void>
  set: (s: AppSettings) => void
}

export const useSettings = create<SettingsState>((set) => ({
  settings: null,
  refresh: async () => set({ settings: await window.api.settings.get() }),
  set: (s) => set({ settings: s })
}))
