import { useEffect, useRef, useState } from 'react'
import { usePrompt } from '../store/usePrompt'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { useT } from '../lib/i18n'

/** กล่องกรอกข้อความแบบ async — แทน window.prompt() ที่ Electron ไม่รองรับ */
export default function PromptDialog(): JSX.Element | null {
  const t = useT()
  const req = usePrompt((s) => s.req)
  const submit = usePrompt((s) => s.submit)
  const cancel = usePrompt((s) => s.cancel)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // เปิดใหม่แต่ละครั้ง → เซ็ตค่าเริ่มต้น + โฟกัส + เลือกข้อความทั้งหมด
  useEffect(() => {
    if (!req) return
    setValue(req.defaultValue ?? '')
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => cancelAnimationFrame(id)
  }, [req])

  if (!req) return null

  const ok = (): void => {
    const v = value.trim()
    if (v) submit(v)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && cancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{req.title}</DialogTitle>
          {req.description && <DialogDescription>{req.description}</DialogDescription>}
        </DialogHeader>
        <Input
          ref={inputRef}
          value={value}
          placeholder={req.placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ok()
            }
          }}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={cancel}>
            {t('ยกเลิก')}
          </Button>
          <Button onClick={ok} disabled={!value.trim()}>
            {req.confirmText ?? t('ตกลง')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
