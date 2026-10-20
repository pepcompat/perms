import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, Loader2, LogIn, RefreshCw } from 'lucide-react'
import type { AiCliStatus, AiProvider, AppSettings } from '@shared/types'
import { providerMeta } from '@shared/ai-providers'
import { useTabs } from '../store/useTabs'
import { toast } from '../store/useToast'
import { useT } from '../lib/i18n'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

/**
 * ตั้งค่า provider แบบ subscription (codex / claude CLI) — ไม่มี API key
 * Perms แค่ถามสถานะจาก CLI และพาไป login ใน terminal ของผู้ใช้เอง ไม่แตะ token ใด ๆ
 */
export default function AiCliSection({
  provider,
  onSettings,
  onClose
}: {
  provider: AiProvider
  onSettings: (s: AppSettings) => void
  onClose: () => void
}): JSX.Element {
  const t = useT()
  const meta = providerMeta(provider)
  const cli = meta.cli!
  const addTab = useTabs((s) => s.addTab)
  const [status, setStatus] = useState<AiCliStatus | null>(null)
  const [loading, setLoading] = useState(false)

  const check = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      setStatus(await window.api.ai.cliStatus(provider))
    } finally {
      setLoading(false)
    }
  }, [provider])

  useEffect(() => {
    setStatus(null)
    void check()
  }, [check])

  // login ต้องทำในโปรแกรมของเจ้าของเอง → เปิด terminal local แล้วพิมพ์คำสั่ง login ให้
  const login = async (): Promise<void> => {
    try {
      const res = await window.api.terminal.open({ cols: 100, rows: 30 })
      addTab({ sessionId: res.sessionId, title: res.title, kind: res.kind, serverId: null })
      setTimeout(() => window.api.terminal.write(res.sessionId, `${cli.loginCommand}\r`), 800)
      onClose()
      toast(t('ทำตามขั้นตอน login ใน terminal แล้วกลับมากด "ตรวจอีกครั้ง"'))
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error')
    }
  }

  const setEnabled = async (enabled: boolean): Promise<void> => {
    onSettings(await window.api.ai.setCliEnabled(provider, enabled))
    setStatus((s) => (s ? { ...s, enabled } : s))
    toast(enabled ? `${t('เปิดใช้แล้ว')}: ${meta.label}` : `${t('ปิดใช้แล้ว')}: ${meta.label}`)
  }

  const ready = !!status?.installed && status.loggedIn

  return (
    <div className="mb-3 flex flex-col gap-2.5">
      {cli.experimental && (
        <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-[11px] leading-relaxed">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
          <div>
            <b>{t('โหมดทดลอง — มีความเสี่ยงด้านเงื่อนไขการใช้งาน')}</b>
            <br />
            {t(
              'Anthropic ไม่อนุญาตให้แอปภายนอกให้ผู้ใช้ login ด้วยบัญชี Claude หรือส่งคำขอผ่านแพ็ก Free/Pro/Max แทนผู้ใช้ แต่ไม่ห้ามผู้ใช้ใช้ Claude Code ของตัวเองที่ login ด้วยแพ็กของตัวเอง — Perms ใช้วิธีหลัง (สั่ง Claude Code ที่ติดตั้งในเครื่องคุณ ไม่แตะ token) แต่ยังไม่ได้รับรองชัดเจน Anthropic อาจจำกัดหรือระงับการใช้งานได้โดยไม่แจ้ง และโควตาแพ็กคิดจากการใช้งานปกติของคนคนเดียว ถ้าต้องการความแน่นอนให้ใช้ API key'
            )}{' '}
            <button
              onClick={() => window.api.openExternal(meta.keyUrl)}
              className="text-primary hover:underline"
            >
              {t('อ่านเงื่อนไข')} ↗
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {!status ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> {t('กำลังตรวจ…')}
          </span>
        ) : !status.installed ? (
          <Badge variant="outline">
            {t('ไม่พบ')} {cli.bin} CLI
          </Badge>
        ) : (
          <>
            <Badge variant="outline" className="font-mono">
              {status.version ?? cli.bin}
            </Badge>
            {status.loggedIn ? (
              <Badge variant="success">
                <Check className="size-2.5" /> {t('login แล้ว')}
                {status.authMethod ? ` · ${status.authMethod}` : ''}
              </Badge>
            ) : (
              <Badge variant="outline">{t('ยังไม่ login')}</Badge>
            )}
          </>
        )}
        <Button variant="ghost" size="sm" onClick={() => void check()} disabled={loading}>
          <RefreshCw className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} /> {t('ตรวจอีกครั้ง')}
        </Button>
      </div>

      {status && !status.installed && (
        <p className="text-[11px] text-muted-foreground">
          {cli.bin === 'codex'
            ? t('ติดตั้ง Codex CLI ก่อน (เช่น npm i -g @openai/codex) แล้วกดตรวจอีกครั้ง')
            : t('ติดตั้ง Claude Code CLI ก่อน แล้วกดตรวจอีกครั้ง')}
        </p>
      )}
      {status?.error && <p className="text-[11px] text-destructive">{status.error}</p>}

      <div className="flex flex-wrap gap-2">
        {status?.installed && !status.loggedIn && (
          <Button variant="outline" size="sm" onClick={() => void login()}>
            <LogIn className="size-3.5" /> {t('Login ใน terminal')} ({cli.loginCommand})
          </Button>
        )}
        {status?.enabled ? (
          <Button variant="outline" size="sm" onClick={() => void setEnabled(false)}>
            {t('ปิดใช้')}
          </Button>
        ) : (
          <Button size="sm" disabled={!ready} onClick={() => void setEnabled(true)}>
            {cli.experimental ? t('ยอมรับความเสี่ยงและเปิดใช้') : t('เปิดใช้')}
          </Button>
        )}
      </div>
    </div>
  )
}
