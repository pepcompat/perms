import { useEffect, useRef, useState } from 'react'
import {
  Bot,
  Send,
  Square,
  Terminal as TerminalIcon,
  Check,
  X,
  AlertTriangle,
  Sparkles,
  ChevronDown
} from 'lucide-react'
import type { AiMode, AiProvider, AiStreamEvent } from '@shared/types'
import { useSettings } from '../store/useSettings'
import { useTabs } from '../store/useTabs'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem
} from './ui/dropdown-menu'
import { cn } from '../lib/utils'

interface ChatItem {
  role: 'user' | 'assistant'
  text: string
  tools?: { name: string; args: string; result?: string }[]
}

interface PendingApproval {
  callId: string
  command: string
}

const PROVIDER_OPTS: { id: AiProvider; label: string }[] = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'google', label: 'Google' }
]

const MODE_OPTS: { id: AiMode; label: string; desc: string }[] = [
  { id: 'suggest', label: 'แนะนำ', desc: 'เสนอคำสั่ง ไม่รันให้' },
  { id: 'approve', label: 'อนุมัติ', desc: 'ขออนุมัติก่อนรันทุกคำสั่ง' },
  { id: 'agentic', label: 'Agentic', desc: 'รันเองอัตโนมัติเป็น loop' }
]

const MODE_LABEL: Record<AiMode, string> = {
  suggest: 'แนะนำ',
  approve: 'อนุมัติ',
  agentic: 'Agentic'
}

export default function AISidebar({ width }: { width: number }): JSX.Element {
  const { settings } = useSettings()
  const { activeId } = useTabs()
  const [provider, setProvider] = useState<AiProvider>('anthropic')
  const [mode, setMode] = useState<AiMode>('approve')
  const [items, setItems] = useState<ChatItem[]>([])
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [approval, setApproval] = useState<PendingApproval | null>(null)
  const reqRef = useRef<string | null>(null)
  const offRef = useRef<(() => void) | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (settings) {
      setProvider(settings.ai.defaultProvider)
      setMode(settings.ai.defaultMode)
    }
  }, [settings])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [items, approval])

  const configured = settings?.ai.configured[provider]

  const send = async (): Promise<void> => {
    if (!input.trim() || running) return
    const message = input.trim()
    setInput('')
    setItems((prev) => [...prev, { role: 'user', text: message }, { role: 'assistant', text: '' }])
    setRunning(true)

    const requestId = await window.api.ai.chat({ sessionId: activeId, provider, mode, message })
    reqRef.current = requestId
    offRef.current = window.api.ai.onStream(requestId, handleEvent)
  }

  const handleEvent = (ev: AiStreamEvent): void => {
    setItems((prev) => {
      const next = [...prev]
      const last = next[next.length - 1]
      if (!last || last.role !== 'assistant') return prev
      if (ev.type === 'text') last.text += ev.delta
      else if (ev.type === 'tool_call') {
        last.tools = last.tools ?? []
        last.tools.push({ name: ev.call.name, args: JSON.stringify(ev.call.arguments) })
      } else if (ev.type === 'tool_result') {
        const t = last.tools?.[last.tools.length - 1]
        if (t) t.result = ev.result.slice(0, 800)
      }
      return next
    })

    if (ev.type === 'approval_request') {
      setApproval({ callId: ev.callId, command: ev.command })
    } else if (ev.type === 'done' || ev.type === 'error') {
      if (ev.type === 'error') {
        setItems((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last) last.text += `\n\n⚠️ ${ev.message}`
          return next
        })
      }
      setRunning(false)
      offRef.current?.()
    }
  }

  const respondApproval = (approved: boolean): void => {
    if (approval) {
      window.api.ai.approve(approval.callId, approved)
      setApproval(null)
    }
  }

  const cancel = (): void => {
    if (reqRef.current) window.api.ai.cancel(reqRef.current)
    setRunning(false)
  }

  return (
    <div className="flex h-full shrink-0 flex-col border-l border-border bg-sidebar" style={{ width }}>
      <div className="titlebar flex h-titlebar shrink-0 items-center gap-2 border-b border-border px-3">
        <div className="flex size-6 items-center justify-center rounded-md bg-primary/15">
          <Bot className="size-4 text-primary" />
        </div>
        <span className="text-sm font-semibold tracking-tight">AI Agent</span>
        <div className="ml-auto flex gap-1.5">
          {/* Provider picker */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-7 items-center gap-1 rounded-md border border-input bg-background/40 px-2.5 text-xs font-medium transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring">
                {PROVIDER_OPTS.find((p) => p.id === provider)?.label}
                <ChevronDown className="size-3.5 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[10rem]">
              <DropdownMenuLabel>Provider</DropdownMenuLabel>
              {PROVIDER_OPTS.map((p, i) => (
                <DropdownMenuItem
                  key={p.id}
                  checked={provider === p.id}
                  shortcut={String(i + 1)}
                  onSelect={() => setProvider(p.id)}
                >
                  {p.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mode picker */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-7 items-center gap-1 rounded-md border border-input bg-background/40 px-2.5 text-xs font-medium transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring">
                {MODE_LABEL[mode]}
                <ChevronDown className="size-3.5 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[15rem]">
              <DropdownMenuLabel>Mode</DropdownMenuLabel>
              {MODE_OPTS.map((m, i) => (
                <DropdownMenuItem
                  key={m.id}
                  checked={mode === m.id}
                  shortcut={String(i + 1)}
                  onSelect={() => setMode(m.id)}
                >
                  <span className="flex flex-col">
                    <span>{m.label}</span>
                    <span className="text-[11px] font-normal text-muted-foreground">{m.desc}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {!configured && (
        <div className="flex items-center gap-2 border-b border-border bg-[hsl(var(--warning))]/10 px-3 py-2 text-xs text-[hsl(var(--warning))]">
          <AlertTriangle className="size-3.5 shrink-0" />
          ยังไม่ได้ตั้ง API key ของ {provider} — ไปที่ Settings
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-3">
        {items.length === 0 && (
          <div className="mt-10 flex flex-col items-center gap-3 px-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15">
              <Sparkles className="size-6 text-primary" />
            </div>
            <p className="text-sm font-medium">ถาม AI เกี่ยวกับ server ได้เลย</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              เช่น “เช็ค disk ว่าตัวไหนเต็ม” หรือ “หา process ที่กิน CPU สูงสุด”
              {!activeId && (
                <>
                  <br />
                  <span className="text-[hsl(var(--warning))]">เปิด terminal session ก่อนเพื่อให้ AI รันคำสั่งได้</span>
                </>
              )}
            </p>
          </div>
        )}

        {items.map((it, i) => (
          <div key={i} className={cn('flex animate-fade-in', it.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                it.role === 'user'
                  ? 'rounded-br-sm bg-primary text-primary-foreground'
                  : 'rounded-bl-sm bg-card'
              )}
            >
              <div className="whitespace-pre-wrap break-words">
                {it.text || (running && i === items.length - 1 ? <TypingDots /> : '')}
              </div>
              {it.tools?.map((t, j) => (
                <div key={j} className="mt-2 overflow-hidden rounded-lg border border-border bg-background/60">
                  <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-1.5 font-mono text-xs text-primary">
                    <TerminalIcon className="size-3.5" /> {t.name}
                  </div>
                  <div className="px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">{t.args}</div>
                  {t.result && (
                    <pre className="max-h-36 overflow-y-auto border-t border-border bg-black/30 px-2.5 py-1.5 font-mono text-[11px] text-foreground/80">
                      {t.result}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {approval && (
          <div className="animate-slide-up rounded-xl border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/5 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--warning))]">
              <AlertTriangle className="size-3.5" /> AI ขออนุมัติรันคำสั่ง
            </div>
            <pre className="mb-3 overflow-x-auto rounded-lg bg-black/40 px-3 py-2 font-mono text-xs text-foreground">
              {approval.command}
            </pre>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => respondApproval(false)}>
                <X className="size-3.5" /> ปฏิเสธ
              </Button>
              <Button size="sm" onClick={() => respondApproval(true)} className="bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90">
                <Check className="size-3.5" /> อนุมัติ & รัน
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        {activeId ? (
          <Badge variant="outline" className="mb-2">
            <TerminalIcon className="size-2.5" /> session ใช้งานอยู่
          </Badge>
        ) : null}
        <div className="flex items-end gap-2">
          <Textarea
            className="h-[52px] flex-1 resize-none rounded-xl"
            placeholder="พิมพ์คำถามถึง AI…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
          />
          {running ? (
            <Button variant="destructive" size="icon" className="size-[52px] rounded-xl" onClick={cancel}>
              <Square className="size-4" />
            </Button>
          ) : (
            <Button size="icon" className="size-[52px] rounded-xl" onClick={send} disabled={!configured || !input.trim()}>
              <Send className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function TypingDots(): JSX.Element {
  return (
    <span className="inline-flex gap-1">
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
    </span>
  )
}
