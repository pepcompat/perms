import { useEffect, useState } from 'react'
import { Play, Pencil, Trash2, BookText, Plus } from 'lucide-react'
import type { RunbookRecord, RunbookStep } from '@shared/types'
import { useTabs } from '../store/useTabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'

export default function Runbooks({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): JSX.Element {
  const { activeId } = useTabs()
  const [runbooks, setRunbooks] = useState<RunbookRecord[]>([])
  const [editing, setEditing] = useState<RunbookRecord | null>(null)
  const [name, setName] = useState('')
  const [stepsText, setStepsText] = useState('')

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

  const run = (rb: RunbookRecord): void => {
    if (!activeId) {
      alert('เปิด terminal session ก่อนถึงจะรัน runbook ได้')
      return
    }
    for (const step of rb.steps) window.api.terminal.write(activeId, step.command + '\n')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[72vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookText className="size-4 text-primary" /> Runbooks
          </DialogTitle>
          <DialogDescription>ชุดคำสั่งที่บันทึกไว้ใช้ซ้ำ</DialogDescription>
        </DialogHeader>

        <div className="-mr-2 flex-1 space-y-2 overflow-y-auto pr-2">
          {runbooks.map((rb) => (
            <div
              key={rb.id}
              className="flex items-center justify-between rounded-xl border border-border bg-background/40 p-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{rb.name}</div>
                <Badge variant="outline" className="mt-1">
                  {rb.steps.length} คำสั่ง
                </Badge>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" onClick={() => run(rb)}>
                  <Play className="size-3.5" /> รัน
                </Button>
                <Button variant="outline" size="icon-sm" onClick={() => startEdit(rb)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button variant="outline" size="icon-sm" onClick={() => remove(rb.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {runbooks.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground">ยังไม่มี runbook</div>
          )}
        </div>

        <Separator />

        <div className="space-y-2.5">
          <div className="text-sm font-medium">{editing ? 'แก้ไข runbook' : 'สร้างใหม่'}</div>
          <Input placeholder="ชื่อ runbook" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <Label>คำสั่ง (บรรทัดละ 1 คำสั่ง)</Label>
            <Textarea
              className="h-24 font-mono text-xs"
              placeholder={'systemctl status nginx\ndf -h\nfree -m'}
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            {editing && (
              <Button variant="ghost" onClick={() => startEdit(null)}>
                ยกเลิก
              </Button>
            )}
            <Button onClick={save} disabled={!name && !stepsText}>
              <Plus className="size-4" /> บันทึก
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
