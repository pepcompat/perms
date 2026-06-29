import { useEffect, useState } from 'react'
import { Globe, MonitorDot, Bot, Terminal as TerminalIcon } from 'lucide-react'
import type { SessionRecord, CommandRecord } from '@shared/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Badge } from './ui/badge'
import { cn } from '../lib/utils'

export default function SessionHistory({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): JSX.Element {
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [commands, setCommands] = useState<CommandRecord[]>([])

  useEffect(() => {
    if (open) void window.api.sessions.list().then(setSessions)
  }, [open])

  useEffect(() => {
    if (selected) void window.api.sessions.commands(selected).then(setCommands)
    else setCommands([])
  }, [selected])

  const fmt = (t: number): string => new Date(t).toLocaleString()

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="h-[80vh] max-w-4xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-3.5">
          <DialogTitle className="flex items-center gap-2">
            <TerminalIcon className="size-4 text-primary" /> Session History
          </DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-1">
          <div className="w-72 shrink-0 overflow-y-auto border-r border-border">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className={cn(
                  'flex w-full flex-col gap-1 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-accent',
                  selected === s.id && 'bg-accent'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {s.kind === 'ssh' ? (
                      <Globe className="size-3.5 text-primary" />
                    ) : (
                      <MonitorDot className="size-3.5 text-[hsl(var(--success))]" />
                    )}
                    {s.title || '(local)'}
                  </span>
                  <Badge variant={s.status === 'active' ? 'success' : 'outline'}>{s.status}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{fmt(s.startedAt)}</span>
              </button>
            ))}
            {sessions.length === 0 && (
              <div className="p-6 text-center text-xs text-muted-foreground">ยังไม่มีประวัติ</div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {commands.map((c) => (
              <div key={c.id} className="mb-2.5 overflow-hidden rounded-lg border border-border bg-background/40">
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2 font-mono text-sm">
                    {c.source === 'ai' ? (
                      <Bot className="size-3.5 shrink-0 text-primary" />
                    ) : (
                      <span className="shrink-0 text-muted-foreground">$</span>
                    )}
                    <span className="truncate">{c.command}</span>
                  </span>
                  {c.exitCode !== null && (
                    <Badge variant={c.exitCode === 0 ? 'success' : 'destructive'}>exit {c.exitCode}</Badge>
                  )}
                </div>
                {c.outputPreview && (
                  <pre className="max-h-28 overflow-y-auto border-t border-border bg-black/30 px-3 py-2 font-mono text-[11px] text-muted-foreground">
                    {c.outputPreview}
                  </pre>
                )}
              </div>
            ))}
            {selected && commands.length === 0 && (
              <div className="p-6 text-center text-xs text-muted-foreground">
                ไม่มีคำสั่งที่บันทึกใน session นี้
              </div>
            )}
            {!selected && (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                เลือก session เพื่อดูประวัติคำสั่ง
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
