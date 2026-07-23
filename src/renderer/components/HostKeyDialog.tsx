import { useEffect, useState } from 'react'
import { ShieldAlert, ShieldQuestion, Copy } from 'lucide-react'
import type { HostKeyPrompt } from '@shared/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Hint } from './ui/tooltip'
import { Button } from './ui/button'
import { useT } from '../lib/i18n'
import { toast } from '../store/useToast'

/**
 * ถามผู้ใช้เมื่อเจอ host key ที่ยังไม่เคยยอมรับ หรือเมื่อ key เปลี่ยนไป
 * ตั้งใจให้กรณี "เปลี่ยน" ดูน่ากลัวและกดยอมรับยากกว่ากรณี "ครั้งแรก"
 * เพราะอย่างหลังคือความเสี่ยงโดนดักกลางทางจริง ๆ
 */
export default function HostKeyDialog(): JSX.Element | null {
  const t = useT()
  const [queue, setQueue] = useState<HostKeyPrompt[]>([])
  const [ack, setAck] = useState(false)

  useEffect(() => {
    return window.api.hostKeys.onPrompt((p) => setQueue((q) => [...q, p]))
  }, [])

  const current = queue[0]
  useEffect(() => setAck(false), [current?.id])

  if (!current) return null

  const changed = current.verdict === 'changed'

  const respond = (accepted: boolean): void => {
    window.api.hostKeys.respond(current.id, accepted)
    setQueue((q) => q.slice(1))
  }

  const copy = (text: string): void => {
    void navigator.clipboard.writeText(text)
    toast(t('คัดลอกแล้ว'))
  }

  return (
    <Dialog open onOpenChange={(o) => !o && respond(false)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {changed ? (
              <ShieldAlert className="size-5 text-destructive" />
            ) : (
              <ShieldQuestion className="size-5 text-primary" />
            )}
            {changed ? t('ลายนิ้วมือเซิร์ฟเวอร์เปลี่ยนไป') : t('ยืนยันตัวตนเซิร์ฟเวอร์')}
          </DialogTitle>
          <DialogDescription>
            {changed
              ? t('อาจมีคนดักกลางทาง (MITM) หรือเซิร์ฟเวอร์ถูกติดตั้งใหม่ — อย่ายอมรับถ้าไม่แน่ใจ')
              : t('ยังไม่เคยเชื่อมต่อเครื่องนี้มาก่อน ตรวจลายนิ้วมือให้ตรงกับเซิร์ฟเวอร์จริงก่อนยอมรับ')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-border bg-secondary/40 p-3">
            <div className="text-xs text-muted-foreground">{t('เซิร์ฟเวอร์')}</div>
            <div className="font-medium">
              {current.serverName}{' '}
              <span className="font-mono text-xs text-muted-foreground">
                ({current.host}:{current.port})
              </span>
            </div>
          </div>

          {changed && current.previousFingerprint && (
            <div className="rounded-lg border border-border bg-secondary/40 p-3">
              <div className="text-xs text-muted-foreground">{t('ลายนิ้วมือเดิมที่เคยยอมรับ')}</div>
              <div className="break-all font-mono text-xs text-muted-foreground line-through">
                {current.previousFingerprint}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {current.previousKeyType}
              </div>
            </div>
          )}

          <div
            className={`rounded-lg border p-3 ${
              changed ? 'border-destructive/50 bg-destructive/10' : 'border-border bg-secondary/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {changed ? t('ลายนิ้วมือใหม่ที่ได้รับตอนนี้') : t('ลายนิ้วมือ')}
              </div>
              <Hint label={t('คัดลอก')}>
                <button
                  onClick={() => copy(current.fingerprint)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Copy className="size-3.5" />
                </button>
              </Hint>
            </div>
            <div className="break-all font-mono text-xs">{current.fingerprint}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{current.keyType}</div>
          </div>

          <p className="text-xs text-muted-foreground">
            {t('ตรวจได้จากเซิร์ฟเวอร์โดยตรงด้วยคำสั่ง')}{' '}
            <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px]">
              ssh-keygen -lf /etc/ssh/ssh_host_{current.keyType.replace(/^ssh-/, '')}_key.pub
            </code>
          </p>

          {changed && (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 text-xs">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                className="mt-0.5 accent-destructive"
              />
              <span>
                {t('ฉันตรวจกับผู้ดูแลเซิร์ฟเวอร์แล้วว่าการเปลี่ยนแปลงนี้ถูกต้อง และยอมรับความเสี่ยง')}
              </span>
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => respond(false)}>
            {t('ยกเลิกการเชื่อมต่อ')}
          </Button>
          <Button
            size="sm"
            variant={changed ? 'destructive' : 'default'}
            disabled={changed && !ack}
            onClick={() => respond(true)}
          >
            {changed ? t('ยอมรับ key ใหม่') : t('ยอมรับและจำไว้')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
