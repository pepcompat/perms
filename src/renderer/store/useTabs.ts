import { create } from 'zustand'
import type { SessionKind } from '@shared/types'

export interface TermTab {
  sessionId: string
  title: string
  kind: SessionKind
  serverId: string | null
}

interface TabsState {
  tabs: TermTab[]
  activeId: string | null
  addTab: (tab: TermTab) => void
  removeTab: (sessionId: string) => void
  setActive: (sessionId: string) => void
}

export const useTabs = create<TabsState>((set) => ({
  tabs: [],
  activeId: null,
  addTab: (tab) =>
    set((s) => ({ tabs: [...s.tabs, tab], activeId: tab.sessionId })),
  removeTab: (sessionId) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.sessionId !== sessionId)
      const activeId =
        s.activeId === sessionId ? (tabs.at(-1)?.sessionId ?? null) : s.activeId
      return { tabs, activeId }
    }),
  setActive: (sessionId) => set({ activeId: sessionId })
}))
