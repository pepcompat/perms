import { useEffect, useRef, useState } from 'react'
import { GitBranch } from 'lucide-react'
import type { GitInfo } from '@shared/types'
import { useT } from '../lib/i18n'

/**
 * chip แสดง git branch + จำนวน commit ของโฟลเดอร์ปัจจุบันบนเซิร์ฟเวอร์ (คล้าย prompt zsh)
 * อ่าน cwd จาก prompt แล้วยิง git บนเซิร์ฟเวอร์ทุก 4 วิ — โผล่เฉพาะตอนอยู่ใน git repo
 * getCwd อาจคืน null ตอนผู้ใช้กำลังพิมพ์ → คงค่าเดิมไว้ ไม่กะพริบ
 */
export default function GitChip({
  sessionId,
  getCwd
}: {
  sessionId: string
  getCwd: () => string | null
}): JSX.Element | null {
  const t = useT()
  const [info, setInfo] = useState<GitInfo | null>(null)
  const getCwdRef = useRef(getCwd)
  getCwdRef.current = getCwd

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    const tick = async (): Promise<void> => {
      const cwd = getCwdRef.current()
      // อ่าน cwd ได้ชัด (absolute) ค่อยเช็ค git · ระหว่างพิมพ์ (null) คงค่าเดิมไว้
      if (cwd && cwd.startsWith('/')) {
        const g = await window.api.git.info(sessionId, cwd).catch(() => null)
        if (alive) setInfo(g)
      }
      timer = setTimeout(() => void tick(), 4000)
    }
    void tick()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [sessionId])

  if (!info) return null

  return (
    <div className="pointer-events-none absolute bottom-2 left-3 z-20 flex items-center gap-1.5 rounded-full border border-border/60 bg-card/85 px-2.5 py-1 text-[11px] shadow-lg backdrop-blur">
      <GitBranch className="size-3 text-[hsl(var(--success))]" />
      <span className="font-medium text-foreground">{info.branch}</span>
      {info.commits > 0 && (
        <span className="text-muted-foreground" title={t('จำนวน commit')}>
          {info.commits}
        </span>
      )}
      {info.dirty > 0 && (
        <span className="flex items-center gap-0.5 text-[hsl(var(--warning))]" title={t('ไฟล์ที่ยังไม่ commit')}>
          <span className="size-1.5 rounded-full bg-[hsl(var(--warning))]" />
          {info.dirty}
        </span>
      )}
    </div>
  )
}
