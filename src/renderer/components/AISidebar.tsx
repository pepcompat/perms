import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode
} from 'react'
import {
  Bot,
  Send,
  Square,
  Terminal as TerminalIcon,
  Check,
  X,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  RotateCcw
} from 'lucide-react'
import type { AiMode, AiProvider, AiStreamEvent } from '@shared/types'
import { useSettings } from '../store/useSettings'
import { useTabs } from '../store/useTabs'
import { useAiDraft } from '../store/useAiDraft'
import { MODEL_PRESETS } from '../lib/models'
import Markdown from './Markdown'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
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
  const [model, setModel] = useState('')
  const [items, setItems] = useState<ChatItem[]>([])
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [approval, setApproval] = useState<PendingApproval | null>(null)
  const reqRef = useRef<string | null>(null)
  const offRef = useRef<(() => void) | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const draftSeq = useAiDraft((s) => s.seq)

  useEffect(() => {
    if (settings) {
      setProvider(settings.ai.defaultProvider)
      setMode(settings.ai.defaultMode)
      setModel(settings.ai.models[settings.ai.defaultProvider])
    }
  }, [settings])

  // เปลี่ยน provider → ใช้โมเดล default ของ provider นั้น
  const pickProvider = (p: AiProvider): void => {
    setProvider(p)
    if (settings) setModel(settings.ai.models[p])
  }

  // เลือกโมเดล + จำเป็น default ของ provider นี้
  const pickModel = (m: string): void => {
    setModel(m)
    void window.api.settings.updateAi({ models: { [provider]: m } })
  }

  // รับข้อความที่ "ส่งเข้า AI" จาก terminal (เติมในช่อง input + focus)
  useEffect(() => {
    if (draftSeq === 0) return
    const text = useAiDraft.getState().text
    setInput((cur) => (cur ? cur + '\n' + text : text))
    inputRef.current?.focus()
  }, [draftSeq])

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

    // สร้าง requestId เอง + subscribe stream "ก่อน" เริ่มงาน — กัน event แรก (รวม error) หาย
    const requestId = crypto.randomUUID()
    reqRef.current = requestId
    offRef.current = window.api.ai.onStream(requestId, handleEvent)
    await window.api.ai.chat({
      requestId,
      sessionId: activeId,
      provider,
      model: model || undefined,
      mode,
      message
    })
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
        {items.length > 0 && (
          <button
            onClick={() => setItems([])}
            title="ล้างแชท"
            className="no-drag ml-auto flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
          </button>
        )}
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
              {it.text ? (
                <Markdown
                  className={it.role === 'user' ? 'prose-invert [&_code]:bg-black/20' : ''}
                >
                  {it.text}
                </Markdown>
              ) : running && i === items.length - 1 ? (
                <TypingDots />
              ) : null}
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

      <div className="p-3">
        <div className="rounded-2xl border border-border bg-card/60 shadow-sm transition-colors focus-within:border-ring/70">
          <Textarea
            ref={inputRef}
            className="max-h-44 min-h-[54px] w-full resize-none border-0 bg-transparent px-3.5 py-3 shadow-none focus-visible:ring-0"
            placeholder="พิมพ์คำถามถึง AI… (รองรับ Markdown)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
          />

          {/* toolbar — สมมาตร: ซ้าย = mode, ขวา = provider/model/ส่ง (wrap เมื่อแคบ) */}
          <div className="flex flex-wrap items-center gap-1 px-2 pb-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Chip>
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      mode === 'agentic'
                        ? 'bg-destructive'
                        : mode === 'approve'
                          ? 'bg-[hsl(var(--warning))]'
                          : 'bg-muted-foreground'
                    )}
                  />
                  {MODE_LABEL[mode]}
                </Chip>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[15rem]">
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

            {activeId && (
              <span title="session ใช้งานอยู่" className="flex items-center text-[hsl(var(--success))]">
                <TerminalIcon className="size-3.5" />
              </span>
            )}

            <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1">
              {/* Provider */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Chip>
                    {PROVIDER_OPTS.find((p) => p.id === provider)?.label}
                  </Chip>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[9rem]">
                  <DropdownMenuLabel>Provider</DropdownMenuLabel>
                  {PROVIDER_OPTS.map((p, i) => (
                    <DropdownMenuItem
                      key={p.id}
                      checked={provider === p.id}
                      shortcut={String(i + 1)}
                      onSelect={() => pickProvider(p.id)}
                    >
                      {p.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Model */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Chip className="min-w-0">
                    <span className="max-w-[88px] truncate">{model || 'model'}</span>
                  </Chip>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-72 min-w-[15rem] overflow-y-auto">
                  <DropdownMenuLabel>โมเดล {PROVIDER_OPTS.find((p) => p.id === provider)?.label}</DropdownMenuLabel>
                  {MODEL_PRESETS[provider].map((m) => (
                    <DropdownMenuItem
                      key={m}
                      checked={model === m}
                      onSelect={() => pickModel(m)}
                      className="font-mono text-xs"
                    >
                      {m}
                    </DropdownMenuItem>
                  ))}
                  <div className="my-1 h-px bg-border" />
                  <div className="px-2 py-1 text-[11px] text-muted-foreground">
                    พิมพ์โมเดลเองได้ที่ Settings
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {running ? (
                <Button variant="destructive" size="icon-sm" className="size-8 shrink-0 rounded-lg" onClick={cancel}>
                  <Square className="size-3.5" />
                </Button>
              ) : (
                <Button
                  size="icon-sm"
                  className="size-8 shrink-0 rounded-lg"
                  onClick={send}
                  disabled={!configured || !input.trim()}
                >
                  <Send className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const Chip = forwardRef<
  HTMLButtonElement,
  { children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>
>(({ children, className, ...props }, ref) => (
  <button
    ref={ref}
    {...props}
    className={cn(
      'flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      className
    )}
  >
    {children}
    <ChevronDown className="size-3 shrink-0 opacity-60" />
  </button>
))
Chip.displayName = 'Chip'

function TypingDots(): JSX.Element {
  return (
    <span className="inline-flex gap-1">
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
    </span>
  )
}
