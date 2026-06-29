import { useEffect, useState } from 'react'
import { KeyRound, Check, Trash2, ShieldAlert, Loader2, ChevronDown } from 'lucide-react'
import type { AiProvider, AiMode } from '@shared/types'
import { useSettings } from '../store/useSettings'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
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

// preset โมเดลให้เลือก (พิมพ์เองได้ถ้าไม่มีในลิสต์)
const MODEL_PRESETS: Record<AiProvider, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o3', 'o4-mini', 'gpt-4-turbo'],
  anthropic: [
    'claude-opus-4-8',
    'claude-sonnet-4-6',
    'claude-haiku-4-5-20251001',
    'claude-fable-5',
    'claude-3-7-sonnet-latest',
    'claude-3-5-haiku-latest'
  ],
  google: [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.0-pro',
    'gemini-1.5-pro',
    'gemini-1.5-flash'
  ]
}

export default function Settings({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): JSX.Element {
  const { settings, set, refresh } = useSettings()
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!settings) return <></>

  const saveKey = async (p: AiProvider): Promise<void> => {
    const key = keys[p]?.trim()
    if (!key) return
    setBusy(p)
    set(await window.api.settings.setAiKey(p, key))
    setKeys((k) => ({ ...k, [p]: '' }))
    setBusy(null)
  }

  const clearKey = async (p: AiProvider): Promise<void> => {
    setBusy(p)
    set(await window.api.settings.clearAiKey(p))
    setBusy(null)
  }

  const updateModel = async (p: AiProvider, model: string): Promise<void> => {
    set(await window.api.settings.updateAi({ models: { [p]: model } }))
  }

  const updateDefault = async (patch: {
    defaultProvider?: AiProvider
    defaultMode?: AiMode
  }): Promise<void> => {
    set(await window.api.settings.updateAi(patch))
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>API keys และค่าเริ่มต้นของ AI agent</DialogDescription>
        </DialogHeader>

        {!settings.encryptionAvailable && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <ShieldAlert className="size-4 shrink-0" />
            ระบบเข้ารหัสของ OS (safeStorage) ไม่พร้อม — API key/รหัสผ่านอาจเก็บไม่ปลอดภัย
          </div>
        )}

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
                            onSelect={() => updateModel(p.id, m)}
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
      </DialogContent>
    </Dialog>
  )
}
