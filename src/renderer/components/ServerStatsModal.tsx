import { useEffect, useRef, useState } from 'react'
import { Activity, Cpu, MemoryStick, HardDrive, ArrowDown, ArrowUp, ListTree } from 'lucide-react'
import type { ServerStats } from '@shared/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { humanSize } from '../lib/format'
import { cn } from '../lib/utils'
import { useT } from '../lib/i18n'

/** สี bar ตามระดับการใช้งาน */
function tone(pct: number | null): { bar: string; text: string } {
  if (pct === null) return { bar: 'bg-muted-foreground/40', text: 'text-muted-foreground' }
  if (pct >= 90) return { bar: 'bg-destructive', text: 'text-destructive' }
  if (pct >= 70) return { bar: 'bg-[hsl(var(--warning))]', text: 'text-[hsl(var(--warning))]' }
  return { bar: 'bg-[hsl(var(--success))]', text: 'text-[hsl(var(--success))]' }
}

/** แถวหนึ่งของ metric แบบมี progress bar */
function Meter({
  icon,
  label,
  percent,
  detail
}: {
  icon: JSX.Element
  label: string
  percent: number | null
  detail?: string
}): JSX.Element {
  const c = tone(percent)
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium">{label}</span>
        <span className={cn('ml-auto text-sm font-semibold tabular-nums', c.text)}>
          {percent === null ? '—' : `${percent}%`}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn('h-full rounded-full transition-all duration-500', c.bar)}
          style={{ width: `${percent ?? 0}%` }}
        />
      </div>
      {detail && <div className="mt-1 text-right text-[11px] text-muted-foreground">{detail}</div>}
    </div>
  )
}

/** modal สถานะเซิร์ฟเวอร์แบบสด — poll ทุก 2 วิ ระหว่างเปิด */
export default function ServerStatsModal({
  sessionId,
  title,
  open,
  onClose
}: {
  sessionId: string
  title: string
  open: boolean
  onClose: () => void
}): JSX.Element {
  const t = useT()
  const [stats, setStats] = useState<ServerStats | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'unsupported'>('loading')
  const failRef = useRef(0)

  useEffect(() => {
    if (!open) return
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    const tick = async (): Promise<void> => {
      const s = await window.api.stats.sample(sessionId).catch(() => null)
      if (!alive) return
      if (s) {
        setStats(s)
        setState('ok')
        failRef.current = 0
      } else if (++failRef.current >= 2) {
        setState('unsupported')
        return
      }
      timer = setTimeout(() => void tick(), 2000)
    }
    void tick()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [open, sessionId])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4 text-primary" />
            {t('สถานะเซิร์ฟเวอร์ (สด)')}
            {state === 'ok' && (
              <span className="size-1.5 animate-pulse rounded-full bg-[hsl(var(--success))]" />
            )}
          </DialogTitle>
          <DialogDescription className="truncate">{title}</DialogDescription>
        </DialogHeader>

        {state === 'unsupported' ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('อ่านสถานะไม่ได้ — เซิร์ฟเวอร์นี้อาจไม่ใช่ Linux หรือไม่มีสิทธิ์อ่าน /proc')}
          </p>
        ) : !stats ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('กำลังอ่านสถานะ…')}</p>
        ) : (
          <div className="space-y-4">
            <Meter
              icon={<Cpu className={cn('size-4', tone(stats.cpuPercent).text)} />}
              label="CPU"
              percent={stats.cpuPercent}
            />
            <Meter
              icon={<MemoryStick className={cn('size-4', tone(stats.memPercent).text)} />}
              label={t('หน่วยความจำ (RAM)')}
              percent={stats.memPercent}
              detail={`${t('ใช้')} ${humanSize(stats.memUsedBytes)} · ${t('เหลือ')} ${humanSize(
                stats.memTotalBytes - stats.memUsedBytes
              )} · ${t('ทั้งหมด')} ${humanSize(stats.memTotalBytes)}`}
            />
            {stats.diskPercent !== null && (
              <Meter
                icon={<HardDrive className={cn('size-4', tone(stats.diskPercent).text)} />}
                label={t('พื้นที่ดิสก์ (/)')}
                percent={stats.diskPercent}
                detail={`${t('ใช้')} ${humanSize(stats.diskUsedBytes ?? 0)} · ${t('เหลือ')} ${humanSize(
                  (stats.diskTotalBytes ?? 0) - (stats.diskUsedBytes ?? 0)
                )} · ${t('ทั้งหมด')} ${humanSize(stats.diskTotalBytes ?? 0)}`}
              />
            )}

            {/* Network */}
            <div className="rounded-lg border border-border bg-background/40 p-3">
              <div className="mb-2 text-sm font-medium">{t('เครือข่าย')}</div>
              <div className="flex gap-4">
                <span className="flex items-center gap-1.5 text-sm">
                  <ArrowDown className="size-4 text-primary" />
                  <span className="tabular-nums">
                    {stats.rxPerSec === null ? '—' : `${humanSize(stats.rxPerSec)}/s`}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 text-sm">
                  <ArrowUp className="size-4 text-[hsl(var(--success))]" />
                  <span className="tabular-nums">
                    {stats.txPerSec === null ? '—' : `${humanSize(stats.txPerSec)}/s`}
                  </span>
                </span>
              </div>
            </div>

            {/* Process (top) — เรียงตาม CPU */}
            {stats.processes.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                  <ListTree className="size-4 text-primary" />
                  {t('โปรเซสที่กินทรัพยากร')}
                </div>
                <div className="overflow-hidden rounded-lg border border-border">
                  <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-2.5 py-1 text-[10px] font-medium uppercase text-muted-foreground">
                    <span className="w-12 shrink-0">PID</span>
                    <span className="min-w-0 flex-1">{t('คำสั่ง')}</span>
                    <span className="w-12 shrink-0 text-right">CPU</span>
                    <span className="w-12 shrink-0 text-right">MEM</span>
                    <span className="w-14 shrink-0 text-right">RSS</span>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {stats.processes.map((p) => (
                      <div
                        key={p.pid}
                        className="flex items-center gap-2 border-b border-border/40 px-2.5 py-1 text-xs last:border-0"
                      >
                        <span className="w-12 shrink-0 font-mono text-[11px] text-muted-foreground">
                          {p.pid}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-mono">{p.command}</span>
                        <span className={cn('w-12 shrink-0 text-right tabular-nums', tone(p.cpu).text)}>
                          {p.cpu.toFixed(1)}%
                        </span>
                        <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">
                          {p.mem.toFixed(1)}%
                        </span>
                        <span className="w-14 shrink-0 text-right tabular-nums text-muted-foreground">
                          {humanSize(p.rssBytes)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
