import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Plug,
  ShieldCheck,
  KeyRound,
  FolderOpen,
  ChevronDown
} from 'lucide-react'
import type { ServerRecord, ServerInput, AuthType } from '@shared/types'
import { useServers } from '../store/useServers'
import { toast } from '../store/useToast'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem
} from './ui/dropdown-menu'
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
import { useT } from '../lib/i18n'

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

export default function ServerForm({
  editing,
  open,
  onClose
}: {
  editing: ServerRecord | null
  open: boolean
  onClose: () => void
}): JSX.Element {
  const t = useT()
  const { servers, refresh } = useServers()
  const [form, setForm] = useState<ServerInput>(EMPTY)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [sshKeys, setSshKeys] = useState<string[]>([])
  // record ที่กำลังแก้อยู่ (id เดิมถ้า edit, หรือ id ที่เพิ่งสร้างจากการกดทดสอบ)
  const serverIdRef = useRef<string | null>(editing?.id ?? null)
  // true = สร้างใหม่ในรอบนี้และยังไม่กดบันทึก → ถ้าปิดโดยไม่บันทึกให้ลบทิ้ง
  const draftRef = useRef(false)

  useEffect(() => {
    serverIdRef.current = editing?.id ?? null
    draftRef.current = false
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

  const existingGroups = [
    ...new Set(servers.map((s) => s.groupName).filter((g): g is string => !!g))
  ].sort()

  // โหลด SSH keys ในเครื่องเมื่อเลือก auth แบบ key
  useEffect(() => {
    if (open && form.authType === 'key' && sshKeys.length === 0) {
      void window.api.servers.listKeys().then(setSshKeys)
    }
  }, [open, form.authType, sshKeys.length])

  const browseKey = async (): Promise<void> => {
    const path = await window.api.servers.pickKey()
    if (path) upd('privateKeyPath', path)
  }

  // สร้างครั้งเดียว แล้วหลังจากนั้น update record เดิมเสมอ (กันซ้ำ)
  const persist = async (): Promise<ServerRecord> => {
    if (serverIdRef.current) {
      const rec = await window.api.servers.update(serverIdRef.current, form)
      await refresh()
      return rec
    }
    const rec = await window.api.servers.create(form)
    serverIdRef.current = rec.id
    draftRef.current = true // เพิ่งสร้าง ยังไม่บันทึกจริง
    await refresh()
    return rec
  }

  const save = async (): Promise<void> => {
    setBusy(true)
    try {
      await persist()
      draftRef.current = false // commit แล้ว
      toast(editing ? t('แก้ไข server แล้ว') : t('เพิ่ม server แล้ว'))
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const test = async (): Promise<void> => {
    setTesting(true)
    setTestResult(null)
    try {
      const rec = await persist()
      const res = await window.api.servers.test(rec.id)
      setTestResult({ ok: res.ok, msg: res.ok ? t('เชื่อมต่อสำเร็จ') : res.error || t('ล้มเหลว') })
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : String(e) })
    } finally {
      setTesting(false)
    }
  }

  // ปิดฟอร์ม — ถ้าเป็น draft (สร้างจากการทดสอบ) ที่ยังไม่บันทึก ให้ลบทิ้ง
  const handleClose = async (): Promise<void> => {
    if (draftRef.current && serverIdRef.current) {
      await window.api.servers.remove(serverIdRef.current)
      await refresh()
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && void handleClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t("แก้ไข Server") : t("เพิ่ม Server ใหม่")}</DialogTitle>
          <DialogDescription>{t("รายละเอียดการเชื่อมต่อ SSH")}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <Field className="col-span-2" label={t("ชื่อ (display)")}>
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
            <Field className="col-span-2" label={`Password${editing ? ` ${t('(เว้นว่างถ้าไม่เปลี่ยน)')}` : ''}`}>
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
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder="~/.ssh/id_ed25519"
                    value={form.privateKeyPath ?? ''}
                    onChange={(e) => upd('privateKeyPath', e.target.value)}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" title={t("เลือก key ในเครื่อง")}>
                        <KeyRound className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="max-h-72 min-w-[17rem] overflow-y-auto">
                      <DropdownMenuLabel>{t("SSH keys ใน ~/.ssh")}</DropdownMenuLabel>
                      {sshKeys.map((k) => (
                        <DropdownMenuItem
                          key={k}
                          checked={form.privateKeyPath === k}
                          onSelect={() => upd('privateKeyPath', k)}
                          className="font-mono text-xs"
                        >
                          {k}
                        </DropdownMenuItem>
                      ))}
                      {sshKeys.length === 0 && (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                          {t("ไม่พบ key ใน ~/.ssh")}
                        </div>
                      )}
                      <div className="my-1 h-px bg-border" />
                      <DropdownMenuItem onSelect={() => void browseKey()}>
                        <FolderOpen className="size-3.5" /> {t("เรียกดูไฟล์อื่น…")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Field>
              <Field className="col-span-2" label={t("หรือวางเนื้อหา private key (เก็บแบบเข้ารหัส)")}>
                <Textarea
                  className="h-20 font-mono text-xs"
                  value={form.privateKey ?? ''}
                  onChange={(e) => upd('privateKey', e.target.value)}
                />
              </Field>
              <Field className="col-span-2" label={t("Passphrase (ถ้ามี)")}>
                <Input
                  type="password"
                  value={form.secret ?? ''}
                  onChange={(e) => upd('secret', e.target.value)}
                />
              </Field>
            </>
          )}

          <Field label="Group">
            <div className="flex gap-2">
              <Input
                className="flex-1"
                value={form.groupName ?? ''}
                onChange={(e) => upd('groupName', e.target.value)}
                placeholder="production"
              />
              {existingGroups.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" title={t("เลือก group ที่มี")}>
                      <ChevronDown className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-60 min-w-[12rem] overflow-y-auto">
                    <DropdownMenuLabel>{t("Group ที่มีอยู่")}</DropdownMenuLabel>
                    {existingGroups.map((g) => (
                      <DropdownMenuItem
                        key={g}
                        checked={form.groupName === g}
                        onSelect={() => upd('groupName', g)}
                      >
                        {g}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
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
                <SelectItem value="none">{t("— ไม่มี —")}</SelectItem>
                {servers
                  .filter((s) => s.id !== editing?.id && s.id !== serverIdRef.current)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>

          <Field className="col-span-2" label="Notes">
            <Textarea className="h-16" value={form.notes ?? ''} onChange={(e) => upd('notes', e.target.value)} />
          </Field>
        </div>

        {form.authType !== 'agent' && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[hsl(var(--success))]" />
            <span>
              {t("รหัสผ่าน/คีย์ถูกเข้ารหัสเก็บในเครื่องด้วย Keychain — macOS อาจถามขออนุญาตครั้งแรก")}
              {t("กด “Always Allow” ได้เลย")}
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
            {t("ทดสอบ")}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleClose}>
              {t("ยกเลิก")}
            </Button>
            <Button onClick={save} disabled={busy || !form.host || !form.username}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {t("บันทึก")}
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
