import { useEffect, useRef, useState, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import { WebglAddon } from '@xterm/addon-webgl'
import {
  Search,
  Copy,
  Eraser,
  AArrowUp,
  AArrowDown,
  X,
  ChevronUp,
  ChevronDown,
  Bot,
  TextSelect,
  ClipboardPaste
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useTabs } from '../store/useTabs'
import { useAiDraft } from '../store/useAiDraft'

// Catppuccin Mocha — palette ที่เข้ากับธีมม่วงของแอป ทำให้ output (ls, git, ฯลฯ) มีสีสวย
const THEME = {
  background: '#181825',
  foreground: '#cdd6f4',
  cursor: '#b4befe',
  cursorAccent: '#181825',
  selectionBackground: '#414458',
  black: '#45475a',
  brightBlack: '#585b70',
  red: '#f38ba8',
  brightRed: '#f38ba8',
  green: '#a6e3a1',
  brightGreen: '#a6e3a1',
  yellow: '#f9e2af',
  brightYellow: '#f9e2af',
  blue: '#89b4fa',
  brightBlue: '#89b4fa',
  magenta: '#cba6f7',
  brightMagenta: '#cba6f7',
  cyan: '#94e2d5',
  brightCyan: '#94e2d5',
  white: '#bac2de',
  brightWhite: '#a6adc8'
}

const MIN_FONT = 9
const MAX_FONT = 22

export default function TerminalView({
  sessionId,
  visible
}: {
  sessionId: string
  visible: boolean
}): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const searchRef = useRef<SearchAddon | null>(null)
  const webglRef = useRef<WebglAddon | null>(null)
  const disposedRef = useRef(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [fontSize, setFontSize] = useState(13)
  const [menu, setMenu] = useState<{ x: number; y: number; sel: string } | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchOpenRef = useRef(false)
  const removeTab = useTabs((s) => s.removeTab)
  const sendToAi = useAiDraft((s) => s.send)

  useEffect(() => {
    searchOpenRef.current = searchOpen
  }, [searchOpen])

  const refit = (): void => {
    fitRef.current?.fit()
    if (termRef.current) {
      window.api.terminal.resize(sessionId, termRef.current.cols, termRef.current.rows)
    }
  }

  useEffect(() => {
    if (!hostRef.current) return
    disposedRef.current = false
    const term = new Terminal({
      fontFamily:
        "'JetBrains Mono', 'Anuphan', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      fontSize: 13,
      fontWeight: 400,
      fontWeightBold: 700,
      lineHeight: 1.0,
      letterSpacing: 0.2,
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
      scrollback: 12000,
      theme: THEME,
      allowProposedApi: true,
      macOptionIsMeta: true
    })
    const fit = new FitAddon()
    const search = new SearchAddon()
    term.loadAddon(fit)
    term.loadAddon(search)
    term.loadAddon(new WebLinksAddon())
    term.open(hostRef.current)
    fit.fit()

    // WebGL ให้เรนเดอร์คมขึ้น (fallback เงียบ ๆ ถ้าเปิดไม่ได้)
    try {
      const webgl = new WebglAddon()
      webgl.onContextLoss(() => {
        try {
          webgl.dispose()
        } catch {
          /* noop */
        }
      })
      term.loadAddon(webgl)
      webglRef.current = webgl
    } catch {
      /* ใช้ canvas renderer ปกติ */
    }

    termRef.current = term
    fitRef.current = fit
    searchRef.current = search

    // เปิด search ด้วย Cmd/Ctrl+F, ปิดด้วย Esc — ไม่ส่งคีย์พวกนี้เข้า shell
    term.attachCustomKeyEventHandler((e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        if (e.type === 'keydown') {
          setSearchOpen(true)
          requestAnimationFrame(() => searchInputRef.current?.focus())
        }
        return false
      }
      if (e.key === 'Escape' && searchOpenRef.current) {
        if (e.type === 'keydown') setSearchOpen(false)
        return false
      }
      return true
    })

    const dataDisp = term.onData((d) => window.api.terminal.write(sessionId, d))
    const offData = window.api.terminal.onData(sessionId, (d) => {
      if (!disposedRef.current) term.write(d)
    })
    const offExit = window.api.terminal.onExit(sessionId, () => {
      if (!disposedRef.current)
        term.write('\r\n\x1b[38;2;108;112;134m── session closed ──\x1b[0m\r\n')
      // ปิด tab อัตโนมัติเมื่อ session จบ (เช่นพิมพ์ exit)
      window.setTimeout(() => removeTab(sessionId), 600)
    })

    window.api.terminal.resize(sessionId, term.cols, term.rows)
    void document.fonts.ready.then(refit)

    const ro = new ResizeObserver(() => refit())
    ro.observe(hostRef.current)

    return () => {
      disposedRef.current = true
      try {
        dataDisp.dispose()
      } catch {
        /* noop */
      }
      offData()
      offExit()
      ro.disconnect()
      // dispose WebGL addon ก่อน term เสมอ — กัน exception ตอนปิด session
      try {
        webglRef.current?.dispose()
      } catch {
        /* noop */
      }
      webglRef.current = null
      try {
        term.dispose()
      } catch {
        /* noop */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  useEffect(() => {
    if (visible) requestAnimationFrame(refit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sessionId])

  // ปรับขนาดฟอนต์
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.fontSize = fontSize
      requestAnimationFrame(refit)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontSize])

  // ค้นหาเมื่อพิมพ์ (ไฮไลต์ทุก match)
  useEffect(() => {
    if (query)
      searchRef.current?.findNext(query, {
        decorations: {
          matchBackground: '#585b70',
          activeMatchBackground: '#b4befe',
          matchOverviewRuler: '#585b70',
          activeMatchColorOverviewRuler: '#b4befe'
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const copySel = async (): Promise<void> => {
    const sel = termRef.current?.getSelection()
    if (sel) await navigator.clipboard.writeText(sel)
  }
  const clearTerm = (): void => termRef.current?.clear()
  const bumpFont = (d: number): void =>
    setFontSize((f) => Math.min(MAX_FONT, Math.max(MIN_FONT, f + d)))

  const containerRef = useRef<HTMLDivElement>(null)

  const openMenu = (e: ReactMouseEvent): void => {
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    setMenu({
      x: e.clientX - (rect?.left ?? 0),
      y: e.clientY - (rect?.top ?? 0),
      sel: termRef.current?.getSelection() ?? ''
    })
  }
  const closeMenu = (): void => setMenu(null)

  const pasteClip = async (): Promise<void> => {
    const text = await navigator.clipboard.readText()
    if (text) window.api.terminal.write(sessionId, text)
  }

  return (
    <div
      ref={containerRef}
      className="group relative h-full w-full bg-[#181825]"
      style={{ display: visible ? 'block' : 'none' }}
      onContextMenu={openMenu}
    >
      <div ref={hostRef} className="h-full w-full px-3 py-2" />

      {/* right-click context menu */}
      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeMenu} onContextMenu={(e) => { e.preventDefault(); closeMenu() }} />
          <div
            className="absolute z-50 min-w-[200px] animate-fade-in overflow-hidden rounded-lg border border-border bg-popover p-1 text-sm shadow-xl"
            style={{ left: menu.x, top: menu.y }}
          >
            <MenuItem
              icon={<Bot className="size-3.5 text-primary" />}
              label="ส่งที่เลือกให้ AI"
              disabled={!menu.sel}
              onClick={() => {
                sendToAi('```\n' + menu.sel.trim() + '\n```')
                closeMenu()
              }}
            />
            <MenuItem
              icon={<Copy className="size-3.5" />}
              label="คัดลอกที่เลือก"
              shortcut="⌘C"
              disabled={!menu.sel}
              onClick={() => {
                void copySel()
                closeMenu()
              }}
            />
            <MenuItem
              icon={<ClipboardPaste className="size-3.5" />}
              label="วาง"
              shortcut="⌘V"
              onClick={() => {
                void pasteClip()
                closeMenu()
              }}
            />
            <div className="my-1 h-px bg-border" />
            <MenuItem
              icon={<TextSelect className="size-3.5" />}
              label="เลือกทั้งหมด"
              onClick={() => {
                termRef.current?.selectAll()
                closeMenu()
              }}
            />
            <MenuItem
              icon={<Eraser className="size-3.5" />}
              label="ล้างหน้าจอ"
              onClick={() => {
                clearTerm()
                closeMenu()
              }}
            />
          </div>
        </>
      )}

      {/* toolbar ลอยมุมขวาบน โผล่ตอน hover */}
      <div
        className={cn(
          'absolute right-3 top-2 flex items-center gap-0.5 rounded-lg border border-border/60 bg-card/80 p-0.5 shadow-lg backdrop-blur transition-opacity',
          searchOpen ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'
        )}
      >
        <ToolBtn title="ค้นหา (⌘F)" onClick={() => { setSearchOpen(true); requestAnimationFrame(() => searchInputRef.current?.focus()) }}>
          <Search className="size-3.5" />
        </ToolBtn>
        <ToolBtn title="คัดลอกที่เลือก" onClick={copySel}>
          <Copy className="size-3.5" />
        </ToolBtn>
        <ToolBtn title="ล้างหน้าจอ" onClick={clearTerm}>
          <Eraser className="size-3.5" />
        </ToolBtn>
        <div className="mx-0.5 h-4 w-px bg-border" />
        <ToolBtn title="ลดขนาดฟอนต์" onClick={() => bumpFont(-1)}>
          <AArrowDown className="size-3.5" />
        </ToolBtn>
        <ToolBtn title="เพิ่มขนาดฟอนต์" onClick={() => bumpFont(1)}>
          <AArrowUp className="size-3.5" />
        </ToolBtn>
      </div>

      {/* search overlay */}
      {searchOpen && (
        <div className="absolute right-3 top-2 flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-xl">
          <Search className="ml-1 size-3.5 text-muted-foreground" />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter')
                e.shiftKey
                  ? searchRef.current?.findPrevious(query)
                  : searchRef.current?.findNext(query)
              if (e.key === 'Escape') setSearchOpen(false)
            }}
            placeholder="ค้นหา…"
            className="w-44 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
          />
          <ToolBtn title="ก่อนหน้า (⇧⏎)" onClick={() => searchRef.current?.findPrevious(query)}>
            <ChevronUp className="size-3.5" />
          </ToolBtn>
          <ToolBtn title="ถัดไป (⏎)" onClick={() => searchRef.current?.findNext(query)}>
            <ChevronDown className="size-3.5" />
          </ToolBtn>
          <ToolBtn title="ปิด (Esc)" onClick={() => setSearchOpen(false)}>
            <X className="size-3.5" />
          </ToolBtn>
        </div>
      )}
    </div>
  )
}

function ToolBtn({
  title,
  onClick,
  children
}: {
  title: string
  onClick: () => void
  children: ReactNode
}): JSX.Element {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  )
}

function MenuItem({
  icon,
  label,
  shortcut,
  disabled,
  onClick
}: {
  icon: ReactNode
  label: string
  shortcut?: string
  disabled?: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
    >
      {icon}
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-xs text-muted-foreground">{shortcut}</span>}
    </button>
  )
}
