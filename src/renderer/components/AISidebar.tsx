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
  RotateCcw,
  Globe
} from 'lucide-react'
import type { AiMode, AiProvider } from '@shared/types'
import { useSettings } from '../store/useSettings'
import { useTabs } from '../store/useTabs'
import { useAiDraft } from '../store/useAiDraft'
import { useAiChats, EMPTY_THREAD } from '../store/useAiChats'
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
import { useT } from '../lib/i18n'

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
  const t = useT()
  const { settings } = useSettings()
  const { activeId } = useTabs()
  const chatKey = activeId ?? '__none__' // แต่ละ tab/session มีบทสนทนาของตัวเอง
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const draftSeq = useAiDraft((s) => s.seq)

  // บทสนทนา + ค่าตั้งของ tab ปัจจุบัน (per-session)
  const thread = useAiChats((s) => s.threads[chatKey]) ?? EMPTY_THREAD
  const send = useAiChats((s) => s.send)
  const setInput = useAiChats((s) => s.setInput)
  const appendInput = useAiChats((s) => s.appendInput)
  const setConfig = useAiChats((s) => s.setConfig)
  const clearChat = useAiChats((s) => s.clear)
  const approveAction = useAiChats((s) => s.approve)
  const cancelAction = useAiChats((s) => s.cancel)

  const { items, input, running, approval } = thread

  // ค่าตั้งของ session นี้ (ถ้ายังไม่เคยตั้ง ใช้ default จาก settings)
  const provider: AiProvider = thread.provider ?? settings?.ai.defaultProvider ?? 'anthropic'
  const mode: AiMode = thread.mode ?? settings?.ai.defaultMode ?? 'approve'
  const model = thread.model ?? settings?.ai.models[provider] ?? ''
  const webSearch = thread.webSearch ?? true

  const setMode = (m: AiMode): void => setConfig(chatKey, { mode: m })
  const pickProvider = (p: AiProvider): void =>
    setConfig(chatKey, { provider: p, model: settings?.ai.models[p] })
  const pickModel = (m: string): void => setConfig(chatKey, { model: m })
  const toggleWeb = (): void => setConfig(chatKey, { webSearch: !webSearch })

  // ข้อความที่ "ส่งเข้า AI" จาก terminal → เติมในช่อง input ของ tab ปัจจุบัน
  useEffect(() => {
    if (draftSeq === 0) return
    appendInput(chatKey, useAiDraft.getState().text)
    inputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftSeq])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [items, approval])

  const configured = settings?.ai.configured[provider]

  // web search ใช้ได้เฉพาะ provider ที่รองรับ + ไม่ใช่โหมด agentic
  const webSupported = provider === 'anthropic' || provider === 'google'
  const webOn = webSearch && webSupported && mode !== 'agentic'

  const doSend = (): void => {
    void send(chatKey, activeId, { provider, model: model || undefined, mode, webSearch: webOn })
  }
  const respondApproval = (approved: boolean): void => approveAction(chatKey, approved)
  const cancel = (): void => cancelAction(chatKey)

  return (
    <div className="flex h-full shrink-0 flex-col border-l border-border bg-sidebar" style={{ width }}>
      <div className="titlebar flex h-titlebar shrink-0 items-center gap-2 border-b border-border px-3">
        <div className="flex size-6 items-center justify-center rounded-md bg-primary/15">
          <Bot className="size-4 text-primary" />
        </div>
        <span className="text-sm font-semibold tracking-tight">AI Agent</span>
        {items.length > 0 && (
          <button
            onClick={() => clearChat(chatKey)}
            title={t("ล้างแชท")}
            className="no-drag ml-auto flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
          </button>
        )}
      </div>

      {!configured && (
        <div className="flex items-center gap-2 border-b border-border bg-[hsl(var(--warning))]/10 px-3 py-2 text-xs text-[hsl(var(--warning))]">
          <AlertTriangle className="size-3.5 shrink-0" />
          {t('ยังไม่ได้ตั้ง API key ของ')} {provider} — {t('ไปที่ Settings')}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-3">
        {items.length === 0 && (
          <div className="mt-10 flex flex-col items-center gap-3 px-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15">
              <Sparkles className="size-6 text-primary" />
            </div>
            <p className="text-sm font-medium">{t("ถาม AI เกี่ยวกับ server ได้เลย")}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("เช่น “เช็ค disk ว่าตัวไหนเต็ม” หรือ “หา process ที่กิน CPU สูงสุด”")}
              {!activeId && (
                <>
                  <br />
                  <span className="text-[hsl(var(--warning))]">{t("เปิด terminal session ก่อนเพื่อให้ AI รันคำสั่งได้")}</span>
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
          <div
            className={cn(
              'animate-slide-up rounded-xl border p-3',
              approval.danger
                ? 'border-destructive/50 bg-destructive/10'
                : 'border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/5'
            )}
          >
            <div
              className={cn(
                'mb-2 flex items-center gap-1.5 text-xs font-medium',
                approval.danger ? 'text-destructive' : 'text-[hsl(var(--warning))]'
              )}
            >
              <AlertTriangle className="size-3.5" />
              {approval.danger ? t("คำสั่งอันตราย — ต้องยืนยันก่อนรัน") : t("AI ขออนุมัติรันคำสั่ง")}
            </div>
            {approval.danger && (
              <div className="mb-2 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                ⚠️ {approval.danger} · {t('ตรวจให้ดีก่อนอนุมัติ')}
              </div>
            )}
            <pre className="mb-3 overflow-x-auto rounded-lg bg-black/40 px-3 py-2 font-mono text-xs text-foreground">
              {approval.command}
            </pre>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => respondApproval(false)}>
                <X className="size-3.5" /> {t("ปฏิเสธ")}
              </Button>
              <Button size="sm" onClick={() => respondApproval(true)} className="bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90">
                <Check className="size-3.5" /> {t("อนุมัติ & รัน")}
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
            placeholder={t("พิมพ์คำถามถึง AI… (รองรับ Markdown)")}
            value={input}
            onChange={(e) => setInput(chatKey, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                doSend()
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
                  {t(MODE_LABEL[mode])}
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
                      <span>{t(m.label)}</span>
                      <span className="text-[11px] font-normal text-muted-foreground">{t(m.desc)}</span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Web search toggle */}
            <button
              onClick={toggleWeb}
              disabled={!webSupported || mode === 'agentic'}
              title={
                mode === 'agentic'
                  ? t('web search ปิดในโหมด agentic (กัน prompt injection)')
                  : !webSupported
                    ? t('web search รองรับเฉพาะ Anthropic / Google')
                    : webOn
                      ? t('web search: เปิด')
                      : t('web search: ปิด')
              }
              className={cn(
                'flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium transition-colors disabled:opacity-40',
                webOn
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Globe className="size-3.5" /> Web
            </button>

            {activeId && (
              <span title={t("session ใช้งานอยู่")} className="flex items-center text-[hsl(var(--success))]">
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
                  <DropdownMenuLabel>{t('โมเดล')} {PROVIDER_OPTS.find((p) => p.id === provider)?.label}</DropdownMenuLabel>
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
                    {t("พิมพ์โมเดลเองได้ที่ Settings")}
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
                  onClick={doSend}
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
