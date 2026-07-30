import { useEffect, useState, type ReactNode } from 'react'
import {
  KeyRound,
  Check,
  Trash2,
  ShieldCheck,
  Loader2,
  ChevronDown,
  Brain,
  RefreshCw,
  Languages
} from 'lucide-react'
import type { AiProvider, AiMode } from '@shared/types'
import { useSettings } from '../store/useSettings'
import { toast } from '../store/useToast'
import { MODEL_PRESETS } from '../lib/models'
import { AI_PROVIDERS, providerMeta } from '@shared/ai-providers'
import { Hint } from './ui/tooltip'
import { cn } from '../lib/utils'
import { useT, useLang } from '../lib/i18n'
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


export default function Settings({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): JSX.Element {
  const { settings, set, refresh } = useSettings()
  const t = useT()
  const lang = useLang((s) => s.lang)
  const setLang = useLang((s) => s.setLang)
  const [tab, setTab] = useState<'ai' | 'knowledge' | 'update'>('ai')
  const [keys, setKeys] = useState<Record<string, string>>({})
  // provider ที่กำลังตั้งค่าอยู่ (เลือกจาก dropdown ก่อน แล้วค่อยโชว์รายละเอียด)
  const [selected, setSelected] = useState<AiProvider>('openai')
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
            ? t('โหมด dev ยังไม่มีระบบอัปเดต (เฉพาะตัวติดตั้งจริง)')
            : `${t('ตรวจสอบไม่สำเร็จ')}: ${r.reason ?? 'unknown'}`,
          'error'
        )
      } else if (r.updateAvailable) {
        toast(`${t('พบเวอร์ชันใหม่')} ${r.version} — ${t('กำลังดาวน์โหลด…')}`)
      } else {
        toast(`${t('เป็นเวอร์ชันล่าสุดแล้ว')} (${r.currentVersion ?? appVersion}) ✓`)
      }
    } finally {
      setChecking(false)
    }
  }

  if (!settings) return <></>

  const labelOf = (p: AiProvider): string => providerMeta(p).label
  // provider ที่ตั้ง API key แล้ว — ใช้เป็น default ได้เฉพาะพวกนี้
  const connectedProviders = AI_PROVIDERS.filter((p) => settings?.ai.configured[p.id])

  const saveKey = async (p: AiProvider): Promise<void> => {
    const key = keys[p]?.trim()
    if (!key) return
    setBusy(p)
    try {
      set(await window.api.settings.setAiKey(p, key))
      setKeys((k) => ({ ...k, [p]: '' }))
      toast(`${t('บันทึก API key แล้ว')}: ${labelOf(p)}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : t('บันทึกไม่สำเร็จ'), 'error')
    } finally {
      setBusy(null)
    }
  }

  const clearKey = async (p: AiProvider): Promise<void> => {
    setBusy(p)
    set(await window.api.settings.clearAiKey(p))
    setBusy(null)
    toast(`${t('ลบ API key แล้ว')}: ${labelOf(p)}`)
  }

  const updateModel = async (p: AiProvider, model: string): Promise<void> => {
    set(await window.api.settings.updateAi({ models: { [p]: model } }))
  }

  const selectModel = async (p: AiProvider, model: string): Promise<void> => {
    await updateModel(p, model)
    toast(`${t('เลือกโมเดล')}: ${model}`)
  }

  const updateDefault = async (patch: {
    defaultProvider?: AiProvider
    defaultMode?: AiMode
  }): Promise<void> => {
    set(await window.api.settings.updateAi(patch))
    toast(t('บันทึกการตั้งค่าแล้ว'))
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[82vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        {/* ภาษา */}
        <div className="flex shrink-0 items-center gap-2">
          <Languages className="size-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{t('ภาษา')}</span>
          <div className="ml-auto flex gap-1 rounded-lg bg-secondary/40 p-0.5">
            {(['th', 'en'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  lang === l ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {l === 'th' ? 'ไทย' : 'English'}
              </button>
            ))}
          </div>
        </div>

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
            {t('คลังความรู้')}
          </TabBtn>
          <TabBtn
            active={tab === 'update'}
            onClick={() => setTab('update')}
            icon={<RefreshCw className="size-3.5" />}
          >
            {t('อัปเดต')}
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
                    {t('เวอร์ชันปัจจุบัน')}{' '}
                    <span className="font-mono text-foreground">{appVersion || '—'}</span>
                  </div>
                </div>
                <Button className="ml-auto" onClick={checkUpdate} disabled={checking}>
                  {checking ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  {t('ตรวจสอบอัปเดต')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {tab === 'ai' && (
          <div className="-mr-2 min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
        <div className="flex items-start gap-2 rounded-lg border border-border bg-background/40 px-3 py-2.5 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[hsl(var(--success))]" />
          <span>
            {t('API key ถูกเข้ารหัสเก็บในเครื่องคุณด้วย Keychain ของระบบ (ไม่ส่งออกที่ไหน) — ครั้งแรก macOS อาจถามขออนุญาตเข้าถึง Keychain กด “Always Allow” ได้เลย ปลอดภัย')}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="size-4 text-primary" /> AI Providers
          </div>
          {/* สรุปว่าเชื่อมต่ออะไรแล้วบ้าง */}
          <span className="text-[11px] text-muted-foreground">
            {connectedProviders.length
              ? `${t('เชื่อมต่อแล้ว')}: ${connectedProviders.map((p) => p.label).join(', ')}`
              : t('ยังไม่ได้เชื่อมต่อ provider ใด')}
          </span>
        </div>

        {/* เลือก provider ที่จะตั้งค่าก่อน แล้วค่อยโชว์รายละเอียดตัวนั้น */}
        <div className="flex flex-col gap-1.5">
          <Label>{t('เลือกผู้ให้บริการ AI')}</Label>
          <Select value={selected} onValueChange={(v) => setSelected(v as AiProvider)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_PROVIDERS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex items-center gap-2">
                    {settings.ai.configured[p.id] ? (
                      <Check className="size-3 text-[hsl(var(--success))]" />
                    ) : (
                      <span className="size-3" />
                    )}
                    {p.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* การ์ดตั้งค่าของ provider ที่เลือก */}
        {(() => {
          const meta = providerMeta(selected)
          const configured = settings.ai.configured[selected]
          return (
            <div className="rounded-xl border border-border bg-background/40 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{meta.label}</span>
                  {configured ? (
                    <Badge variant="success">
                      <Check className="size-2.5" /> {t('ตั้งค่าแล้ว')}
                    </Badge>
                  ) : (
                    <Badge variant="outline">{t('ยังไม่ตั้ง')}</Badge>
                  )}
                </div>
                <button
                  onClick={() => window.api.openExternal(meta.keyUrl)}
                  className="shrink-0 text-[11px] text-primary transition-colors hover:underline"
                >
                  {t('ขอ API key')} ↗
                </button>
              </div>
              {meta.note && (
                <p className="mb-2.5 text-[11px] text-muted-foreground">{meta.note}</p>
              )}
              <div className="mb-3 flex gap-2">
                <Input
                  type="password"
                  placeholder={configured ? t('•••••••• (เปลี่ยน key)') : meta.keyHint}
                  value={keys[selected] ?? ''}
                  onChange={(e) => setKeys((k) => ({ ...k, [selected]: e.target.value }))}
                />
                <Button onClick={() => saveKey(selected)} disabled={busy === selected || !keys[selected]}>
                  {busy === selected ? <Loader2 className="size-4 animate-spin" /> : t('บันทึก')}
                </Button>
                {configured && (
                  <Hint label={t('ลบ API key')}>
                    <Button variant="outline" size="icon" onClick={() => clearKey(selected)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </Hint>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Label className="w-12">Model</Label>
                <div className="flex flex-1 gap-2">
                  <Input
                    value={settings.ai.models[selected]}
                    onChange={(e) => updateModel(selected, e.target.value)}
                    placeholder={t('เลือกหรือพิมพ์ชื่อโมเดล')}
                    className="flex-1 font-mono text-xs"
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Hint label={t('เลือกโมเดล')}>
                        <Button variant="outline" size="icon">
                          <ChevronDown className="size-4" />
                        </Button>
                      </Hint>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="max-h-72 min-w-[16rem] overflow-y-auto">
                      <DropdownMenuLabel>
                        {t('โมเดล')} {meta.label}
                      </DropdownMenuLabel>
                      {MODEL_PRESETS[selected].map((m) => (
                        <DropdownMenuItem
                          key={m}
                          checked={settings.ai.models[selected] === m}
                          onSelect={() => selectModel(selected, m)}
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
        })()}

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t('Provider เริ่มต้น')}</Label>
            {/* เลือกได้เฉพาะเจ้าที่เชื่อมต่อแล้ว */}
            <Select
              value={settings.ai.defaultProvider}
              onValueChange={(v) => updateDefault({ defaultProvider: v as AiProvider })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {connectedProviders.length === 0 ? (
                  <SelectItem value={settings.ai.defaultProvider} disabled>
                    {t('ยังไม่มีที่เชื่อมต่อ')}
                  </SelectItem>
                ) : (
                  connectedProviders.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t('โหมด AI เริ่มต้น')}</Label>
            <Select
              value={settings.ai.defaultMode}
              onValueChange={(v) => updateDefault({ defaultMode: v as AiMode })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="suggest">{t('แนะนำเฉยๆ')}</SelectItem>
                <SelectItem value="approve">{t('อนุมัติก่อนรัน')}</SelectItem>
                <SelectItem value="agentic">{t('Agentic (รันเอง)')}</SelectItem>
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
