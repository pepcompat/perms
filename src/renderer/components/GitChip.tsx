import { useEffect, useRef, useState } from 'react'
import type { GitInfo } from '@shared/types'

/**
 * hook ดึง git branch + จำนวน commit ของโฟลเดอร์ปัจจุบันบนเซิร์ฟเวอร์ (คล้าย prompt zsh)
 * อ่าน cwd จาก prompt แล้วยิง git บนเซิร์ฟเวอร์ทุก 4 วิ — คืน null ถ้าไม่อยู่ใน git repo
 * getCwd อาจคืน null ตอนผู้ใช้กำลังพิมพ์ → คงค่าเดิมไว้ ไม่กะพริบ
 * ตัว badge วาดที่ TerminalView (วางบนบรรทัด prompt คล้าย RPROMPT ของ zsh)
 */
export function useGitInfo(
  sessionId: string,
  getCwd: () => string | null,
  enabled: boolean
): GitInfo | null {
  const [info, setInfo] = useState<GitInfo | null>(null)
  const getCwdRef = useRef(getCwd)
  getCwdRef.current = getCwd

  useEffect(() => {
    if (!enabled) {
      setInfo(null)
      return
    }
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
  }, [sessionId, enabled])

  return info
}
