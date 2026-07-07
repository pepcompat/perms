import { useEffect, useRef, useState } from 'react'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { StreamLanguage } from '@codemirror/language'
import { basicSetup } from 'codemirror'
import { json } from '@codemirror/lang-json'
import { yaml } from '@codemirror/lang-yaml'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { properties } from '@codemirror/legacy-modes/mode/properties'
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile'
import { nginx } from '@codemirror/legacy-modes/mode/nginx'
import { python } from '@codemirror/legacy-modes/mode/python'
import { Save, Loader2, FileText, ShieldCheck, Check } from 'lucide-react'
import { Dialog, DialogContent } from './ui/dialog'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

function langFor(name: string): Extension[] {
  const n = name.toLowerCase()
  if (/\.jsonc?$/.test(n)) return [json()]
  if (/\.ya?ml$/.test(n)) return [yaml()]
  if (/\.(jsx?|tsx?|mjs|cjs)$/.test(n))
    return [javascript({ jsx: /x$/.test(n), typescript: /\.tsx?$/.test(n) })]
  if (n === 'dockerfile' || /\.dockerfile$/.test(n)) return [StreamLanguage.define(dockerFile)]
  if (/\.(sh|bash|zsh|zshrc|bashrc|profile)$/.test(n)) return [StreamLanguage.define(shell)]
  if (/\.py$/.test(n)) return [StreamLanguage.define(python)]
  if (/nginx.*\.conf$|\.nginx$/.test(n)) return [StreamLanguage.define(nginx)]
  if (/(^|\.)env($|\.)|\.(properties|ini|conf|cfg|toml)$/.test(n))
    return [StreamLanguage.define(properties)]
  return []
}

export default function FileEditor({
  sessionId,
  path,
  name,
  onClose
}: {
  sessionId: string
  path: string
  name: string
  onClose: (changed: boolean) => void
}): JSX.Element {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const originalRef = useRef('')
  const metaRef = useRef({ mode: 0o644, mtime: 0 })
  const savedOnceRef = useRef(false)
  const saveRef = useRef<() => void>(() => {})

  const doSave = async (force = false): Promise<void> => {
    const view = viewRef.current
    if (!view || saving) return
    setSaving(true)
    setSaveError('')
    try {
      const content = view.state.doc.toString()
      const res = await window.api.sftp.write(
        sessionId,
        path,
        content,
        metaRef.current.mode,
        force ? null : metaRef.current.mtime
      )
      metaRef.current.mtime = res.mtime
      originalRef.current = content
      savedOnceRef.current = true
      setDirty(false)
      setJustSaved(true)
      window.setTimeout(() => setJustSaved(false), 1600)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('EXTERNAL_CHANGED')) {
        if (confirm('ไฟล์ถูกแก้ไขบนเซิร์ฟเวอร์ระหว่างที่คุณเปิดอยู่ — บันทึกทับของเดิมไหม?')) {
          setSaving(false)
          await doSave(true)
          return
        }
      } else {
        setSaveError(msg)
      }
    } finally {
      setSaving(false)
    }
  }
  saveRef.current = () => void doSave()

  // โหลดไฟล์
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    window.api.sftp
      .read(sessionId, path)
      .then((f) => {
        if (cancelled) return
        originalRef.current = f.content
        metaRef.current = { mode: f.mode, mtime: f.mtime }
        setLoading(false)
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e))
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [sessionId, path])

  // สร้าง editor เมื่อโหลดเสร็จ (ไม่ผูกกับ saveError → save พังไม่ทำ editor รีเซ็ต)
  useEffect(() => {
    if (loading || loadError || !hostRef.current || viewRef.current) return
    const state = EditorState.create({
      doc: originalRef.current,
      extensions: [
        basicSetup,
        keymap.of([
          {
            key: 'Mod-s',
            preventDefault: true,
            run: () => {
              saveRef.current()
              return true
            }
          }
        ]),
        ...langFor(name),
        oneDark,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) setDirty(u.state.doc.toString() !== originalRef.current)
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: '13px', backgroundColor: 'transparent' },
          '.cm-scroller': { fontFamily: "'JetBrains Mono', ui-monospace, monospace" },
          '&.cm-focused': { outline: 'none' }
        })
      ]
    })
    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view
    view.focus()
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [loading, loadError, name])

  const close = (): void => {
    if (dirty && !confirm('มีการแก้ไขที่ยังไม่บันทึก — ปิดโดยไม่บันทึกไหม?')) return
    onClose(savedOnceRef.current)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="flex h-[85vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        {/* header (เว้นขวา pr-11 ให้พ้นปุ่ม X ในตัวของ Dialog) */}
        <div className="flex items-center gap-2 border-b border-border py-2 pl-3 pr-11">
          <FileText className="size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 truncate text-sm font-medium">
              {name}
              {dirty && <span className="size-1.5 shrink-0 rounded-full bg-[hsl(var(--warning))]" title="ยังไม่บันทึก" />}
            </div>
            <div className="truncate font-mono text-[11px] text-muted-foreground">{path}</div>
          </div>
          {justSaved && (
            <span className="flex items-center gap-1 text-xs text-[hsl(var(--success))]">
              <Check className="size-3.5" /> บันทึกแล้ว
            </span>
          )}
          <Button size="sm" onClick={() => void doSave()} disabled={saving || loading || !!loadError || !dirty}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            บันทึก
            <kbd className="ml-1 rounded bg-black/20 px-1 text-[10px] opacity-70">⌘S</kbd>
          </Button>
        </div>

        {saveError && (
          <div className="border-b border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
            บันทึกไม่สำเร็จ: {saveError}
          </div>
        )}

        {/* body */}
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : loadError ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-destructive">
            {loadError}
          </div>
        ) : (
          <div ref={hostRef} className="min-h-0 flex-1 overflow-auto" />
        )}

        {/* footer — โน้ตความปลอดภัย */}
        {!loading && !loadError && (
          <div className="flex items-center gap-1.5 border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 shrink-0 text-[hsl(var(--success))]" />
            เขียนแบบปลอดภัย (atomic + คงสิทธิ์ไฟล์เดิม) · ⌘Z ย้อน / ⇧⌘Z ทำซ้ำ · เนื้อหาไม่ถูกส่งไป AI
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
