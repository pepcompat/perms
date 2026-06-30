import { create } from 'zustand'

interface AiDraftState {
  /** เพิ่มทุกครั้งที่มีการ "ส่งเข้า AI" เพื่อให้ AISidebar จับการเปลี่ยนแปลง */
  seq: number
  text: string
  /** ส่งข้อความ (เช่น output จาก terminal) ไปเติมในช่อง input ของ AI */
  send: (text: string) => void
}

export const useAiDraft = create<AiDraftState>((set) => ({
  seq: 0,
  text: '',
  send: (text) => set((s) => ({ seq: s.seq + 1, text }))
}))
