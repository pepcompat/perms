import { create } from 'zustand'

// prompt แบบ async ในแอป — แทน window.prompt() ที่ Electron ไม่รองรับ (คืน null เสมอ)
// ใช้: const name = await promptText({ title: 'ชื่อโฟลเดอร์ใหม่' })

export interface PromptOptions {
  title: string
  description?: string
  placeholder?: string
  defaultValue?: string
  confirmText?: string
}

interface PromptRequest extends PromptOptions {
  resolve: (value: string | null) => void
}

interface PromptState {
  req: PromptRequest | null
  open: (opts: PromptOptions) => Promise<string | null>
  submit: (value: string) => void
  cancel: () => void
}

export const usePrompt = create<PromptState>((set, get) => ({
  req: null,
  open: (opts) =>
    new Promise<string | null>((resolve) => {
      // ถ้ามีอันเก่าค้าง ให้ยกเลิกก่อน (คืน null) กัน promise ลอย
      const prev = get().req
      prev?.resolve(null)
      set({ req: { ...opts, resolve } })
    }),
  submit: (value) => {
    const r = get().req
    if (r) {
      r.resolve(value)
      set({ req: null })
    }
  },
  cancel: () => {
    const r = get().req
    if (r) {
      r.resolve(null)
      set({ req: null })
    }
  }
}))

/** ทางลัดเรียกใช้นอก component */
export const promptText = (opts: PromptOptions): Promise<string | null> =>
  usePrompt.getState().open(opts)
