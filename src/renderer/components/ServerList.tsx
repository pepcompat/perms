import { useEffect, useState, type ReactNode } from 'react'
import {
  Server as ServerIcon,
  Plus,
  MonitorDot,
  Pencil,
  Trash2,
  History,
  BookText,
  Settings as SettingsIcon,
  Loader2
} from 'lucide-react'
import type { ServerRecord } from '@shared/types'
import { useServers } from '../store/useServers'
import { useTabs } from '../store/useTabs'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { cn } from '../lib/utils'
import { logoUrl } from '../lib/logo'
import ServerForm from './ServerForm'

export default function ServerList({
  width,
  onOpenSettings,
  onOpenHistory,
  onOpenRunbooks
}: {
  width: number
  onOpenSettings: () => void
  onOpenHistory: () => void
  onOpenRunbooks: () => void
}): JSX.Element {
  const { servers, refresh } = useServers()
  const { addTab } = useTabs()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ServerRecord | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)

  useEffect(() => {
    void refresh()
  }, [refresh])

  const connect = async (s: ServerRecord): Promise<void> => {
    setConnecting(s.id)
    try {
      const res = await window.api.terminal.open({ serverId: s.id, cols: 80, rows: 24 })
      addTab({ sessionId: res.sessionId, title: res.title, kind: res.kind, serverId: s.id })
    } catch (e) {
      alert(`เชื่อมต่อไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setConnecting(null)
    }
  }

  const openLocal = async (): Promise<void> => {
    const res = await window.api.terminal.open({ cols: 80, rows: 24 })
    addTab({ sessionId: res.sessionId, title: res.title, kind: res.kind, serverId: null })
  }

  const remove = async (s: ServerRecord): Promise<void> => {
    if (confirm(`ลบ server "${s.name}"?`)) {
      await window.api.servers.remove(s.id)
      await refresh()
    }
  }

  const groups = servers.reduce<Record<string, ServerRecord[]>>((acc, s) => {
    const g = s.groupName || 'อื่นๆ'
    ;(acc[g] ||= []).push(s)
    return acc
  }, {})

  const dot = (c: string | null): string => c || 'hsl(var(--primary))'

  return (
    <div className="flex h-full shrink-0 flex-col bg-sidebar" style={{ width }}>
      <div className="titlebar mac-inset flex h-titlebar shrink-0 items-center justify-between border-b border-border pl-3 pr-2">
        <div className="flex items-center gap-2">
          <img src={logoUrl} alt="Perms" className="size-6 rounded-md shadow-sm" />
          <span className="text-sm font-semibold tracking-tight">Perms</span>
        </div>
        <div className="flex gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={openLocal}>
                <MonitorDot className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Local terminal</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
              >
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>เพิ่ม server</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {Object.entries(groups).map(([group, list]) => (
          <div key={group} className="mb-4">
            <div className="mb-1.5 px-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
              {group}
            </div>
            {list.map((s) => (
              <div
                key={s.id}
                onClick={() => connect(s)}
                className="group mb-0.5 flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-accent"
              >
                <span
                  className="size-2 shrink-0 rounded-full ring-2 ring-background"
                  style={{ background: dot(s.color) }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium leading-tight">{s.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {s.username}@{s.host}
                  </div>
                </div>
                {connecting === s.id ? (
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                ) : (
                  <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditing(s)
                        setFormOpen(true)
                      }}
                      className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        void remove(s)
                      }}
                      className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
        {servers.length === 0 && (
          <div className="mt-8 flex flex-col items-center gap-2 px-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-accent">
              <ServerIcon className="size-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">ยังไม่มี server</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              <Plus className="size-3.5" /> เพิ่ม server
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0.5 border-t border-border p-2">
        <SideLink icon={<History className="size-4" />} label="Session history" onClick={onOpenHistory} />
        <SideLink icon={<BookText className="size-4" />} label="Runbooks" onClick={onOpenRunbooks} />
        <SideLink icon={<SettingsIcon className="size-4" />} label="Settings" onClick={onOpenSettings} />
      </div>

      {formOpen && <ServerForm editing={editing} open={formOpen} onClose={() => setFormOpen(false)} />}
    </div>
  )
}

function SideLink({
  icon,
  label,
  onClick
}: {
  icon: ReactNode
  label: string
  onClick: () => void
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
      )}
    >
      {icon}
      {label}
    </button>
  )
}
