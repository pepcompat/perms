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
import { Tooltip, TooltipContent, TooltipTrigger, Hint } from './ui/tooltip'
import { cn } from '../lib/utils'
import { logoUrl } from '../lib/logo'
import { useT } from '../lib/i18n'
import ServerForm from './ServerForm'

export default function ServerList({
  width,
  version,
  onOpenSettings,
  onOpenHistory,
  onOpenRunbooks,
  onOpenChangelog
}: {
  width: number
  version?: string
  onOpenSettings: () => void
  onOpenHistory: () => void
  onOpenRunbooks: () => void
  onOpenChangelog: () => void
}): JSX.Element {
  const { servers, refresh } = useServers()
  const t = useT()
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
    if (confirm(`${t('ลบ server')} "${s.name}"?`)) {
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
    const fromIdx = orderedNames.indexOf(from)
    const targetIdx = orderedNames.indexOf(target)
    const next = orderedNames.filter((n) => n !== from)
    // ลากลง (from อยู่เหนือ target) → วางหลัง target · ลากขึ้น → วางหน้า target
    const insertAt = next.indexOf(target) + (fromIdx < targetIdx ? 1 : 0)
    next.splice(insertAt, 0, from)
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
            <TooltipContent>{t('Local terminal')}</TooltipContent>
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
            <TooltipContent>{t('เพิ่ม server')}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {orderedNames.map((group) => {
          const list = groups[group]
          // ลากลงมาวางกลุ่มนี้ → เส้นอยู่ล่าง · ลากขึ้น → เส้นอยู่บน
          const movingDown =
            dragOverGroup === group && dragGroup.current
              ? orderedNames.indexOf(dragGroup.current) < orderedNames.indexOf(group)
              : false
          return (
          <div
            key={group}
            className="mb-3"
            onDragOver={(e) => {
              if (!dragGroup.current || dragGroup.current === group) return
              e.preventDefault()
              setDragOverGroup(group)
            }}
            onDragLeave={(e) => {
              // ล้างเฉพาะตอนออกจาก block จริง ๆ (ไม่ใช่แค่ย้ายไปทับ child)
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOverGroup((g) => (g === group ? null : g))
              }
            }}
            onDrop={(e) => {
              e.preventDefault()
              dropOnGroup(group)
            }}
          >
            {dragOverGroup === group && !movingDown && (
              <div className="mx-1 mb-1 h-0.5 rounded-full bg-primary" />
            )}
            <button
              draggable
              onDragStart={(e) => {
                dragGroup.current = group
                e.dataTransfer.effectAllowed = 'move'
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
              <span className="truncate">{t(group)}</span>
              <span className="ml-auto rounded-full bg-secondary px-1.5 text-[9px] text-muted-foreground">
                {list.length}
              </span>
            </button>
            {!collapsed.has(group) && (
              <div className="ml-2.5 border-l border-border/50 pl-1.5">
                {list.map((s) => (
              <Hint
                key={`hint-${s.id}`}
                label={t('คลิก: ไป tab ล่าสุด · ดับเบิลคลิก: เปิด tab ใหม่')}
                side="right"
                delay={700}
              >
              <div
                key={s.id}
                onClick={() => onCardClick(s)}
                onDoubleClick={() => onCardDblClick(s)}
                className="group mb-px flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-accent"
              >
                <Hint label={isConnected(s.id) ? t('เชื่อมต่ออยู่') : t('ไม่ได้เชื่อมต่อ')}>
                  <span
                    className={cn(
                      'size-1.5 shrink-0 rounded-full ring-2 ring-background',
                      isConnected(s.id) ? 'bg-[hsl(var(--success))]' : 'bg-muted-foreground/40'
                    )}
                  />
                </Hint>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium leading-tight">{s.name}</div>
                  <div className="truncate text-[11px] leading-tight text-muted-foreground">
                    {s.username}@{s.host}
                  </div>
                </div>
                {connecting === s.id ? (
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                ) : (
                  <>
                    {tabCount(s.id) >= 2 && (
                      <Hint label={`${t('เปิดอยู่')} ${tabCount(s.id)} tab`}>
                        <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground group-hover:hidden">
                          <SquareStack className="size-2.5" />
                          {tabCount(s.id)}
                        </span>
                      </Hint>
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
              </Hint>
                ))}
              </div>
            )}
            {dragOverGroup === group && movingDown && (
              <div className="mx-1 mt-1 h-0.5 rounded-full bg-primary" />
            )}
          </div>
          )
        })}
        {servers.length === 0 && (
          <div className="mt-8 flex flex-col items-center gap-2 px-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-accent">
              <ServerIcon className="size-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">{t('ยังไม่มี server')}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              <Plus className="size-3.5" /> {t("เพิ่ม server")}
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0.5 border-t border-border p-2">
        <SideLink icon={<History className="size-4" />} label={t('Session history')} onClick={onOpenHistory} />
        <SideLink icon={<BookText className="size-4" />} label={t('Runbooks')} onClick={onOpenRunbooks} />
        <SideLink icon={<SettingsIcon className="size-4" />} label={t('Settings')} onClick={onOpenSettings} />
        {version && (
          <Hint label={t("ดูว่ามีอะไรใหม่ (changelog)")}>
            <button
              onClick={onOpenChangelog}
              className="ml-1 mt-0.5 self-start rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/50 transition-colors hover:text-muted-foreground"
            >
              v{version}
            </button>
          </Hint>
        )}
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
