import { useEffect, useMemo, useState } from 'react'
import {
  Play,
  Square,
  RotateCw,
  ScrollText,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Search,
  ServerCog
} from 'lucide-react'
import type { SystemdUnit, JournalLine } from '@shared/types'
import { unitTone, type UnitTone } from '@shared/systemd-status'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { Hint } from './ui/tooltip'
import { Input } from './ui/input'
import { cn } from '../lib/utils'
import { useT } from '../lib/i18n'
import { toast } from '../store/useToast'

const TONE_DOT: Record<UnitTone, string> = {
  ok: 'bg-[hsl(var(--success))]',
  warn: 'bg-[hsl(var(--warning))]',
  error: 'bg-destructive',
  idle: 'bg-muted-foreground/50'
}

function IconBtn({
  title,
  onClick,
  disabled,
  tone = 'muted',
  children
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  tone?: 'green' | 'amber' | 'sky' | 'red' | 'muted'
  children: React.ReactNode
}): JSX.Element {
  const tones = {
    green: 'text-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/15',
    amber: 'text-[hsl(var(--warning))] hover:bg-[hsl(var(--warning))]/15',
    sky: 'text-primary hover:bg-primary/15',
    red: 'text-destructive hover:bg-destructive/15',
    muted: 'text-muted-foreground hover:bg-accent hover:text-foreground'
  }
  return (
    <Hint label={title} side="top">
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn('rounded-md p-1.5 transition-colors disabled:opacity-40', tones[tone])}
      >
        {children}
      </button>
    </Hint>
  )
}

export default function SystemdPanel({
  sessionId,
  open,
  onClose
}: {
  sessionId: string
  open: boolean
  onClose: () => void
}): JSX.Element {
  const t = useT()
  const [units, setUnits] = useState<SystemdUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [q, setQ] = useState('')
  const [logsOf, setLogsOf] = useState<string | null>(null)
  const [logs, setLogs] = useState<JournalLine[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  const load = async (): Promise<void> => {
    setLoading(true)
    try {
      setUnits(await window.api.systemd.list(sessionId))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionId])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = needle
      ? units.filter(
          (u) =>
            u.unit.toLowerCase().includes(needle) || u.description.toLowerCase().includes(needle)
        )
      : units
    // ตัวที่พังขึ้นก่อน แล้วตัวที่รันอยู่ — ของที่ต้องสนใจอยู่บนสุด
    const rank = (u: SystemdUnit): number => {
      const tone = unitTone(u)
      return tone === 'error' ? 0 : tone === 'warn' ? 1 : tone === 'ok' ? 2 : 3
    }
    return [...list].sort((a, b) => rank(a) - rank(b) || a.unit.localeCompare(b.unit))
  }, [units, q])

  const act = async (unit: string, action: 'start' | 'stop' | 'restart'): Promise<void> => {
    const labels = { start: t('เริ่ม'), stop: t('หยุด'), restart: t('รีสตาร์ท') }
    if (action === 'stop' && !confirm(`${t('ยืนยันหยุด service')} ${unit}?`)) return
    setBusy(unit)
    try {
      const r = await window.api.systemd.action(sessionId, unit, action)
      if (r.ok) {
        toast(`${labels[action]} ${unit} ${t('สำเร็จ')}`)
        await load()
      } else {
        toast(r.output.trim().slice(0, 200) || t('คำสั่งไม่สำเร็จ'), 'error')
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy('')
    }
  }

  const showLogs = async (unit: string): Promise<void> => {
    setLogsOf(unit)
    setLogsLoading(true)
    try {
      setLogs(await window.api.systemd.logs(sessionId, unit, 300))
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error')
      setLogs([])
    } finally {
      setLogsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[80vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border p-3 pr-11">
          <DialogTitle className="flex items-center gap-2 text-base">
            {logsOf ? (
              <>
                <Hint label={t('ย้อนกลับ')}>
                  <button
                    onClick={() => setLogsOf(null)}
                    className="rounded p-1 hover:bg-accent"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                </Hint>
                <ScrollText className="size-4 text-primary" />
                <span className="truncate font-mono text-sm">{logsOf}</span>
              </>
            ) : (
              <>
                <ServerCog className="size-4 text-primary" />
                {t('Service (systemd)')}
              </>
            )}
          </DialogTitle>
          {!logsOf && (
            <DialogDescription>
              {t('จัดการ service บนเซิร์ฟเวอร์ และดู log จาก journalctl')}
            </DialogDescription>
          )}
        </DialogHeader>

        {logsOf ? (
          <div className="min-h-0 flex-1 overflow-auto bg-black/40 p-3 font-mono text-[11px] leading-relaxed">
            {logsLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <p className="text-muted-foreground">{t('ไม่มี log')}</p>
            ) : (
              logs.map((l, i) => (
                <div key={i} className="flex gap-2 whitespace-pre-wrap break-all">
                  {l.time && <span className="shrink-0 text-muted-foreground/60">{l.time}</span>}
                  {l.source && <span className="shrink-0 text-primary/70">{l.source}</span>}
                  <span>{l.message}</span>
                </div>
              ))
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t('ค้นหา service')}
                  className="h-8 pl-7 text-xs"
                />
              </div>
              <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  {t('ไม่พบ service')}
                </p>
              ) : (
                filtered.map((u) => {
                  const tone = unitTone(u)
                  const running = tone === 'ok' || tone === 'warn'
                  return (
                    <div
                      key={u.unit}
                      className="flex items-center gap-2 border-b border-border/50 px-3 py-2 hover:bg-accent/30"
                    >
                      <span className={cn('size-2 shrink-0 rounded-full', TONE_DOT[tone])} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-xs">{u.unit}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {u.active} · {u.sub}
                          {u.description && ` — ${u.description}`}
                        </div>
                      </div>
                      {busy === u.unit ? (
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      ) : (
                        <div className="flex shrink-0 items-center">
                          {running ? (
                            <IconBtn title={t('หยุด')} tone="red" onClick={() => void act(u.unit, 'stop')}>
                              <Square className="size-3.5" />
                            </IconBtn>
                          ) : (
                            <IconBtn title={t('เริ่ม')} tone="green" onClick={() => void act(u.unit, 'start')}>
                              <Play className="size-3.5" />
                            </IconBtn>
                          )}
                          <IconBtn title={t('รีสตาร์ท')} tone="amber" onClick={() => void act(u.unit, 'restart')}>
                            <RotateCw className="size-3.5" />
                          </IconBtn>
                          <IconBtn title={t('ดู log')} tone="sky" onClick={() => void showLogs(u.unit)}>
                            <ScrollText className="size-3.5" />
                          </IconBtn>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
