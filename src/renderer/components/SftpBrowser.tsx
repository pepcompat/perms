import { useEffect, useState } from 'react'
import {
  Folder,
  FileText,
  Link2,
  ArrowUp,
  RefreshCw,
  Upload,
  Download,
  Trash2,
  FolderPlus,
  Home,
  Loader2,
  FolderSymlink,
  Pencil,
  FileArchive,
  X
} from 'lucide-react'
import type { SftpEntry, SftpProgress } from '@shared/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { Hint } from './ui/tooltip'
import { cn } from '../lib/utils'
import { humanSize, joinRemote, parentPath, isArchive } from '../lib/format'
import FileEditor from './FileEditor'
import { useT } from '../lib/i18n'

export default function SftpBrowser({
  sessionId,
  title,
  open,
  onClose
}: {
  sessionId: string
  title: string
  open: boolean
  onClose: () => void
}): JSX.Element {
  const t = useT()
  const [cwd, setCwd] = useState('')
  const [entries, setEntries] = useState<SftpEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [transfers, setTransfers] = useState<Record<string, SftpProgress>>({})
  const [editing, setEditing] = useState<{ path: string; name: string } | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggleSel = (name: string): void =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  const clearSel = (): void => setSelected(new Set())

  const load = async (path: string): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const res = await window.api.sftp.list(sessionId, path)
      setCwd(res.path)
      setEntries(res.entries)
      setSelected(new Set()) // เปลี่ยนโฟลเดอร์ → ล้างที่เลือกไว้
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setEntries([])
    setCwd('')
    setError('')
    void window.api.sftp
      .home(sessionId)
      .then((h) => load(h))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionId])

  useEffect(() => {
    return window.api.sftp.onProgress((p) => {
      setTransfers((t) => ({ ...t, [p.transferId]: p }))
      if (p.done) {
        window.setTimeout(() => {
          setTransfers((cur) => {
            const c = { ...cur }
            delete c[p.transferId]
            return c
          })
        }, 2500)
      }
    })
  }, [])

  const enter = (e: SftpEntry): void => {
    if (e.type === 'dir') void load(joinRemote(cwd, e.name))
    else setEditing({ path: joinRemote(cwd, e.name), name: e.name })
  }
  const upload = async (): Promise<void> => {
    setBusy(true)
    try {
      const r = await window.api.sftp.upload(sessionId, cwd)
      if (r.ok) await load(cwd)
    } finally {
      setBusy(false)
    }
  }
  const mkdir = async (): Promise<void> => {
    const name = prompt(t("ชื่อโฟลเดอร์ใหม่"))?.trim()
    if (!name) return
    try {
      await window.api.sftp.mkdir(sessionId, joinRemote(cwd, name))
      await load(cwd)
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    }
  }
  const remove = async (e: SftpEntry): Promise<void> => {
    if (!confirm(`${t('ลบ')} "${e.name}"?`)) return
    try {
      await window.api.sftp.remove(sessionId, joinRemote(cwd, e.name), e.type === 'dir')
      await load(cwd)
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    }
  }

  /** ดาวน์โหลด: ไฟล์เดี่ยว = โหลดตรง ๆ · โฟลเดอร์/หลายรายการ = บีบอัดแล้วโหลด */
  const download = async (names: string[]): Promise<void> => {
    if (!names.length) return
    const single = names.length === 1 ? entries.find((e) => e.name === names[0]) : undefined
    setBusy(true)
    try {
      if (single && single.type !== 'dir') {
        await window.api.sftp.download(sessionId, joinRemote(cwd, single.name), single.name)
      } else {
        const r = await window.api.sftp.downloadArchive(sessionId, cwd, names)
        if (r.error) alert(`${t('ดาวน์โหลดไม่สำเร็จ')}: ${r.error}`)
      }
    } finally {
      setBusy(false)
    }
  }

  /** บีบอัดรายการที่เลือกไว้ในโฟลเดอร์เดิม */
  const zipSelected = async (): Promise<void> => {
    const names = [...selected]
    if (!names.length) return
    const base = prompt(t("ชื่อไฟล์บีบอัด (ไม่ต้องใส่นามสกุล)"), names.length === 1 ? names[0] : 'archive')?.trim()
    if (!base) return
    setBusy(true)
    try {
      await window.api.sftp.archive(sessionId, cwd, names, base)
      clearSel()
      await load(cwd)
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  /** แตกไฟล์บีบอัด */
  const extract = async (name: string): Promise<void> => {
    setBusy(true)
    try {
      await window.api.sftp.extract(sessionId, cwd, name)
      await load(cwd)
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const removeSelected = async (): Promise<void> => {
    const names = [...selected]
    if (!names.length || !confirm(`${t('ลบ')} ${names.length} ${t('รายการที่เลือก')}?`)) return
    setBusy(true)
    try {
      for (const n of names) {
        const e = entries.find((x) => x.name === n)
        if (e) await window.api.sftp.remove(sessionId, joinRemote(cwd, n), e.type === 'dir')
      }
      clearSel()
      await load(cwd)
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const activeTransfers = Object.values(transfers)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[76vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderSymlink className="size-4 text-primary" /> {t("ไฟล์บนเซิร์ฟเวอร์ (SFTP)")}
          </DialogTitle>
          <DialogDescription className="truncate">{title}</DialogDescription>
        </DialogHeader>

        {/* toolbar + path */}
        <div className="flex items-center gap-1.5">
          <Hint label={"Home"}>
            <Button variant="outline" size="icon-sm" onClick={() => void load('.')}>
              <Home className="size-3.5" />
            </Button>
          </Hint>
          <Hint label={t("ขึ้นบน")}>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!cwd || cwd === '/'}
              onClick={() => void load(parentPath(cwd))}
            >
              <ArrowUp className="size-3.5" />
            </Button>
          </Hint>
          <Hint label={t("รีเฟรช")}>
            <Button variant="outline" size="icon-sm" onClick={() => void load(cwd)}>
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            </Button>
          </Hint>
          <div className="mx-1 min-w-0 flex-1 truncate rounded-md border border-border bg-background/50 px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
            {cwd || '…'}
          </div>
          <Hint label={t("สร้างโฟลเดอร์")}>
            <Button variant="outline" size="sm" onClick={() => void mkdir()}>
              <FolderPlus className="size-3.5" />
            </Button>
          </Hint>
          <Button size="sm" onClick={() => void upload()} disabled={busy || !cwd}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} {t('อัปโหลด')}
          </Button>
        </div>

        {/* แถบเมื่อเลือกหลายรายการ */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-2.5 py-1.5">
            <span className="text-xs font-medium">{t('เลือก')} {selected.size} {t('รายการ')}</span>
            <div className="ml-auto flex items-center gap-1">
              <Button size="sm" onClick={() => void download([...selected])} disabled={busy}>
                <Download className="size-3.5" /> {t("ดาวน์โหลด")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => void zipSelected()} disabled={busy}>
                <FileArchive className="size-3.5" /> {t("บีบอัด")}
              </Button>
              <Hint label={t("ลบที่เลือก")}>
                <Button variant="outline" size="icon-sm" onClick={() => void removeSelected()} disabled={busy}>
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </Hint>
              <Hint label={t("ยกเลิกการเลือก")}>
                <Button variant="ghost" size="icon-sm" onClick={clearSel}>
                  <X className="size-3.5" />
                </Button>
              </Hint>
            </div>
          </div>
        )}

        {/* list */}
        <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          {!error &&
            entries.map((e) => (
              <div
                key={e.name}
                onDoubleClick={() => enter(e)}
                className={cn(
                  'group flex cursor-default items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent',
                  selected.has(e.name) && 'bg-primary/10'
                )}
              >
                <input
                  type="checkbox"
                  checked={selected.has(e.name)}
                  onChange={() => toggleSel(e.name)}
                  onClick={(ev) => ev.stopPropagation()}
                  className="size-3.5 shrink-0 accent-[hsl(var(--primary))]"
                  aria-label={t("เลือก")}
                />
                <span className="shrink-0">
                  {e.type === 'dir' ? (
                    <Folder className="size-4 text-primary" />
                  ) : e.type === 'link' ? (
                    <Link2 className="size-4 text-muted-foreground" />
                  ) : (
                    <FileText className="size-4 text-muted-foreground" />
                  )}
                </span>
                <Hint label={e.name}>
                  <button
                    onClick={() => enter(e)}
                    className="min-w-0 flex-1 truncate text-left text-sm"
                  >
                    {e.name}
                  </button>
                </Hint>
                <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                  {e.type === 'file' ? humanSize(e.size) : ''}
                </span>
                <div className="flex w-28 shrink-0 justify-end gap-0.5 opacity-0 group-hover:opacity-100">
                  {e.type !== 'dir' && isArchive(e.name) && (
                    <Hint label={t("แตกไฟล์ (unzip)")}>
                      <button
                        onClick={() => void extract(e.name)}
                        className="rounded p-1 text-sky-400 hover:bg-sky-400/10"
                      >
                        <FileArchive className="size-3.5" />
                      </button>
                    </Hint>
                  )}
                  {e.type !== 'dir' && (
                    <Hint label={t("แก้ไข")}>
                      <button
                        onClick={() => setEditing({ path: joinRemote(cwd, e.name), name: e.name })}
                        className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </Hint>
                  )}
                  <Hint label={e.type === 'dir' ? t('ดาวน์โหลดทั้งโฟลเดอร์ (บีบอัด)') : t('ดาวน์โหลด')}>
                    <button
                      onClick={() => void download([e.name])}
                      className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Download className="size-3.5" />
                    </button>
                  </Hint>
                  <Hint label={t("ลบ")}>
                    <button
                      onClick={() => void remove(e)}
                      className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </Hint>
                </div>
              </div>
            ))}
          {!error && !loading && entries.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground">{t("โฟลเดอร์ว่าง")}</div>
          )}
        </div>

        {/* transfers */}
        {activeTransfers.length > 0 && (
          <div className="space-y-1.5 border-t border-border pt-2">
            {activeTransfers.map((tr) => {
              const pct = tr.total > 0 ? Math.round((tr.transferred / tr.total) * 100) : 0
              return (
                <div key={tr.transferId} className="flex items-center gap-2 text-xs">
                  {tr.direction === 'up' ? (
                    <Upload className="size-3 shrink-0 text-primary" />
                  ) : (
                    <Download className="size-3 shrink-0 text-primary" />
                  )}
                  <span className="w-40 shrink-0 truncate">{tr.name}</span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn('h-full rounded-full', tr.error ? 'bg-destructive' : 'bg-primary')}
                      style={{ width: `${tr.error ? 100 : pct}%` }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right text-muted-foreground">
                    {tr.error ? t('ผิดพลาด') : tr.done ? t('เสร็จ') : `${pct}%`}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {editing && (
          <FileEditor
            sessionId={sessionId}
            path={editing.path}
            name={editing.name}
            onClose={(changed) => {
              setEditing(null)
              if (changed) void load(cwd)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
