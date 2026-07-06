import { useEffect, useState, type ReactNode } from 'react'
import {
  KeyRound,
  Check,
  Trash2,
  ShieldCheck,
  Loader2,
  ChevronDown,
  Brain,
  RefreshCw
} from 'lucide-react'
import type { AiProvider, AiMode } from '@shared/types'
import { useSettings } from '../store/useSettings'
import { toast } from '../store/useToast'
import { MODEL_PRESETS } from '../lib/models'
import { cn } from '../lib/utils'
import { logoUrl } from '../lib/logo'
import KnowledgePanel from './KnowledgePanel'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem
} from './ui/dropdown-menu'

const PROVIDERS: { id: AiProvider; label: string; placeholder: string }[] = [
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-…' },
  { id: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-…' },
  { id: 'google', label: 'Google', placeholder: 'AIza…' }
]

export default function Settings({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): JSX.Element {
  const { settings, set, refresh } = useSettings()
  const [tab, setTab] = useState<'ai' | 'knowledge' | 'update'>('ai')
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [appVersion, setAppVersion] = useState('')
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    void refresh()
    void window.api.appVersion().then(setAppVersion)
  }, [refresh])

  const checkUpdate = async (): Promise<void> => {
    setChecking(true)
    try {
      const r = await window.api.updates.check()
      if (!r.ok) {
        toast(
          r.reason === 'dev'
            ? 'โหมด dev ยังไม่มีระบบอัปเดต (เฉพาะตัวติดตั้งจริง)'
            : `ตรวจสอบไม่สำเร็จ: ${r.reason ?? 'unknown'}`,
          'error'
        )
      } else if (r.updateAvailable) {
        toast(`พบเวอร์ชันใหม่ ${r.version} — กำลังดาวน์โหลด…`)
      } else {
        toast(`เป็นเวอร์ชันล่าสุดแล้ว (${r.currentVersion ?? appVersion}) ✓`)
      }
    } finally {
      setChecking(false)
    }
  }

  if (!settings) return <></>

  const labelOf = (p: AiProvider): string => PROVIDERS.find((x) => x.id === p)?.label ?? p

  const saveKey = async (p: AiProvider): Promise<void> => {
    const key = keys[p]?.trim()
    if (!key) return
    setBusy(p)
    try {
      set(await window.api.settings.setAiKey(p, key))
      setKeys((k) => ({ ...k, [p]: '' }))
      toast(`บันทึก API key ของ ${labelOf(p)} แล้ว`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ', 'error')
    } finally {
      setBusy(null)
    }
  }

  const clearKey = async (p: AiProvider): Promise<void> => {
    setBusy(p)
    set(await window.api.settings.clearAiKey(p))
    setBusy(null)
    toast(`ลบ API key ของ ${labelOf(p)} แล้ว`)
  }

  const updateModel = async (p: AiProvider, model: string): Promise<void> => {
    set(await window.api.settings.updateAi({ models: { [p]: model } }))
  }

  const selectModel = async (p: AiProvider, model: string): Promise<void> => {
    await updateModel(p, model)
    toast(`เลือกโมเดล ${model}`)
  }

  const updateDefault = async (patch: {
    defaultProvider?: AiProvider
    defaultMode?: AiMode
  }): Promise<void> => {
    set(await window.api.settings.updateAi(patch))
    toast('บันทึกการตั้งค่าแล้ว')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[82vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        {/* tabs */}
        <div className="flex shrink-0 gap-1 rounded-lg bg-secondary/40 p-1">
          <TabBtn active={tab === 'ai'} onClick={() => setTab('ai')} icon={<KeyRound className="size-3.5" />}>
            AI
          </TabBtn>
          <TabBtn
            active={tab === 'knowledge'}
            onClick={() => setTab('knowledge')}
            icon={<Brain className="size-3.5" />}
          >
            คลังความรู้
          </TabBtn>
          <TabBtn
            active={tab === 'update'}
            onClick={() => setTab('update')}
            icon={<RefreshCw className="size-3.5" />}
          >
            อัปเดต
          </TabBtn>
        </div>

        {tab === 'knowledge' && <KnowledgePanel />}

        {tab === 'update' && (
          <div className="-mr-2 min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
            <div className="rounded-xl border border-border bg-background/40 p-4">
              <div className="flex items-center gap-3">
                <img src={logoUrl} alt="Perms" className="size-11 rounded-xl shadow-sm" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Perms</div>
                  <div className="text-xs text-muted-foreground">
                    เวอร์ชันปัจจุบัน{' '}
                    <span className="font-mono text-foreground">{appVersion || '—'}</span>
                  </div>
                </div>
                <Button className="ml-auto" onClick={checkUpdate} disabled={checking}>
                  {checking ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  ตรวจสอบอัปเดต
                </Button>
              </div>
              <Separator className="my-3" />
              <p className="text-xs text-muted-foreground">
                แอปจะตรวจสอบอัปเดตอัตโนมัติ<span className="text-foreground">ทุก 30 นาที</span>{' '}
                และตอนเปิดแอป — เมื่อพบเวอร์ชันใหม่จะดาวน์โหลดให้เอง แล้วเด้งแจ้งให้รีสตาร์ท
              </p>
            </div>
          </div>
        )}

        {tab === 'ai' && (
          <div className="-mr-2 min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
        <div className="flex items-start gap-2 rounded-lg border border-border bg-background/40 px-3 py-2.5 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[hsl(var(--success))]" />
          <span>
            API key ถูก<span className="text-foreground">เข้ารหัสเก็บในเครื่องคุณ</span>ด้วย Keychain ของ
            ระบบ (ไม่ส่งออกที่ไหน) — ครั้งแรก macOS อาจถามขออนุญาตเข้าถึง Keychain
            กด <span className="font-medium text-foreground">“Always Allow”</span> ได้เลย ปลอดภัย
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm font-medium">
          <KeyRound className="size-4 text-primary" /> AI Providers
        </div>

        <div className="space-y-3">
          {PROVIDERS.map((p) => {
            const configured = settings.ai.configured[p.id]
            return (
              <div key={p.id} className="rounded-xl border border-border bg-background/40 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold">{p.label}</span>
                  {configured ? (
                    <Badge variant="success">
                      <Check className="size-2.5" /> ตั้งค่าแล้ว
                    </Badge>
                  ) : (
                    <Badge variant="outline">ยังไม่ตั้ง</Badge>
                  )}
                </div>
                <div className="mb-3 flex gap-2">
                  <Input
                    type="password"
                    placeholder={configured ? '•••••••• (เปลี่ยน key)' : p.placeholder}
                    value={keys[p.id] ?? ''}
                    onChange={(e) => setKeys((k) => ({ ...k, [p.id]: e.target.value }))}
                  />
                  <Button onClick={() => saveKey(p.id)} disabled={busy === p.id || !keys[p.id]}>
                    {busy === p.id ? <Loader2 className="size-4 animate-spin" /> : 'บันทึก'}
                  </Button>
                  {configured && (
                    <Button variant="outline" size="icon" onClick={() => clearKey(p.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-12">Model</Label>
                  <div className="flex flex-1 gap-2">
                    <Input
                      value={settings.ai.models[p.id]}
                      onChange={(e) => updateModel(p.id, e.target.value)}
                      placeholder="เลือกหรือพิมพ์ชื่อโมเดล"
                      className="flex-1 font-mono text-xs"
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" title="เลือกโมเดล">
                          <ChevronDown className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="max-h-72 min-w-[16rem] overflow-y-auto">
                        <DropdownMenuLabel>โมเดล {p.label}</DropdownMenuLabel>
                        {MODEL_PRESETS[p.id].map((m) => (
                          <DropdownMenuItem
                            key={m}
                            checked={settings.ai.models[p.id] === m}
                            onSelect={() => selectModel(p.id, m)}
                            className="font-mono text-xs"
                          >
                            {m}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Provider เริ่มต้น</Label>
            <Select
              value={settings.ai.defaultProvider}
              onValueChange={(v) => updateDefault({ defaultProvider: v as AiProvider })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="google">Google</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>โหมด AI เริ่มต้น</Label>
            <Select
              value={settings.ai.defaultMode}
              onValueChange={(v) => updateDefault({ defaultMode: v as AiMode })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="suggest">แนะนำเฉยๆ</SelectItem>
                <SelectItem value="approve">อนุมัติก่อนรัน</SelectItem>
                <SelectItem value="agentic">Agentic (รันเอง)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function TabBtn({
  active,
  onClick,
  icon,
  children
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  children: ReactNode
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {icon}
      {children}
    </button>
  )
}
