import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastState {
  toasts: Toast[]
  push: (message: string, type?: ToastType) => void
  dismiss: (id: number) => void
}

let seq = 0

export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, type = 'success') => {
    const id = ++seq
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => get().dismiss(id), 2600)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}))

/** เรียกใช้นอก React ได้ */
export const toast = (message: string, type?: ToastType): void =>
  useToast.getState().push(message, type)
