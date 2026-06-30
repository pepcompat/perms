import { useEffect, useState, type ReactNode } from 'react'
import { CheckCircle2, XCircle, Loader2, Plug, ShieldCheck } from 'lucide-react'
import type { ServerRecord, ServerInput, AuthType } from '@shared/types'
import { useServers } from '../store/useServers'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { cn } from '../lib/utils'

const EMPTY: ServerInput = {
  name: '',
  host: '',
  port: 22,
  username: '',
  authType: 'password',
  secret: '',
  privateKey: '',
  privateKeyPath: '',
  jumpHostId: null,
  groupName: '',
  color: null,
  notes: ''
}

const COLORS = ['#9b7ef0', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#f472b6']

export default function ServerForm({
  editing,
  open,
  onClose
}: {
  editing: ServerRecord | null
  open: boolean
  onClose: () => void
}): JSX.Element {
  const { servers, refresh } = useServers()
  const [form, setForm] = useState<ServerInput>(EMPTY)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        host: editing.host,
        port: editing.port,
        username: editing.username,
        authType: editing.authType,
        secret: '',
        privateKey: '',
        privateKeyPath: editing.privateKeyPath ?? '',
        jumpHostId: editing.jumpHostId,
        groupName: editing.groupName ?? '',
        color: editing.color,
        notes: editing.notes ?? ''
      })
    } else {
      setForm(EMPTY)
    }
    setTestResult(null)
  }, [editing, open])

  const upd = <K extends keyof ServerInput>(k: K, v: ServerInput[K]): void =>
    setForm((f) => ({ ...f, [k]: v }))

  const save = async (): Promise<void> => {
    setBusy(true)
    try {
      if (editing) await window.api.servers.update(editing.id, form)
      else await window.api.servers.create(form)
      await refresh()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const test = async (): Promise<void> => {
    setTesting(true)
    setTestResult(null)
    try {
      const rec = editing
        ? await window.api.servers.update(editing.id, form)
        : await window.api.servers.create(form)
      await refresh()
      const res = await window.api.servers.test(rec.id)
      setTestResult({ ok: res.ok, msg: res.ok ? 'เชื่อมต่อสำเร็จ' : res.error || 'ล้มเหลว' })
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : String(e) })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'แก้ไข Server' : 'เพิ่ม Server ใหม่'}</DialogTitle>
          <DialogDescription>รายละเอียดการเชื่อมต่อ SSH</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <Field className="col-span-2" label="ชื่อ (display)">
            <Input value={form.name} onChange={(e) => upd('name', e.target.value)} placeholder="prod-web-01" />
          </Field>
          <Field className="col-span-1" label="Host / IP">
            <Input value={form.host} onChange={(e) => upd('host', e.target.value)} placeholder="10.0.0.5" />
          </Field>
          <Field label="Port">
            <Input
              type="number"
              value={form.port}
              onChange={(e) => upd('port', Number(e.target.value))}
            />
          </Field>
          <Field label="Username">
            <Input value={form.username} onChange={(e) => upd('username', e.target.value)} placeholder="root" />
          </Field>
          <Field label="Auth method">
            <Select value={form.authType} onValueChange={(v) => upd('authType', v as AuthType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="password">Password</SelectItem>
                <SelectItem value="key">Private key</SelectItem>
                <SelectItem value="agent">SSH agent</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {form.authType === 'password' && (
            <Field className="col-span-2" label={`Password${editing ? ' (เว้นว่างถ้าไม่เปลี่ยน)' : ''}`}>
              <Input
                type="password"
                value={form.secret ?? ''}
                onChange={(e) => upd('secret', e.target.value)}
              />
            </Field>
          )}

          {form.authType === 'key' && (
            <>
              <Field className="col-span-2" label="Private key path">
                <Input
                  placeholder="~/.ssh/id_ed25519"
                  value={form.privateKeyPath ?? ''}
                  onChange={(e) => upd('privateKeyPath', e.target.value)}
                />
              </Field>
              <Field className="col-span-2" label="หรือวางเนื้อหา private key (เก็บแบบเข้ารหัส)">
                <Textarea
                  className="h-20 font-mono text-xs"
                  value={form.privateKey ?? ''}
                  onChange={(e) => upd('privateKey', e.target.value)}
                />
              </Field>
              <Field className="col-span-2" label="Passphrase (ถ้ามี)">
                <Input
                  type="password"
                  value={form.secret ?? ''}
                  onChange={(e) => upd('secret', e.target.value)}
                />
              </Field>
            </>
          )}

          <Field label="Group">
            <Input value={form.groupName ?? ''} onChange={(e) => upd('groupName', e.target.value)} placeholder="production" />
          </Field>
          <Field label="Jump host / bastion">
            <Select
              value={form.jumpHostId ?? 'none'}
              onValueChange={(v) => upd('jumpHostId', v === 'none' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— ไม่มี —</SelectItem>
                {servers
                  .filter((s) => s.id !== editing?.id)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>

          <Field className="col-span-2" label="สี (tag)">
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => upd('color', form.color === c ? null : c)}
                  className={cn(
                    'size-6 rounded-full ring-offset-2 ring-offset-card transition-all',
                    form.color === c ? 'ring-2 ring-ring' : 'hover:scale-110'
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </Field>

          <Field className="col-span-2" label="Notes">
            <Textarea className="h-16" value={form.notes ?? ''} onChange={(e) => upd('notes', e.target.value)} />
          </Field>
        </div>

        {form.authType !== 'agent' && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[hsl(var(--success))]" />
            <span>
              รหัสผ่าน/คีย์ถูกเข้ารหัสเก็บในเครื่องด้วย Keychain — macOS อาจถามขออนุญาตครั้งแรก
              กด “Always Allow” ได้เลย
            </span>
          </div>
        )}

        {testResult && (
          <div
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
              testResult.ok
                ? 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]'
                : 'bg-destructive/10 text-destructive'
            )}
          >
            {testResult.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
            {testResult.msg}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <Button variant="outline" onClick={test} disabled={testing || !form.host || !form.username}>
            {testing ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
            ทดสอบ
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button onClick={save} disabled={busy || !form.host || !form.username}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              บันทึก
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  className,
  children
}: {
  label: string
  className?: string
  children: ReactNode
}): JSX.Element {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}
