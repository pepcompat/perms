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
  /** sessionId ของ tab ที่ active ล่าสุดของแต่ละ server (คลิกเดียวเพื่อกลับไป) */
  lastActiveByServer: Record<string, string>
  addTab: (tab: TermTab) => void
  removeTab: (sessionId: string) => void
  setActive: (sessionId: string) => void
}

export const useTabs = create<TabsState>((set) => ({
  tabs: [],
  activeId: null,
  lastActiveByServer: {},
  addTab: (tab) =>
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeId: tab.sessionId,
      lastActiveByServer: tab.serverId
        ? { ...s.lastActiveByServer, [tab.serverId]: tab.sessionId }
        : s.lastActiveByServer
    })),
  removeTab: (sessionId) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.sessionId !== sessionId)
      const activeId =
        s.activeId === sessionId ? (tabs.at(-1)?.sessionId ?? null) : s.activeId
      return { tabs, activeId }
    }),
  setActive: (sessionId) =>
    set((s) => {
      const tab = s.tabs.find((t) => t.sessionId === sessionId)
      return {
        activeId: sessionId,
        lastActiveByServer: tab?.serverId
          ? { ...s.lastActiveByServer, [tab.serverId]: sessionId }
          : s.lastActiveByServer
      }
    })
}))
