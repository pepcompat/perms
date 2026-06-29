import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'

const THEME = {
  background: '#0c0c10',
  foreground: '#e8e8ec',
  cursor: '#9b7ef0',
  cursorAccent: '#0c0c10',
  selectionBackground: '#3a3550',
  black: '#1a1a22',
  brightBlack: '#4b4b58'
}

export default function TerminalView({
  sessionId,
  visible
}: {
  sessionId: string
  visible: boolean
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const term = new Terminal({
      fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      theme: THEME,
      scrollback: 10000
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.open(ref.current)
    fit.fit()
    termRef.current = term
    fitRef.current = fit

    // ส่ง keystroke ไป main
    const dataDisp = term.onData((d) => window.api.terminal.write(sessionId, d))
    // รับ output จาก main
    const offData = window.api.terminal.onData(sessionId, (d) => term.write(d))
    const offExit = window.api.terminal.onExit(sessionId, () => {
      term.write('\r\n\x1b[90m[session closed]\x1b[0m\r\n')
    })

    window.api.terminal.resize(sessionId, term.cols, term.rows)

    // refit หลังฟอนต์ JetBrains Mono โหลดเสร็จ กัน glyph เพี้ยน
    void document.fonts.ready.then(() => {
      fit.fit()
      window.api.terminal.resize(sessionId, term.cols, term.rows)
    })

    const ro = new ResizeObserver(() => {
      fit.fit()
      window.api.terminal.resize(sessionId, term.cols, term.rows)
    })
    ro.observe(ref.current)

    return () => {
      dataDisp.dispose()
      offData()
      offExit()
      ro.disconnect()
      term.dispose()
    }
  }, [sessionId])

  // refit เมื่อ tab กลับมา visible
  useEffect(() => {
    if (visible && fitRef.current && termRef.current) {
      requestAnimationFrame(() => {
        fitRef.current?.fit()
        window.api.terminal.resize(sessionId, termRef.current!.cols, termRef.current!.rows)
      })
    }
  }, [visible, sessionId])

  return (
    <div
      ref={ref}
      className="h-full w-full p-1"
      style={{ display: visible ? 'block' : 'none' }}
    />
  )
}
