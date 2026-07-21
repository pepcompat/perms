import { useEffect, useState } from 'react'
import { Play, Pencil, Trash2, BookText, Plus, Variable } from 'lucide-react'
import type { RunbookRecord, RunbookStep } from '@shared/types'
import { extractPlaceholdersAll, fillTemplate } from '@shared/template'
import { useTabs } from '../store/useTabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { useT } from '../lib/i18n'

const paramStoreKey = (id: string): string => `runbook.params.${id}`

function loadSavedParams(id: string, names: string[]): Record<string, string> {
  let saved: Record<string, string> = {}
  try {
    saved = JSON.parse(localStorage.getItem(paramStoreKey(id)) || '{}')
  } catch {
    /* ค่าเสีย — เริ่มใหม่ */
  }
  const out: Record<string, string> = {}
  for (const n of names) out[n] = typeof saved[n] === 'string' ? saved[n] : ''
  return out
}

export default function Runbooks({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): JSX.Element {
  const t = useT()
  const { activeId } = useTabs()
  const [runbooks, setRunbooks] = useState<RunbookRecord[]>([])
  const [editing, setEditing] = useState<RunbookRecord | null>(null)
  const [name, setName] = useState('')
  const [stepsText, setStepsText] = useState('')

  // ฟอร์มกรอกค่าพารามิเตอร์ตอนจะรัน
  const [paramRb, setParamRb] = useState<RunbookRecord | null>(null)
  const [paramNames, setParamNames] = useState<string[]>([])
  const [paramValues, setParamValues] = useState<Record<string, string>>({})

  const load = (): void => {
    void window.api.runbooks.list().then(setRunbooks)
  }
  useEffect(() => {
    if (open) load()
  }, [open])

  const startEdit = (rb: RunbookRecord | null): void => {
    setEditing(rb)
    setName(rb?.name ?? '')
    setStepsText((rb?.steps ?? []).map((s) => s.command).join('\n'))
  }

  const save = async (): Promise<void> => {
    const steps: RunbookStep[] = stepsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((command) => ({ command }))
    await window.api.runbooks.save({ id: editing?.id ?? null, name: name || 'Untitled', steps })
    startEdit(null)
    load()
  }

  const remove = async (id: string): Promise<void> => {
    await window.api.runbooks.remove(id)
    load()
  }

  // ส่งคำสั่งเข้า terminal (แทนค่า placeholder ถ้ามี)
  const execute = (rb: RunbookRecord, values: Record<string, string>): void => {
    if (!activeId) return
    for (const step of rb.steps) {
      window.api.terminal.write(activeId, fillTemplate(step.command, values) + '\n')
    }
    onClose()
  }

  const run = (rb: RunbookRecord): void => {
    if (!activeId) {
      alert(t("เปิด terminal session ก่อนถึงจะรัน runbook ได้"))
      return
    }
    const names = extractPlaceholdersAll(rb.steps.map((s) => s.command))
    if (names.length === 0) {
      execute(rb, {})
      return
    }
    // มีช่องให้กรอก → เปิดฟอร์ม (เติมค่าล่าสุดที่เคยกรอก)
    setParamRb(rb)
    setParamNames(names)
    setParamValues(loadSavedParams(rb.id, names))
  }

  const runWithParams = (): void => {
    if (!paramRb) return
    try {
      localStorage.setItem(paramStoreKey(paramRb.id), JSON.stringify(paramValues))
    } catch {
      /* localStorage เต็ม — ข้ามการจำค่า */
    }
    const rb = paramRb
    setParamRb(null)
    execute(rb, paramValues)
  }

  const allFilled = paramNames.every((n) => (paramValues[n] ?? '').trim() !== '')

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="flex h-[72vh] max-w-2xl flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookText className="size-4 text-primary" /> Runbooks
            </DialogTitle>
            <DialogDescription>{t("ชุดคำสั่งที่บันทึกไว้ใช้ซ้ำ")}</DialogDescription>
          </DialogHeader>

          <div className="-mr-2 flex-1 space-y-2 overflow-y-auto pr-2">
            {runbooks.map((rb) => {
              const params = extractPlaceholdersAll(rb.steps.map((s) => s.command))
              return (
                <div
                  key={rb.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-background/40 p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{rb.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">{rb.steps.length} {t('คำสั่ง')}</Badge>
                      {params.length > 0 && (
                        <Badge variant="secondary" className="gap-1">
                          <Variable className="size-3" />
                          {params.length} {t('ช่องกรอก')}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" onClick={() => run(rb)}>
                      <Play className="size-3.5" /> {t("รัน")}
                    </Button>
                    <Button variant="outline" size="icon-sm" onClick={() => startEdit(rb)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button variant="outline" size="icon-sm" onClick={() => remove(rb.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
            {runbooks.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">{t("ยังไม่มี runbook")}</div>
            )}
          </div>

          <Separator />

          <div className="space-y-2.5">
            <div className="text-sm font-medium">{editing ? t("แก้ไข runbook") : t("สร้างใหม่")}</div>
            <Input
              placeholder={t("ชื่อ runbook")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <Label>
                {t('คำสั่ง (บรรทัดละ 1 คำสั่ง · ใช้')}{' '}
                <code className="rounded bg-muted px-1 font-mono text-[11px]">{'{{ชื่อ}}'}</code>{' '}
                {t('เพื่อสร้างช่องให้กรอกตอนรัน)')}
              </Label>
              <Textarea
                className="h-24 font-mono text-xs"
                placeholder={'./build_and_push.sh {{version}} {{service}}\ngit pull && pm2 reload all'}
                value={stepsText}
                onChange={(e) => setStepsText(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              {editing && (
                <Button variant="ghost" onClick={() => startEdit(null)}>
                  {t("ยกเลิก")}
                </Button>
              )}
              <Button onClick={save} disabled={!name && !stepsText}>
                <Plus className="size-4" /> {t("บันทึก")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ฟอร์มกรอกค่าพารามิเตอร์ก่อนรัน */}
      <Dialog open={!!paramRb} onOpenChange={(o) => !o && setParamRb(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="size-4 text-primary" /> {paramRb?.name}
            </DialogTitle>
            <DialogDescription>{t("กรอกค่าก่อนรัน")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {paramNames.map((n, i) => (
              <div key={n} className="flex flex-col gap-1.5">
                <Label className="font-mono text-xs text-muted-foreground">{`{{${n}}}`}</Label>
                <Input
                  autoFocus={i === 0}
                  value={paramValues[n] ?? ''}
                  placeholder={n}
                  onChange={(e) => setParamValues((v) => ({ ...v, [n]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && allFilled) runWithParams()
                  }}
                />
              </div>
            ))}

            {/* พรีวิวคำสั่งที่จะรันจริง */}
            <div className="space-y-0.5 rounded-lg border border-border bg-muted/40 p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {paramRb?.steps.map((s, i) => (
                <div key={i} className="whitespace-pre-wrap break-all">
                  <span className="select-none text-primary/70">$ </span>
                  {fillTemplate(s.command, paramValues)}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setParamRb(null)}>
              {t("ยกเลิก")}
            </Button>
            <Button onClick={runWithParams} disabled={!allFilled}>
              <Play className="size-4" /> {t("รัน")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
