import { Globe, MonitorDot, X } from 'lucide-react'
import { useTabs } from '../store/useTabs'
import { cn } from '../lib/utils'
import { useT } from '../lib/i18n'

export default function TabBar(): JSX.Element {
  const t = useT()
  const { tabs, activeId, setActive, removeTab } = useTabs()

  const close = (id: string): void => {
    window.api.terminal.close(id)
    removeTab(id)
  }

  return (
    <div className="titlebar flex h-titlebar shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border bg-sidebar px-2">
      {tabs.length === 0 && (
        <span className="px-2 text-xs text-muted-foreground">
          {t('ยังไม่มี session — เปิดจากรายการ server หรือ local')}
        </span>
      )}
      {tabs.map((tab) => {
        const active = activeId === tab.sessionId
        const Icon = tab.kind === 'ssh' ? Globe : MonitorDot
        return (
          <div
            key={tab.sessionId}
            onClick={() => setActive(tab.sessionId)}
            className={cn(
              'no-drag group flex h-8 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-xs transition-colors',
              active
                ? 'border-border bg-card text-foreground shadow-sm'
                : 'border-transparent text-muted-foreground hover:bg-card/50'
            )}
          >
            <Icon className={cn('size-3.5', active ? 'text-primary' : 'opacity-70')} />
            <span className="max-w-[150px] truncate">{tab.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                close(tab.sessionId)
              }}
              className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
            >
              <X className="size-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
