import { useCallback, useState } from 'react'

// เก็บค่าการตั้งค่า UI เล็ก ๆ (ย่อ/ขยาย ฯลฯ) ไว้ใน localStorage
// แยกออกมาเป็น hook เพราะมีหลายจุดต้องใช้ และเขียน try/catch ซ้ำ ๆ ทุกที่ก็รก
// (localStorage อาจใช้ไม่ได้ในบางสภาพแวดล้อม — ห้ามให้พังทั้งหน้าจอเพราะเรื่องนี้)

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ข้าม — แค่จำค่าไม่ได้ ไม่ใช่เรื่องคอขาดบาดตาย */
  }
}

/** true/false ที่จำไว้ข้ามการเปิดแอป เช่น "ย่อแถบ server ไว้ไหม" */
export function usePersistedFlag(
  key: string,
  initial: boolean
): [boolean, (v: boolean | ((prev: boolean) => boolean)) => void] {
  const [value, setValue] = useState<boolean>(() => read(key, initial))
  const set = useCallback(
    (v: boolean | ((prev: boolean) => boolean)) => {
      setValue((prev) => {
        const next = typeof v === 'function' ? v(prev) : v
        write(key, next)
        return next
      })
    },
    [key]
  )
  return [value, set]
}

/** เซ็ตของ id ที่จำไว้ เช่น "compose stack ไหนถูกย่อไว้บ้าง" */
export function usePersistedSet(key: string): {
  has: (id: string) => boolean
  toggle: (id: string) => void
  set: (ids: string[]) => void
} {
  const [ids, setIds] = useState<Set<string>>(() => new Set(read<string[]>(key, [])))

  const has = useCallback((id: string) => ids.has(id), [ids])

  const toggle = useCallback(
    (id: string) => {
      setIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        write(key, [...next])
        return next
      })
    },
    [key]
  )

  const set = useCallback(
    (list: string[]) => {
      const next = new Set(list)
      write(key, list)
      setIds(next)
    },
    [key]
  )

  return { has, toggle, set }
}
