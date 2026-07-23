import { useEffect, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  RotateCw,
  X,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Loader2
} from 'lucide-react'
import { summarize, type TransferItem } from '@shared/transfer-queue'
import { humanSize } from '../lib/format'
import { Button } from './ui/button'
import { Hint } from './ui/tooltip'
import { cn } from '../lib/utils'
import { useT } from '../lib/i18n'

/** แถบคิวรับส่งไฟล์ — โผล่เฉพาะตอนมีงานอยู่ */
export default function TransferQueue(): JSX.Element | null {
  const t = useT()
  const [items, setItems] = useState<TransferItem[]>([])
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    void window.api.transfers.list().then(setItems)
    return window.api.transfers.onUpdate(setItems)
  }, [])

  const visible = items.filter((i) => i.status !== 'canceled')
  if (visible.length === 0) return null

  const s = summarize(items)
  const active = s.running > 0 || s.queued > 0

  return (
    <div className="pointer-events-auto fixed bottom-4 left-1/2 z-50 w-[26rem] -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent/40"
      >
        {active ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
        ) : (
          <ShieldCheck className="size-3.5 shrink-0 text-[hsl(var(--success))]" />
        )}
        <span className="flex-1 text-xs font-medium">
          {active
            ? `${t('กำลังถ่ายโอน')} ${s.done}/${s.total}`
            : `${t('ถ่ายโอนเสร็จ')} ${s.done}/${s.total}`}
          {s.failed > 0 && (
            <span className="ml-1.5 text-destructive">
              · {s.failed} {t('ล้มเหลว')}
            </span>
          )}
        </span>
        <span className="text-[11px] text-muted-foreground">{s.percent}%</span>
        <Hint label={t('ล้างรายการที่เสร็จแล้ว')}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              void window.api.transfers.clear()
            }}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Trash2 className="size-3" />
          </button>
        </Hint>
      </button>

      {!collapsed && (
        <div className="max-h-56 overflow-y-auto border-t border-border">
          {visible.map((it) => {
            const pct = it.size > 0 ? Math.min(100, Math.round((it.transferred / it.size) * 100)) : 0
            return (
              <div key={it.id} className="border-b border-border/40 px-3 py-2 last:border-0">
                <div className="flex items-center gap-2">
                  {it.kind === 'download' ? (
                    <ArrowDownToLine className="size-3 shrink-0 text-primary" />
                  ) : (
                    <ArrowUpFromLine className="size-3 shrink-0 text-[hsl(var(--success))]" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs">{it.name}</span>

                  {it.verified === 'ok' && (
                    <ShieldCheck
                      className="size-3 shrink-0 text-[hsl(var(--success))]"
                      // ตรวจแล้วว่าไฟล์ปลายทางเหมือนต้นทางบิตต่อบิต
                    />
                  )}
                  {it.verified === 'mismatch' && (
                    <ShieldAlert className="size-3 shrink-0 text-destructive" />
                  )}

                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {it.status === 'running'
                      ? `${humanSize(it.transferred)} / ${humanSize(it.size)}`
                      : it.status === 'done'
                        ? humanSize(it.size)
                        : it.status === 'queued'
                          ? t('รอคิว')
                          : t('ล้มเหลว')}
                  </span>

                  {it.status === 'failed' && (
                    <Hint label={t('ลองใหม่')}>
                      <button
                        onClick={() => void window.api.transfers.retry(it.id)}
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <RotateCw className="size-3" />
                      </button>
                    </Hint>
                  )}
                  {(it.status === 'running' || it.status === 'queued') && (
                    <Hint label={t('ยกเลิก')}>
                      <button
                        onClick={() => void window.api.transfers.cancel(it.id)}
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                      >
                        <X className="size-3" />
                      </button>
                    </Hint>
                  )}
                </div>

                {(it.status === 'running' || it.status === 'queued') && (
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        it.status === 'running' ? 'bg-primary' : 'bg-muted-foreground/40'
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}

                {it.error && (
                  <Hint label={it.error}>
                    <p className="mt-1 truncate text-[11px] text-destructive">
                      {it.error}
                      {it.attempts > 1 && ` (${t('ลองแล้ว')} ${it.attempts})`}
                    </p>
                  </Hint>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
