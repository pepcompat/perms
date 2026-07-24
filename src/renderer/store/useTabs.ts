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
  /** สร้าง tab กลับจาก session ที่ยังเปิดอยู่ใน main (หลัง refresh / renderer โหลดใหม่) */
  restoreTabs: (tabs: TermTab[]) => void
}

const ACTIVE_KEY = 'ui.activeSession'

function rememberActive(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
  } catch {
    /* localStorage ใช้ไม่ได้ — ไม่ใช่เรื่องคอขาดบาดตาย */
  }
}

export const useTabs = create<TabsState>((set) => ({
  tabs: [],
  activeId: null,
  lastActiveByServer: {},
  addTab: (tab) =>
    set((s) => {
      rememberActive(tab.sessionId)
      return {
        tabs: [...s.tabs, tab],
        activeId: tab.sessionId,
        lastActiveByServer: tab.serverId
          ? { ...s.lastActiveByServer, [tab.serverId]: tab.sessionId }
          : s.lastActiveByServer
      }
    }),
  restoreTabs: (tabs) =>
    set(() => {
      let saved: string | null = null
      try {
        saved = localStorage.getItem(ACTIVE_KEY)
      } catch {
        /* ข้าม */
      }
      // tab ที่เคย active อาจถูกปิดไปแล้วระหว่างนั้น → ถอยไปใช้ตัวสุดท้าย
      const activeId = tabs.some((t) => t.sessionId === saved)
        ? saved
        : (tabs.at(-1)?.sessionId ?? null)
      const lastActiveByServer: Record<string, string> = {}
      for (const t of tabs) if (t.serverId) lastActiveByServer[t.serverId] = t.sessionId
      return { tabs, activeId, lastActiveByServer }
    }),
  removeTab: (sessionId) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.sessionId !== sessionId)
      const activeId =
        s.activeId === sessionId ? (tabs.at(-1)?.sessionId ?? null) : s.activeId
      if (activeId !== s.activeId) rememberActive(activeId)
      return { tabs, activeId }
    }),
  setActive: (sessionId) =>
    set((s) => {
      const tab = s.tabs.find((t) => t.sessionId === sessionId)
      rememberActive(sessionId)
      return {
        activeId: sessionId,
        lastActiveByServer: tab?.serverId
          ? { ...s.lastActiveByServer, [tab.serverId]: sessionId }
          : s.lastActiveByServer
      }
    })
}))
