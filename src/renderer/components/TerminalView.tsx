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
  ClipboardPaste,
  Sparkles,
  FolderSymlink,
  Container
} from 'lucide-react'
import { cn } from '../lib/utils'
import { redactSecrets } from '@shared/redact'
import { useTabs } from '../store/useTabs'
import { useAiDraft } from '../store/useAiDraft'
import SftpBrowser from './SftpBrowser'
import DockerPanel from './DockerPanel'

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
  // ghost text อินไลน์ตรงเคอร์เซอร์ (คำแนะนำจากประวัติ)
  const [ghost, setGhost] = useState<{
    text: string
    left: number
    top: number
    cw: number
    ch: number
  } | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchOpenRef = useRef(false)
  const removeTab = useTabs((s) => s.removeTab)
  const sendToAi = useAiDraft((s) => s.send)
  const tabKind = useTabs((s) => s.tabs.find((t) => t.sessionId === sessionId)?.kind)
  const tabTitle = useTabs((s) => s.tabs.find((t) => t.sessionId === sessionId)?.title ?? '')
  const [sftpOpen, setSftpOpen] = useState(false)
  const [dockerOpen, setDockerOpen] = useState(false)
  const [dockerAvailable, setDockerAvailable] = useState(false)

  // --- autocomplete จากประวัติคำสั่ง ---
  const historyRef = useRef<string[]>([])
  const typedRef = useRef('') // บรรทัดที่ผู้ใช้พิมพ์อยู่ (best-effort)
  const trackingRef = useRef(true) // false เมื่อ desync (มี control/escape) → หยุดแนะนำจน Enter
  const suggRef = useRef<{ prefix: string; list: string[] } | null>(null)

  // ขนาด cell จริงของ xterm (ใช้วาง ghost ให้ตรงกริดตัวอักษร)
  const PAD_L = 12 // ตรงกับ px-3 ของ host
  const PAD_T = 8 // ตรงกับ pt-2 ของ host
  const cellDims = (): { w: number; h: number } => {
    const core = (
      termRef.current as unknown as {
        _core?: { _renderService?: { dimensions?: { css?: { cell?: { width: number; height: number } } } } }
      }
    )?._core
    const cell = core?._renderService?.dimensions?.css?.cell
    if (cell?.width && cell?.height) return { w: cell.width, h: cell.height }
    const fs = termRef.current?.options.fontSize ?? fontSize
    return { w: fs * 0.6, h: fs * 0.9 }
  }

  // วาง ghost ที่ตำแหน่งเคอร์เซอร์ปัจจุบัน (เรียกตอน suggestion เปลี่ยน + ตอนเคอร์เซอร์ขยับ = หลัง echo)
  const updateGhostPos = (): void => {
    const term = termRef.current
    const s = suggRef.current
    if (!term || !s || term.buffer.active.type === 'alternate') return setGhost(null)
    const buf = term.buffer.active
    const { w, h } = cellDims()
    setGhost({
      text: s.list[0].slice(s.prefix.length),
      left: PAD_L + buf.cursorX * w,
      top: PAD_T + buf.cursorY * h,
      cw: w,
      ch: h
    })
  }

  const setSuggestion = (s: { prefix: string; list: string[] } | null): void => {
    suggRef.current = s
    if (s) updateGhostPos()
    else setGhost(null)
  }

  const recomputeSugg = (): void => {
    const line = typedRef.current
    if (!trackingRef.current || line.length < 2) return setSuggestion(null)
    const list: string[] = []
    for (const h of historyRef.current) {
      if (h.length > line.length && h.startsWith(line)) {
        list.push(h)
        if (list.length >= 3) break
      }
    }
    setSuggestion(list.length ? { prefix: line, list } : null)
  }

  // ติดตามคีย์ที่ผู้ใช้พิมพ์เพื่อเดาคำสั่ง + บันทึกประวัติตอน Enter
  const handleTyped = (d: string): void => {
    // อยู่ใน full-screen app (vim/less/htop ใช้ alternate buffer) → ไม่แนะนำ
    if (termRef.current?.buffer.active.type === 'alternate') {
      typedRef.current = ''
      if (suggRef.current) setSuggestion(null)
      return
    }
    if (d === '\r' || d === '\n') {
      const line = typedRef.current
      if (trackingRef.current && line.trim()) {
        window.api.sessions.recordCommand(sessionId, line.trim())
        historyRef.current = [line.trim(), ...historyRef.current.filter((h) => h !== line.trim())].slice(0, 500)
      }
      typedRef.current = ''
      trackingRef.current = true
      return setSuggestion(null)
    }
    if (d === '\x7f' || d === '\b') {
      typedRef.current = typedRef.current.slice(0, -1)
      return recomputeSugg()
    }
    if (d === '\x03' || d === '\x15' || d === '\x17') {
      // Ctrl-C / Ctrl-U / Ctrl-W → ล้างบรรทัด
      typedRef.current = ''
      trackingRef.current = true
      return setSuggestion(null)
    }
    if (/^[\x20-\x7e]+$/.test(d)) {
      typedRef.current += d
      return recomputeSugg()
    }
    // escape sequence / arrows / Tab(native) → desync, หยุดแนะนำจนกว่าจะ Enter
    trackingRef.current = false
    setSuggestion(null)
  }

  const acceptSuggestion = (s: string): void => {
    const completion = s.slice(typedRef.current.length)
    if (completion) window.api.terminal.write(sessionId, completion)
    typedRef.current = s
    setSuggestion(null)
    termRef.current?.focus()
  }

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
      lineHeight: 0.9,
      letterSpacing: 0,
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
    // คลิก URL ใน output → เปิดด้วย default browser (main จะกรองเฉพาะ http/https)
    term.loadAddon(new WebLinksAddon((_e, uri) => window.api.openExternal(uri)))
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
      // Tab → รับ suggestion จากประวัติ ถ้ามี (ไม่งั้นปล่อยให้ shell ทำ completion เอง)
      if (e.key === 'Tab' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const s = suggRef.current
        if (s && trackingRef.current) {
          if (e.type === 'keydown') {
            // สำคัญ: xterm ไม่ preventDefault ให้ตอน handler คืน false → browser จะเลื่อน
            // focus ไปปุ่มถัดไป (ปุ่มค้นหา) ต้องกันเอง
            e.preventDefault()
            acceptSuggestion(s.list[0])
          }
          return false
        }
        return true
      }
      return true
    })

    // โหลดประวัติคำสั่งสำหรับ autocomplete
    void window.api.sessions.recentCommands().then((h) => {
      historyRef.current = h
    })

    const dataDisp = term.onData((d) => {
      window.api.terminal.write(sessionId, d)
      handleTyped(d)
    })
    // เคอร์เซอร์ขยับ (หลัง shell echo คำที่พิมพ์) → ขยับ ghost ให้ตรง
    const cursorDisp = term.onCursorMove(() => {
      if (suggRef.current) updateGhostPos()
    })
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

    // โฟกัสเข้า console ทันทีที่เปิด session ใหม่ — พิมพ์ได้เลยไม่ต้องคลิกก่อน
    requestAnimationFrame(() => {
      if (!disposedRef.current) term.focus()
    })

    const ro = new ResizeObserver(() => refit())
    ro.observe(hostRef.current)

    return () => {
      disposedRef.current = true
      try {
        dataDisp.dispose()
        cursorDisp.dispose()
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
    if (visible)
      requestAnimationFrame(() => {
        refit()
        termRef.current?.focus() // สลับมา tab นี้ → โฟกัส console เลย
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sessionId])

  // SSH: หลังต่อแล้ว เช็คว่ามี docker container ไหม → ถ้ามี โชว์ปุ่ม Docker
  useEffect(() => {
    if (tabKind !== 'ssh') return
    let cancelled = false
    window.api.docker
      .list(sessionId)
      .then((r) => {
        if (!cancelled) setDockerAvailable(r.available && r.containers.length > 0)
      })
      .catch(() => {
        /* ไม่มี docker / ไม่มีสิทธิ์ — ไม่โชว์ปุ่ม */
      })
    return () => {
      cancelled = true
    }
  }, [tabKind, sessionId])

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

  // อ่าน output ล่าสุดจาก buffer (ท้าย ~N บรรทัด) สำหรับส่งให้ AI ดู
  const recentOutput = (lines = 40): string => {
    const term = termRef.current
    if (!term) return ''
    const buf = term.buffer.active
    const end = buf.baseY + buf.cursorY
    const start = Math.max(0, end - lines)
    const rows: string[] = []
    for (let i = start; i <= end; i++) {
      rows.push(buf.getLine(i)?.translateToString(true) ?? '')
    }
    return rows.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  }

  // ถาม AI ว่าทำไมพัง/ช่วยแก้ — ใช้ selection ถ้ามี ไม่งั้นเอาคำสั่งล่าสุด + output ล่าสุด
  // (redact ความลับก่อนส่งเสมอ)
  const askAiHelp = (selection?: string): void => {
    const sel = selection?.trim()
    let body: string
    if (sel) {
      body = sel
    } else {
      const lastCmd = historyRef.current[0]
      body = (lastCmd ? `$ ${lastCmd}\n` : '') + recentOutput(40)
    }
    body = redactSecrets(body).slice(0, 4000).trim()
    if (!body) return
    sendToAi(
      `ช่วยดูให้หน่อยว่าเกิดอะไรขึ้นใน terminal นี้ ถ้ามี error บอกสาเหตุและวิธีแก้:\n\n\`\`\`\n${body}\n\`\`\``
    )
  }

  return (
    <div
      ref={containerRef}
      className="group relative h-full w-full bg-[#181825]"
      style={{ display: visible ? 'block' : 'none' }}
      onContextMenu={openMenu}
    >
      <div ref={hostRef} className="h-full w-full px-3 pb-5 pt-2" />

      {/* right-click context menu */}
      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeMenu} onContextMenu={(e) => { e.preventDefault(); closeMenu() }} />
          <div
            className="absolute z-50 min-w-[200px] animate-fade-in overflow-hidden rounded-lg border border-border bg-popover p-1 text-sm shadow-xl"
            style={{ left: menu.x, top: menu.y }}
          >
            <MenuItem
              icon={<Sparkles className="size-3.5 text-primary" />}
              label="ถาม AI: ทำไมพัง / ช่วยแก้"
              onClick={() => {
                askAiHelp(menu.sel)
                closeMenu()
              }}
            />
            <MenuItem
              icon={<Bot className="size-3.5 text-primary" />}
              label="ส่งที่เลือกให้ AI"
              disabled={!menu.sel}
              onClick={() => {
                sendToAi('```\n' + redactSecrets(menu.sel.trim()) + '\n```')
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
          'absolute right-3 top-2 z-40 flex items-center gap-0.5 rounded-lg border border-border/60 bg-card/80 p-0.5 shadow-lg backdrop-blur transition-opacity',
          searchOpen
            ? 'pointer-events-none opacity-0'
            : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100'
        )}
      >
        {tabKind === 'ssh' && (
          <>
            {dockerAvailable && (
              <ToolBtn title="จัดการ Docker containers" onClick={() => setDockerOpen(true)}>
                <Container className="size-3.5 text-primary" />
              </ToolBtn>
            )}
            <ToolBtn title="ไฟล์ (SFTP)" onClick={() => setSftpOpen(true)}>
              <FolderSymlink className="size-3.5" />
            </ToolBtn>
            <div className="mx-0.5 h-4 w-px bg-border" />
          </>
        )}
        <ToolBtn title="ถาม AI: ทำไมพัง / ช่วยแก้" onClick={() => askAiHelp(termRef.current?.getSelection())}>
          <Sparkles className="size-3.5 text-primary" />
        </ToolBtn>
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
        <div className="absolute right-3 top-2 z-50 flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-xl">
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

      {/* ghost text อินไลน์ตรงเคอร์เซอร์ (แนะนำจากประวัติ · กด Tab เพื่อรับ) */}
      {ghost && ghost.text && !searchOpen && (
        <div
          className="pointer-events-none absolute z-30 select-none whitespace-pre"
          style={{
            left: ghost.left,
            top: ghost.top,
            height: ghost.ch,
            // ล็อก line-height = ความสูง cell จริง (ไม่งั้น default ~1.2× จะดันตัวอักษรหลุดแถว)
            lineHeight: `${ghost.ch}px`,
            fontFamily:
              "'JetBrains Mono', 'Anuphan', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            fontSize,
            color: '#6c7086'
          }}
        >
          {/* วางแต่ละตัวอักษรในกล่องกว้างเท่า cell + ชิดบน → ตรงกริด xterm */}
          {[...ghost.text].map((ch, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                width: ghost.cw,
                height: ghost.ch,
                lineHeight: `${ghost.ch}px`,
                verticalAlign: 'top'
              }}
            >
              {ch}
            </span>
          ))}
          <span
            className="ml-1.5 rounded bg-secondary/60 px-1 text-[9px] text-muted-foreground"
            style={{ verticalAlign: 'top', lineHeight: `${ghost.ch}px` }}
          >
            ⇥ Tab
          </span>
        </div>
      )}

      {tabKind === 'ssh' && sftpOpen && (
        <SftpBrowser
          sessionId={sessionId}
          title={tabTitle}
          open={sftpOpen}
          onClose={() => setSftpOpen(false)}
        />
      )}

      {tabKind === 'ssh' && dockerOpen && (
        <DockerPanel
          sessionId={sessionId}
          title={tabTitle}
          open={dockerOpen}
          onClose={() => setDockerOpen(false)}
        />
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
