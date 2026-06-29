import { useCallback, useEffect, useState } from 'react'

/** จัดการความกว้างของ pane ที่ลากปรับได้ + จำค่าไว้ใน localStorage */
export function useResizable(
  key: string,
  initial: number,
  min: number,
  max: number,
  side: 'left' | 'right'
): { width: number; startDrag: (e: React.MouseEvent) => void; dragging: boolean } {
  const [width, setWidth] = useState<number>(() => {
    const saved = localStorage.getItem(key)
    const n = saved ? Number(saved) : NaN
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : initial
  })
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    localStorage.setItem(key, String(Math.round(width)))
  }, [key, width])

  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startW = width
      setDragging(true)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const onMove = (ev: MouseEvent): void => {
        const delta = side === 'left' ? ev.clientX - startX : startX - ev.clientX
        setWidth(Math.min(max, Math.max(min, startW + delta)))
      }
      const onUp = (): void => {
        setDragging(false)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [width, min, max, side]
  )

  return { width, startDrag, dragging }
}

/** แถบจับลากบาง ๆ ระหว่าง pane */
export function Resizer({
  onMouseDown,
  active
}: {
  onMouseDown: (e: React.MouseEvent) => void
  active: boolean
}): JSX.Element {
  return (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={(e) => e.preventDefault()}
      className={`no-drag group relative z-10 flex w-1 shrink-0 cursor-col-resize items-stretch ${
        active ? 'bg-primary/60' : 'bg-transparent hover:bg-primary/40'
      } transition-colors`}
    >
      {/* hit area กว้างขึ้นให้คลิกง่าย */}
      <span className="absolute inset-y-0 -left-1.5 -right-1.5" />
    </div>
  )
}
