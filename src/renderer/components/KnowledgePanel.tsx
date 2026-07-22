import { useEffect, useMemo, useState } from 'react'
import { Pencil, Trash2, Plus, Search, Bot, User } from 'lucide-react'
import type { KnowledgeRecord } from '@shared/types'
import { useServers } from '../store/useServers'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { toast } from '../store/useToast'
import { useT } from '../lib/i18n'

/** เนื้อหาคลังความรู้ AI — ฝังในแท็บ Settings */
export default function KnowledgePanel(): JSX.Element {
  const t = useT()
  const { servers } = useServers()
  const [items, setItems] = useState<KnowledgeRecord[]>([])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<KnowledgeRecord | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [serverId, setServerId] = useState<string>('none')

  const load = (): void => {
    void window.api.knowledge.list().then(setItems)
  }
  useEffect(load, [])

  const serverName = (id: string | null): string | null =>
    id ? (servers.find((s) => s.id === id)?.name ?? null) : null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (k) =>
        k.title.toLowerCase().includes(q) ||
        k.content.toLowerCase().includes(q) ||
        k.tags.some((t) => t.toLowerCase().includes(q))
    )
  }, [items, query])

  const startEdit = (k: KnowledgeRecord | null): void => {
    setEditing(k)
    setTitle(k?.title ?? '')
    setContent(k?.content ?? '')
    setTagsText((k?.tags ?? []).join(', '))
    setServerId(k?.serverId ?? 'none')
  }

  const save = async (): Promise<void> => {
    if (!title.trim() || !content.trim()) return
    const tags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    await window.api.knowledge.save({
      id: editing?.id ?? null,
      title: title.trim(),
      content: content.trim(),
      tags,
      serverId: serverId === 'none' ? null : serverId,
      source: editing?.source ?? 'user'
    })
    toast(editing ? t('แก้ไขความรู้แล้ว') : t('เพิ่มความรู้แล้ว'))
    startEdit(null)
    load()
  }

  const remove = async (id: string): Promise<void> => {
    if (confirm(t("ลบความรู้นี้?"))) {
      await window.api.knowledge.remove(id)
      load()
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative shrink-0">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder={t("ค้นหาความรู้…")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="-mr-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">
        {filtered.map((k) => (
          <div key={k.id} className="rounded-xl border border-border bg-background/40 p-3">
            <div className="mb-1 flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium">{k.title}</span>
                <Badge variant={k.source === 'ai' ? 'default' : 'secondary'} className="shrink-0">
                  {k.source === 'ai' ? <Bot className="size-2.5" /> : <User className="size-2.5" />}
                  {k.source}
                </Badge>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => startEdit(k)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => remove(k.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
            <p className="whitespace-pre-wrap text-xs text-muted-foreground">{k.content}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {serverName(k.serverId) && <Badge variant="outline">🖥 {serverName(k.serverId)}</Badge>}
              {k.tags.map((t) => (
                <Badge key={t} variant="outline">
                  #{t}
                </Badge>
              ))}
              {k.useCount > 0 && (
                <span className="text-[10px] text-muted-foreground">{t('ใช้')} {k.useCount} {t('ครั้ง')}</span>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-8 text-center text-xs text-muted-foreground">
            {items.length === 0
              ? t('ยังไม่มีความรู้ — AI จะบันทึกเองเมื่อเรียนรู้ หรือเพิ่มเองด้านล่าง')
              : t('ไม่พบที่ค้นหา')}
          </div>
        )}
      </div>

      <Separator />

      <div className="shrink-0 space-y-2.5">
        <div className="text-sm font-medium">{editing ? t("แก้ไขความรู้") : t("เพิ่มความรู้")}</div>
        <Input placeholder={t("หัวข้อ")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea
          className="h-20"
          placeholder={t("รายละเอียดความรู้ (วิธีแก้, quirk, preference…)")}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="flex gap-2">
          <Input
            className="flex-1"
            placeholder={t("tags คั่นด้วย , (เช่น nginx, deploy)")}
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
          />
          <Select value={serverId} onValueChange={setServerId}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("ความรู้กลาง")}</SelectItem>
              {servers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          {editing && (
            <Button variant="ghost" onClick={() => startEdit(null)}>
              {t("ยกเลิก")}
            </Button>
          )}
          <Button onClick={save} disabled={!title.trim() || !content.trim()}>
            <Plus className="size-4" /> {t("บันทึก")}
          </Button>
        </div>
      </div>
    </div>
  )
}
