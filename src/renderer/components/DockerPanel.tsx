import { useEffect, useState, type ReactNode } from 'react'
import {
  Play,
  Square,
  RotateCw,
  Trash2,
  ScrollText,
  RefreshCw,
  Loader2,
  ArrowLeft,
  SquareTerminal,
  Boxes
} from 'lucide-react'
import type { DockerContainer } from '@shared/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { cn } from '../lib/utils'
import DockerIcon from './DockerIcon'

const TONE: Record<string, string> = {
  primary: 'text-primary hover:bg-primary/10',
  green: 'text-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/10',
  amber: 'text-[hsl(var(--warning))] hover:bg-[hsl(var(--warning))]/10',
  sky: 'text-sky-400 hover:bg-sky-400/10',
  red: 'text-destructive hover:bg-destructive/10',
  muted: 'text-muted-foreground hover:bg-secondary hover:text-foreground'
}

function stateColor(s: string): string {
  if (s === 'running') return 'bg-[hsl(var(--success))]'
  if (s === 'paused' || s === 'restarting') return 'bg-[hsl(var(--warning))]'
  return 'bg-muted-foreground/40'
}

export default function DockerPanel({
  sessionId,
  title,
  open,
  onClose,
  onOpenExec
}: {
  sessionId: string
  title: string
  open: boolean
  onClose: () => void
  onOpenExec: (c: { id: string; name: string }) => void
}): JSX.Element {
  const [containers, setContainers] = useState<DockerContainer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [groupBusy, setGroupBusy] = useState<string | null>(null)
  const [logs, setLogs] = useState<{ name: string; text: string; loading: boolean } | null>(null)

  const load = async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const r = await window.api.docker.list(sessionId)
      if (!r.available) {
        setError('ใช้งาน docker บนเซิร์ฟเวอร์นี้ไม่ได้ (อาจไม่มี docker หรือผู้ใช้ไม่มีสิทธิ์)')
        setContainers([])
      } else {
        setContainers(r.containers)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionId])

  const act = async (action: string, c: DockerContainer): Promise<void> => {
    if (action === 'remove' && !confirm(`ลบ container "${c.name}"? (docker rm -f — ลบถาวร)`)) return
    setBusyId(c.id)
    try {
      const r = await window.api.docker.action(sessionId, action, c.id)
      if (!r.ok) alert(`ไม่สำเร็จ: ${r.output || action}`)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  const actGroup = async (action: string, project: string, list: DockerContainer[]): Promise<void> => {
    setGroupBusy(project)
    try {
      for (const c of list) await window.api.docker.action(sessionId, action, c.id)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setGroupBusy(null)
    }
  }

  const showLogs = async (c: DockerContainer): Promise<void> => {
    setLogs({ name: c.name, text: '', loading: true })
    try {
      const text = await window.api.docker.logs(sessionId, c.id)
      setLogs({ name: c.name, text: text.trim() || '(ไม่มี log)', loading: false })
    } catch (e) {
      setLogs({ name: c.name, text: `ดึง log ไม่ได้: ${e instanceof Error ? e.message : e}`, loading: false })
    }
  }

  // จัดกลุ่มตาม compose project (ตัวที่ไม่มี project = แยกเดี่ยว)
  const composeGroups = new Map<string, DockerContainer[]>()
  const standalone: DockerContainer[] = []
  for (const c of containers) {
    if (c.project) {
      const g = composeGroups.get(c.project) ?? []
      g.push(c)
      composeGroups.set(c.project, g)
    } else {
      standalone.push(c)
    }
  }

  const row = (c: DockerContainer): JSX.Element => (
    <div
      key={c.id}
      className="flex items-center gap-2.5 rounded-lg border border-border bg-background/40 p-2.5"
    >
      <span className={cn('size-2 shrink-0 rounded-full', stateColor(c.state))} title={c.state} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{c.service || c.name || c.id}</div>
        <div className="truncate text-[11px] text-muted-foreground">
          {c.image} · {c.status}
          {c.ports ? ` · ${c.ports}` : ''}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {busyId === c.id && <Loader2 className="mr-0.5 size-3.5 animate-spin text-primary" />}
        {c.state === 'running' && (
          <IconBtn tone="primary" title="เปิด terminal ใน container" onClick={() => onOpenExec({ id: c.id, name: c.name })}>
            <SquareTerminal className="size-3.5" />
          </IconBtn>
        )}
        {c.state === 'running' ? (
          <IconBtn tone="amber" title="หยุด" onClick={() => act('stop', c)} disabled={busyId === c.id}>
            <Square className="size-3.5" />
          </IconBtn>
        ) : (
          <IconBtn tone="green" title="เริ่ม" onClick={() => act('start', c)} disabled={busyId === c.id}>
            <Play className="size-3.5" />
          </IconBtn>
        )}
        <IconBtn tone="sky" title="รีสตาร์ท" onClick={() => act('restart', c)} disabled={busyId === c.id}>
          <RotateCw className="size-3.5" />
        </IconBtn>
        <IconBtn tone="muted" title="ดู logs" onClick={() => showLogs(c)} disabled={busyId === c.id}>
          <ScrollText className="size-3.5" />
        </IconBtn>
        <IconBtn tone="red" title="ลบ" onClick={() => act('remove', c)} disabled={busyId === c.id}>
          <Trash2 className="size-3.5" />
        </IconBtn>
      </div>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[80vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <DockerIcon className="size-4 text-[#2496ED]" /> Docker Containers
            {!logs && (
              <Button
                variant="outline"
                size="icon-sm"
                className="ml-auto"
                title="รีเฟรช"
                onClick={() => void load()}
              >
                <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
              </Button>
            )}
          </DialogTitle>
          <DialogDescription className="truncate">
            {logs ? `logs · ${logs.name}` : title}
          </DialogDescription>
        </DialogHeader>

        {logs ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setLogs(null)}>
              <ArrowLeft className="size-3.5" /> กลับไปรายการ
            </Button>
            <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-foreground">
              {logs.loading ? 'กำลังโหลด log…' : logs.text}
            </pre>
          </div>
        ) : (
          <div className="-mr-2 min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            {/* compose stacks — จัดเป็นชุด */}
            {[...composeGroups.entries()].map(([project, list]) => (
              <div key={project} className="space-y-1.5">
                <div className="flex items-center gap-2 px-0.5">
                  <Boxes className="size-3.5 shrink-0 text-primary/70" />
                  <span className="truncate text-xs font-semibold">{project}</span>
                  <Badge variant="secondary" className="shrink-0">
                    {list.length}
                  </Badge>
                  <div className="ml-auto flex shrink-0 items-center gap-0.5">
                    {groupBusy === project && <Loader2 className="mr-0.5 size-3 animate-spin text-primary" />}
                    <IconBtn tone="green" title="เริ่มทั้งชุด" onClick={() => actGroup('start', project, list)} disabled={groupBusy === project}>
                      <Play className="size-3" />
                    </IconBtn>
                    <IconBtn tone="amber" title="หยุดทั้งชุด" onClick={() => actGroup('stop', project, list)} disabled={groupBusy === project}>
                      <Square className="size-3" />
                    </IconBtn>
                    <IconBtn tone="sky" title="รีสตาร์ททั้งชุด" onClick={() => actGroup('restart', project, list)} disabled={groupBusy === project}>
                      <RotateCw className="size-3" />
                    </IconBtn>
                  </div>
                </div>
                <div className="space-y-1.5 border-l-2 border-border/60 pl-2">{list.map(row)}</div>
              </div>
            ))}

            {/* container แยกเดี่ยว */}
            {standalone.length > 0 && (
              <div className="space-y-1.5">
                {composeGroups.size > 0 && (
                  <div className="px-0.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
                    แยกเดี่ยว
                  </div>
                )}
                {standalone.map(row)}
              </div>
            )}

            {!error && !loading && containers.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">ไม่มี container</div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function IconBtn({
  title,
  tone,
  onClick,
  disabled,
  children
}: {
  title: string
  tone: keyof typeof TONE
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}): JSX.Element {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded p-1.5 transition-colors disabled:pointer-events-none disabled:opacity-40',
        TONE[tone]
      )}
    >
      {children}
    </button>
  )
}
