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
  Pencil
} from 'lucide-react'
import type { SftpEntry, SftpProgress } from '@shared/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { cn } from '../lib/utils'
import FileEditor from './FileEditor'

function humanSize(n: number): string {
  if (n < 1024) return `${n} B`
  const u = ['KB', 'MB', 'GB', 'TB']
  let v = n
  let i = -1
  do {
    v /= 1024
    i++
  } while (v >= 1024 && i < u.length - 1)
  return `${v.toFixed(1)} ${u[i]}`
}

function joinRemote(dir: string, name: string): string {
  return dir.endsWith('/') ? dir + name : `${dir}/${name}`
}

function parentPath(p: string): string {
  const parts = p.split('/').filter(Boolean)
  parts.pop()
  return '/' + parts.join('/')
}

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
  const [cwd, setCwd] = useState('')
  const [entries, setEntries] = useState<SftpEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [transfers, setTransfers] = useState<Record<string, SftpProgress>>({})
  const [editing, setEditing] = useState<{ path: string; name: string } | null>(null)

  const load = async (path: string): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const res = await window.api.sftp.list(sessionId, path)
      setCwd(res.path)
      setEntries(res.entries)
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
    const name = prompt('ชื่อโฟลเดอร์ใหม่')?.trim()
    if (!name) return
    try {
      await window.api.sftp.mkdir(sessionId, joinRemote(cwd, name))
      await load(cwd)
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    }
  }
  const remove = async (e: SftpEntry): Promise<void> => {
    if (!confirm(`ลบ "${e.name}"?`)) return
    try {
      await window.api.sftp.remove(sessionId, joinRemote(cwd, e.name), e.type === 'dir')
      await load(cwd)
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    }
  }

  const activeTransfers = Object.values(transfers)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[76vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderSymlink className="size-4 text-primary" /> ไฟล์บนเซิร์ฟเวอร์ (SFTP)
          </DialogTitle>
          <DialogDescription className="truncate">{title}</DialogDescription>
        </DialogHeader>

        {/* toolbar + path */}
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon-sm" title="Home" onClick={() => void load('.')}>
            <Home className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            title="ขึ้นบน"
            disabled={!cwd || cwd === '/'}
            onClick={() => void load(parentPath(cwd))}
          >
            <ArrowUp className="size-3.5" />
          </Button>
          <Button variant="outline" size="icon-sm" title="รีเฟรช" onClick={() => void load(cwd)}>
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
          </Button>
          <div className="mx-1 min-w-0 flex-1 truncate rounded-md border border-border bg-background/50 px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
            {cwd || '…'}
          </div>
          <Button variant="outline" size="sm" title="สร้างโฟลเดอร์" onClick={() => void mkdir()}>
            <FolderPlus className="size-3.5" />
          </Button>
          <Button size="sm" onClick={() => void upload()} disabled={busy || !cwd}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} อัปโหลด
          </Button>
        </div>

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
                className="group flex cursor-default items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent"
              >
                <span className="shrink-0">
                  {e.type === 'dir' ? (
                    <Folder className="size-4 text-primary" />
                  ) : e.type === 'link' ? (
                    <Link2 className="size-4 text-muted-foreground" />
                  ) : (
                    <FileText className="size-4 text-muted-foreground" />
                  )}
                </span>
                <button
                  onClick={() => enter(e)}
                  className="min-w-0 flex-1 truncate text-left text-sm"
                  title={e.name}
                >
                  {e.name}
                </button>
                <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                  {e.type === 'file' ? humanSize(e.size) : ''}
                </span>
                <div className="flex w-20 shrink-0 justify-end gap-0.5 opacity-0 group-hover:opacity-100">
                  {e.type !== 'dir' && (
                    <button
                      title="แก้ไข"
                      onClick={() => setEditing({ path: joinRemote(cwd, e.name), name: e.name })}
                      className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  )}
                  {e.type !== 'dir' && (
                    <button
                      title="ดาวน์โหลด"
                      onClick={() => window.api.sftp.download(sessionId, joinRemote(cwd, e.name), e.name)}
                      className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Download className="size-3.5" />
                    </button>
                  )}
                  <button
                    title="ลบ"
                    onClick={() => void remove(e)}
                    className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          {!error && !loading && entries.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground">โฟลเดอร์ว่าง</div>
          )}
        </div>

        {/* transfers */}
        {activeTransfers.length > 0 && (
          <div className="space-y-1.5 border-t border-border pt-2">
            {activeTransfers.map((t) => {
              const pct = t.total > 0 ? Math.round((t.transferred / t.total) * 100) : 0
              return (
                <div key={t.transferId} className="flex items-center gap-2 text-xs">
                  {t.direction === 'up' ? (
                    <Upload className="size-3 shrink-0 text-primary" />
                  ) : (
                    <Download className="size-3 shrink-0 text-primary" />
                  )}
                  <span className="w-40 shrink-0 truncate">{t.name}</span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn('h-full rounded-full', t.error ? 'bg-destructive' : 'bg-primary')}
                      style={{ width: `${t.error ? 100 : pct}%` }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right text-muted-foreground">
                    {t.error ? 'ผิดพลาด' : t.done ? 'เสร็จ' : `${pct}%`}
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
