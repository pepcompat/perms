import { useEffect, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'
import type { UpdateProgress } from '@shared/types'
import { Button } from './ui/button'
import { useT } from '../lib/i18n'

type Phase = 'idle' | 'downloading' | 'ready'

export default function UpdateToast(): JSX.Element | null {
  const t = useT()
  const [phase, setPhase] = useState<Phase>('idle')
  const [version, setVersion] = useState('')
  const [percent, setPercent] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const offAvail = window.api.updates.onAvailable((v) => {
      setVersion(v)
      setPhase('downloading')
      setDismissed(false)
    })
    const offProg = window.api.updates.onProgress((p: UpdateProgress) =>
      setPercent(Math.round(p.percent))
    )
    const offDone = window.api.updates.onDownloaded((v) => {
      setVersion(v)
      setPhase('ready')
      setDismissed(false)
    })
    return () => {
      offAvail()
      offProg()
      offDone()
    }
  }, [])

  if (dismissed || phase === 'idle') return null

  return (
    <div className="pointer-events-auto fixed bottom-4 right-4 z-[60] w-80 animate-slide-up rounded-xl border border-border bg-card p-4 shadow-2xl">
      {phase === 'downloading' ? (
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Download className="size-4 text-primary" />
            {t('กำลังดาวน์โหลดอัปเดต')} {version}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="mt-1 text-right text-xs text-muted-foreground">{percent}%</div>
        </div>
      ) : (
        <div>
          <div className="mb-1 flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-primary/15">
              <RefreshCw className="size-4 text-primary" />
            </div>
            <span className="text-sm font-semibold">{t("อัปเดตพร้อมติดตั้ง")}</span>
            <button
              onClick={() => setDismissed(true)}
              className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Perms {version} {t('ดาวน์โหลดเสร็จแล้ว — รีสตาร์ทเพื่อใช้เวอร์ชันใหม่')}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>
              {t("ภายหลัง")}
            </Button>
            <Button size="sm" onClick={() => window.api.updates.restart()}>
              <RefreshCw className="size-3.5" /> {t("รีสตาร์ทเลย")}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
