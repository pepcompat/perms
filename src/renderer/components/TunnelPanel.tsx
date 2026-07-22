import { useEffect, useState } from 'react'
import { Waypoints, Plus, X, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react'
import type { TunnelInfo } from '@shared/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { cn } from '../lib/utils'
import { useT } from '../lib/i18n'
import { toast } from '../store/useToast'

export default function TunnelPanel({
  sessionId,
  open,
  onClose
}: {
  sessionId: string
  open: boolean
  onClose: () => void
}): JSX.Element {
  const t = useT()
  const [tunnels, setTunnels] = useState<TunnelInfo[]>([])
  const [type, setType] = useState<'local' | 'remote'>('local')
  const [listenPort, setListenPort] = useState('')
  const [destHost, setDestHost] = useState('127.0.0.1')
  const [destPort, setDestPort] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    void window.api.tunnels.list(sessionId).then(setTunnels)
    return window.api.tunnels.onUpdate((all) =>
      setTunnels(all.filter((x) => x.sessionId === sessionId))
    )
  }, [open, sessionId])

  const create = async (): Promise<void> => {
    const lp = Number(listenPort)
    const dp = Number(destPort)
    if (!Number.isInteger(lp) || lp < 1 || lp > 65535) return toast(t('พอร์ตไม่ถูกต้อง'), 'error')
    if (!Number.isInteger(dp) || dp < 1 || dp > 65535) return toast(t('พอร์ตไม่ถูกต้อง'), 'error')
    if (!destHost.trim()) return toast(t('ต้องระบุปลายทาง'), 'error')

    setBusy(true)
    try {
      await window.api.tunnels.open({
        sessionId,
        type,
        listenPort: lp,
        destHost: destHost.trim(),
        destPort: dp
      })
      toast(t('เปิดอุโมงค์แล้ว'))
      setListenPort('')
      setDestPort('')
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Waypoints className="size-4 text-primary" />
            {t('อุโมงค์ SSH (Port forward)')}
          </DialogTitle>
          <DialogDescription>
            {t('ส่งต่อพอร์ตผ่านการเชื่อมต่อ SSH ที่เปิดอยู่ — เช่น ต่อฐานข้อมูลหลัง firewall จากเครื่องเรา')}
          </DialogDescription>
        </DialogHeader>

        {/* ฟอร์มสร้าง */}
        <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
          <div className="flex gap-1.5">
            <button
              onClick={() => setType('local')}
              className={cn(
                'flex-1 rounded-md border px-2.5 py-1.5 text-xs transition-colors',
                type === 'local'
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent'
              )}
            >
              <ArrowRight className="mr-1 inline size-3" />
              {t('Local — เปิดพอร์ตในเครื่องเรา')}
            </button>
            <button
              onClick={() => setType('remote')}
              className={cn(
                'flex-1 rounded-md border px-2.5 py-1.5 text-xs transition-colors',
                type === 'remote'
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent'
              )}
            >
              <ArrowLeft className="mr-1 inline size-3" />
              {t('Remote — เปิดพอร์ตบนเซิร์ฟเวอร์')}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">
                {type === 'local' ? t('พอร์ตในเครื่อง') : t('พอร์ตบนเซิร์ฟเวอร์')}
              </Label>
              <Input
                value={listenPort}
                onChange={(e) => setListenPort(e.target.value)}
                placeholder="5433"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">{t('ปลายทาง (host)')}</Label>
              <Input
                value={destHost}
                onChange={(e) => setDestHost(e.target.value)}
                placeholder="127.0.0.1"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">{t('ปลายทาง (พอร์ต)')}</Label>
              <Input
                value={destPort}
                onChange={(e) => setDestPort(e.target.value)}
                placeholder="5432"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            {type === 'local'
              ? t('เปิดพอร์ตที่ 127.0.0.1 ในเครื่องเรา แล้ววิ่งผ่าน SSH ไปหาปลายทางที่มองเห็นจากเซิร์ฟเวอร์')
              : t('เปิดพอร์ตบนเซิร์ฟเวอร์ แล้ววิ่งกลับมาหาปลายทางที่มองเห็นจากเครื่องเรา')}
          </p>

          <Button size="sm" onClick={() => void create()} disabled={busy} className="w-full">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            {t('เปิดอุโมงค์')}
          </Button>
        </div>

        {/* รายการที่เปิดอยู่ */}
        <div className="max-h-56 overflow-y-auto">
          {tunnels.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('ยังไม่มีอุโมงค์ที่เปิดอยู่')}
            </p>
          ) : (
            tunnels.map((tn) => (
              <div
                key={tn.id}
                className="flex items-center gap-2 border-b border-border/50 py-2 text-xs"
              >
                <span
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    tn.status === 'open' ? 'bg-[hsl(var(--success))]' : 'bg-destructive'
                  )}
                />
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                  {tn.type}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono">
                  {tn.type === 'local' ? `localhost:${tn.listenPort}` : `เซิร์ฟเวอร์:${tn.listenPort}`}
                  {' → '}
                  {tn.destHost}:{tn.destPort}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {tn.connections} {t('การเชื่อมต่อ')}
                </span>
                <button
                  onClick={() => void window.api.tunnels.close(tn.id)}
                  title={t('ปิดอุโมงค์')}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
