import { Sparkles } from 'lucide-react'
import type { ChangelogEntry } from '../lib/changelog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { logoUrl } from '../lib/logo'

export default function WhatsNew({
  version,
  entries,
  onClose,
  manual = false
}: {
  version: string
  entries: ChangelogEntry[]
  onClose: () => void
  /** true = ผู้ใช้กดเปิดเอง (ดู changelog) · false = เด้งอัตโนมัติหลังอัปเดต */
  manual?: boolean
}): JSX.Element {
  const multi = entries.length > 1
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <img src={logoUrl} alt="Perms" className="size-9 rounded-lg shadow-sm" />
            <div className="flex flex-col">
              <span className="flex items-center gap-1.5">
                <Sparkles className="size-4 text-primary" />
                {manual ? 'บันทึกการเปลี่ยนแปลง' : 'มีอะไรใหม่'}
              </span>
            </div>
          </DialogTitle>
          <DialogDescription>
            {manual ? (
              <>
                บันทึกการเปลี่ยนแปลง · กำลังใช้{' '}
                <span className="font-mono text-foreground">v{version}</span>
              </>
            ) : (
              <>
                อัปเดตเป็น Perms <span className="font-mono text-foreground">v{version}</span> แล้ว —
                สรุปสิ่งที่เพิ่ม/ปรับ
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="-mr-2 max-h-[52vh] space-y-4 overflow-y-auto pr-2">
          {entries.map((e) => (
            <div key={e.version}>
              {multi && (
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                    v{e.version}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">{e.title}</span>
                </div>
              )}
              <ul className="space-y-2">
                {e.items.map((it, i) => (
                  <li key={i} className="flex gap-2.5 text-sm">
                    <span className="shrink-0 text-base leading-tight">{it.icon}</span>
                    <span className="leading-snug">{it.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button onClick={onClose}>เริ่มใช้งาน</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
