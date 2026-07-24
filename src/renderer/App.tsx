import { useEffect, useState } from 'react'
import ServerList from './components/ServerList'
import TabBar from './components/TabBar'
import TerminalView from './components/TerminalView'
import AISidebar from './components/AISidebar'
import Settings from './components/Settings'
import SessionHistory from './components/SessionHistory'
import Runbooks from './components/Runbooks'
import UpdateToast from './components/UpdateToast'
import WhatsNew from './components/WhatsNew'
import Toaster from './components/Toaster'
import HostKeyDialog from './components/HostKeyDialog'
import TransferQueue from './components/TransferQueue'
import { whatsNewFor, CHANGELOG, type ChangelogEntry } from './lib/changelog'
import { TooltipProvider } from './components/ui/tooltip'
import { Resizer, useResizable } from './components/Resizer'
import { ErrorBoundary } from './components/ErrorBoundary'
import { logoUrl } from './lib/logo'
import { useTabs } from './store/useTabs'
import { useSettings } from './store/useSettings'
import { toast } from './store/useToast'
import { useT } from './lib/i18n'

export default function App(): JSX.Element {
  const t = useT()
  const { tabs, activeId } = useTabs()
  const restoreTabs = useTabs((s) => s.restoreTabs)
  const { refresh } = useSettings()
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showRunbooks, setShowRunbooks] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const [whatsNew, setWhatsNew] = useState<ChangelogEntry[]>([])
  const [changelogOpen, setChangelogOpen] = useState(false)

  const sidebar = useResizable('ui.sidebarWidth', 256, 180, 460, 'left')
  const ai = useResizable('ui.aiWidth', 384, 280, 640, 'right')

  useEffect(() => {
    void refresh()
  }, [refresh])

  // session อยู่ใน main process ไม่ได้ตายไปกับหน้าจอ — พอ renderer โหลดใหม่
  // (กด refresh หรือ UI แครช) ให้ถามกลับว่ามีอะไรเปิดค้างอยู่แล้วสร้าง tab คืน
  useEffect(() => {
    void window.api.terminal.list().then((live) => {
      if (!live.length) return
      restoreTabs(
        live.map((s) => ({
          sessionId: s.sessionId,
          title: s.title,
          kind: s.kind,
          serverId: s.serverId
        }))
      )
    })
  }, [restoreTabs])

  // AI บันทึกความรู้ → toast
  useEffect(() => {
    return window.api.onKnowledgeSaved((title) => toast(`💡 บันทึกความรู้: ${title}`))
  }, [])

  // หลังอัปเดตเวอร์ชัน → เด้ง modal "มีอะไรใหม่" ครั้งแรก แล้วจำว่าเห็นแล้ว
  useEffect(() => {
    void window.api.appVersion().then((v) => {
      setAppVersion(v)
      const key = 'app.lastSeenVersion'
      const entries = whatsNewFor(localStorage.getItem(key), v)
      if (entries.length) setWhatsNew(entries)
      localStorage.setItem(key, v)
    })
  }, [])

  return (
    <TooltipProvider delayDuration={120} skipDelayDuration={400}>
      <div className="flex h-full w-full bg-background text-foreground">
        <ServerList
          width={sidebar.width}
          version={appVersion}
          onOpenSettings={() => setShowSettings(true)}
          onOpenHistory={() => setShowHistory(true)}
          onOpenRunbooks={() => setShowRunbooks(true)}
          onOpenChangelog={() => setChangelogOpen(true)}
        />

        <Resizer onMouseDown={sidebar.startDrag} active={sidebar.dragging} />

        <div className="flex min-w-0 flex-1 flex-col">
          <TabBar />
          <div className="relative flex-1 overflow-hidden bg-[#0c0c10]">
            {tabs.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
                <img src={logoUrl} alt="Perms" className="size-20 rounded-2xl shadow-xl" />
                <div className="text-center">
                  <p className="text-base font-semibold text-foreground">Perms</p>
                  <p className="mt-1 text-sm">{t('เลือก server เพื่อเชื่อม SSH หรือเปิด local terminal')}</p>
                </div>
              </div>
            ) : (
              tabs.map((t) => (
                <div key={t.sessionId} className="absolute inset-0">
                  <ErrorBoundary resetKey={t.sessionId}>
                    <TerminalView sessionId={t.sessionId} visible={t.sessionId === activeId} />
                  </ErrorBoundary>
                </div>
              ))
            )}
          </div>
        </div>

        <Resizer onMouseDown={ai.startDrag} active={ai.dragging} />

        <AISidebar width={ai.width} />

        {showSettings && <Settings open onClose={() => setShowSettings(false)} />}
        {showHistory && <SessionHistory open onClose={() => setShowHistory(false)} />}
        {showRunbooks && <Runbooks open onClose={() => setShowRunbooks(false)} />}

        {whatsNew.length > 0 && (
          <WhatsNew version={appVersion} entries={whatsNew} onClose={() => setWhatsNew([])} />
        )}
        {changelogOpen && (
          <WhatsNew
            version={appVersion}
            entries={CHANGELOG}
            manual
            onClose={() => setChangelogOpen(false)}
          />
        )}

        <HostKeyDialog />
        <TransferQueue />
        <UpdateToast />
        <Toaster />
      </div>
    </TooltipProvider>
  )
}
