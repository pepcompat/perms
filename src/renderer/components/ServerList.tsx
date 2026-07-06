import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Server as ServerIcon,
  Plus,
  MonitorDot,
  Pencil,
  Trash2,
  History,
  BookText,
  Settings as SettingsIcon,
  Loader2,
  ChevronRight,
  SquareStack,
  GripVertical
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
  const tabs = useTabs((s) => s.tabs)
  const setActive = useTabs((s) => s.setActive)
  const lastActiveByServer = useTabs((s) => s.lastActiveByServer)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ServerRecord | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('ui.collapsedGroups') || '[]'))
    } catch {
      return new Set()
    }
  })
  // ลำดับ group ที่ผู้ใช้จัดเอง (persist ใน localStorage)
  const [groupOrder, setGroupOrder] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('ui.groupOrder') || '[]')
    } catch {
      return []
    }
  })
  const dragGroup = useRef<string | null>(null)
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null)

  const persistOrder = (order: string[]): void => {
    setGroupOrder(order)
    localStorage.setItem('ui.groupOrder', JSON.stringify(order))
  }

  const isConnected = (id: string): boolean => tabs.some((t) => t.serverId === id)
  const tabCount = (id: string): number => tabs.filter((t) => t.serverId === id).length
  const toggleGroup = (g: string): void =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      localStorage.setItem('ui.collapsedGroups', JSON.stringify([...next]))
      return next
    })

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

  // คลิกเดียว: ไปที่ tab ล่าสุดของ server นั้น (ถ้ายังไม่มี tab → connect ให้)
  const focusOrConnect = (s: ServerRecord): void => {
    const own = tabs.filter((t) => t.serverId === s.id)
    if (own.length === 0) {
      void connect(s)
      return
    }
    const last = lastActiveByServer[s.id]
    const target = own.some((t) => t.sessionId === last) ? last : own[own.length - 1].sessionId
    setActive(target)
  }

  // แยกคลิกเดียว vs double click (double = connect tab ใหม่เสมอ)
  const clickTimer = useRef<number | null>(null)
  const onCardClick = (s: ServerRecord): void => {
    if (clickTimer.current) return // เป็นคลิกที่ 2 ของ double — ปล่อยให้ onDoubleClick จัดการ
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null
      focusOrConnect(s)
    }, 220)
  }
  const onCardDblClick = (s: ServerRecord): void => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current)
      clickTimer.current = null
    }
    void connect(s)
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

  // เรียง group ตามลำดับที่ผู้ใช้จัด แล้วต่อท้ายด้วย group ใหม่ที่ยังไม่เคยจัด
  const groupNames = Object.keys(groups)
  const orderedNames = [
    ...groupOrder.filter((n) => groupNames.includes(n)),
    ...groupNames.filter((n) => !groupOrder.includes(n))
  ]

  const dropOnGroup = (target: string): void => {
    const from = dragGroup.current
    dragGroup.current = null
    setDragOverGroup(null)
    if (!from || from === target) return
    const next = orderedNames.filter((n) => n !== from)
    next.splice(next.indexOf(target), 0, from)
    persistOrder(next)
  }

  return (
    <div className="flex h-full shrink-0 flex-col bg-sidebar" style={{ width }}>
      <div className="titlebar mac-inset flex h-titlebar shrink-0 items-center justify-between gap-1 border-b border-border pl-3 pr-2">
        <div className="flex min-w-0 items-center gap-2">
          <img src={logoUrl} alt="Perms" className="size-6 shrink-0 rounded-md shadow-sm" />
          <span className="truncate text-sm font-semibold tracking-tight">Perms</span>
        </div>
        <div className="flex shrink-0 gap-0.5">
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
        {orderedNames.map((group) => {
          const list = groups[group]
          return (
          <div key={group} className="mb-3">
            {dragOverGroup === group && (
              <div className="mx-1 mb-1 h-0.5 rounded-full bg-primary" />
            )}
            <button
              draggable
              onDragStart={(e) => {
                dragGroup.current = group
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(e) => {
                e.preventDefault()
                if (dragGroup.current && dragGroup.current !== group) setDragOverGroup(group)
              }}
              onDragLeave={() => setDragOverGroup((g) => (g === group ? null : g))}
              onDrop={(e) => {
                e.preventDefault()
                dropOnGroup(group)
              }}
              onDragEnd={() => {
                dragGroup.current = null
                setDragOverGroup(null)
              }}
              onClick={() => toggleGroup(group)}
              className="group/hdr mb-1 flex w-full cursor-grab items-center gap-1 rounded px-1.5 py-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70 transition-colors hover:text-muted-foreground active:cursor-grabbing"
            >
              <GripVertical className="-ml-1 size-3 shrink-0 opacity-0 transition-opacity group-hover/hdr:opacity-50" />
              <ChevronRight
                className={cn('size-3 transition-transform', !collapsed.has(group) && 'rotate-90')}
              />
              <span className="truncate">{group}</span>
              <span className="ml-auto rounded-full bg-secondary px-1.5 text-[9px] text-muted-foreground">
                {list.length}
              </span>
            </button>
            {!collapsed.has(group) &&
              list.map((s) => (
              <div
                key={s.id}
                onClick={() => onCardClick(s)}
                onDoubleClick={() => onCardDblClick(s)}
                title="คลิก: ไป tab ล่าสุด · ดับเบิลคลิก: เปิด tab ใหม่"
                className="group mb-0.5 flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-accent"
              >
                <span
                  className={cn(
                    'size-2 shrink-0 rounded-full ring-2 ring-background',
                    isConnected(s.id) ? 'bg-[hsl(var(--success))]' : 'bg-muted-foreground/40'
                  )}
                  title={isConnected(s.id) ? 'เชื่อมต่ออยู่' : 'ไม่ได้เชื่อมต่อ'}
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
                  <>
                    {tabCount(s.id) >= 2 && (
                      <span
                        title={`เปิดอยู่ ${tabCount(s.id)} tab`}
                        className="flex shrink-0 items-center gap-0.5 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground group-hover:hidden"
                      >
                        <SquareStack className="size-2.5" />
                        {tabCount(s.id)}
                      </span>
                    )}
                    <div className="hidden gap-0.5 group-hover:flex">
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
                  </>
                )}
              </div>
            ))}
          </div>
          )
        })}
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
