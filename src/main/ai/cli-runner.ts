import { spawn } from 'child_process'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { buildEnv } from '../terminal/pty-session'
import { resolveBin } from './cli-status'

// รัน CLI ของ subscription แบบ headless หนึ่งรอบ — CLI ทำ agent loop เอง
// เครื่องมือในตัวของ CLI ถูกปิด เหลือแค่เครื่องมือของ Perms ผ่าน MCP (mcpUrl)

export interface CliRunParams {
  bin: 'codex' | 'claude'
  /** 'default' = ใช้โมเดลตามที่ตั้งไว้ใน CLI */
  model: string
  /** system prompt (claude ใช้เป็น --system-prompt · codex ไม่มีช่องนี้ → ผู้เรียกต่อเข้า prompt เอง) */
  system: string
  prompt: string
  mcpUrl: string
  /** session ของ CLI ที่จะทำต่อ (ความจำของบทสนทนา) */
  resumeId: string | null
  webSearch: boolean
  signal: AbortSignal
  onText: (text: string) => void
}

export interface CliRunResult {
  text: string
  /** session id ของ CLI สำหรับรอบถัดไป */
  sessionId: string | null
}

/** โฟลเดอร์ว่างให้ CLI ใช้เป็น cwd — กันไปโหลด CLAUDE.md/AGENTS.md ของโปรเจกต์อื่นเข้ามา */
function workDir(): string {
  const dir = join(app.getPath('userData'), 'ai-cli')
  mkdirSync(dir, { recursive: true })
  return dir
}

function claudeArgs(p: CliRunParams): string[] {
  const args = [
    '-p',
    '--output-format',
    'stream-json',
    '--verbose',
    // ปิดเครื่องมือในตัวทั้งหมด (Bash/Read/Edit/…) — ใช้ได้เฉพาะเครื่องมือของ Perms
    '--tools',
    '',
    '--strict-mcp-config',
    '--mcp-config',
    JSON.stringify({ mcpServers: { perms: { type: 'http', url: p.mcpUrl } } }),
    '--allowedTools',
    'mcp__perms',
    '--system-prompt',
    p.system
  ]
  if (p.model && p.model !== 'default') args.push('--model', p.model)
  if (p.resumeId) args.push('--resume', p.resumeId)
  return args
}

function codexArgs(p: CliRunParams): string[] {
  const args = [
    'exec',
    '--json',
    '--skip-git-repo-check',
    // shell ของ codex รันบนเครื่องนี้ ไม่ใช่ session ที่ผู้ใช้เปิด — ปิดทิ้ง + sandbox อ่านอย่างเดียวกันพลาด
    '--sandbox',
    'read-only',
    '--disable',
    'shell_tool',
    '--disable',
    'unified_exec',
    '--disable',
    'apps',
    '--disable',
    'browser_use',
    '--disable',
    'computer_use',
    '--disable',
    'in_app_browser',
    '--disable',
    'image_generation',
    '-c',
    'approval_policy="never"',
    '-c',
    `web_search="${p.webSearch ? 'live' : 'disabled'}"`,
    '-c',
    `mcp_servers.perms.url="${p.mcpUrl}"`,
    '-c',
    // รออนุมัติ/คำสั่งยาว ๆ ได้ (ค่าเริ่มต้น 60 วิ สั้นเกิน)
    'mcp_servers.perms.tool_timeout_sec=1800',
    '-c',
    'mcp_servers.perms.startup_timeout_sec=30',
    '-c',
    // ไม่ให้ codex ถามอนุมัติเครื่องมือของ Perms เอง — Perms มี guard/ปุ่มอนุมัติของตัวเองอยู่แล้ว
    'mcp_servers.perms.default_tools_approval_mode="approve"',
    '-C',
    workDir()
  ]
  if (p.model && p.model !== 'default') args.push('-m', p.model)
  if (p.resumeId) args.push('resume', p.resumeId)
  args.push('-') // prompt จาก stdin
  return args
}

/** codex บางทีส่ง error ของ API มาเป็น JSON ทั้งก้อน — แกะเอาแต่ข้อความ + บอกทางแก้ที่พบบ่อย */
function readableError(raw: string): string {
  let msg = raw
  try {
    const j = JSON.parse(raw) as { error?: { message?: string }; message?: string }
    msg = j.error?.message ?? j.message ?? raw
  } catch {
    /* ไม่ใช่ JSON */
  }
  if (/model is not supported|model.*not (?:found|available)/i.test(msg)) {
    msg += ' — เลือกโมเดลอื่นจากเมนูโมเดลของแชท'
  }
  return msg
}

/** ดึงข้อความ error ที่อ่านรู้เรื่องจาก stderr (ตัด log ยาว ๆ) */
function tailOf(s: string): string {
  return s.trim().split('\n').slice(-6).join('\n').slice(-800)
}

export async function runCli(p: CliRunParams): Promise<CliRunResult> {
  const bin = await resolveBin(p.bin)
  if (!bin) {
    throw new Error(
      p.bin === 'codex'
        ? 'ไม่พบ Codex CLI ในเครื่อง — ติดตั้ง (npm i -g @openai/codex) แล้ว login ด้วย "codex login" หรือใช้ API key แทน'
        : 'ไม่พบ Claude Code CLI ในเครื่อง — ติดตั้งแล้ว login ด้วย "claude auth login" หรือใช้ API key แทน'
    )
  }
  const args = p.bin === 'claude' ? claudeArgs(p) : codexArgs(p)

  return new Promise<CliRunResult>((resolve, reject) => {
    const child = spawn(bin, args, { cwd: workDir(), env: buildEnv(), stdio: ['pipe', 'pipe', 'pipe'] })
    let stdoutBuf = ''
    let stderr = ''
    let text = ''
    let sessionId: string | null = p.resumeId
    let failure: string | null = null
    let finalText: string | null = null

    const addText = (t: string): void => {
      if (!t) return
      const piece = text ? `\n\n${t}` : t
      text += piece
      p.onText(piece)
    }

    const onLine = (line: string): void => {
      if (!line.trim()) return
      let ev: Record<string, unknown>
      try {
        ev = JSON.parse(line)
      } catch {
        return // บรรทัดที่ไม่ใช่ JSON (log) — ข้าม
      }
      if (p.bin === 'claude') {
        if (typeof ev.session_id === 'string') sessionId = ev.session_id
        if (ev.type === 'system' && ev.subtype === 'init') {
          const servers = (ev.mcp_servers as { name: string; status: string }[] | undefined) ?? []
          const perms = servers.find((s) => s.name === 'perms')
          // http MCP อาจยัง 'pending' ตอน init (กำลังต่อ) — ถือว่าพังเฉพาะ failed/needs-auth
          if (perms && /fail|auth/i.test(perms.status)) {
            failure = `Claude CLI ต่อเครื่องมือของ Perms ไม่ได้ (MCP: ${perms.status})`
          }
        } else if (ev.type === 'assistant') {
          const content = (ev.message as { content?: { type: string; text?: string }[] })?.content ?? []
          for (const b of content) if (b.type === 'text') addText(b.text ?? '')
        } else if (ev.type === 'result') {
          if (ev.is_error) failure = String(ev.result ?? ev.subtype ?? 'Claude CLI error')
          else finalText = typeof ev.result === 'string' ? ev.result : null
        }
      } else {
        if (ev.type === 'thread.started' && typeof ev.thread_id === 'string') sessionId = ev.thread_id
        else if (ev.type === 'item.completed') {
          const item = ev.item as { type?: string; text?: string } | undefined
          if (item?.type === 'agent_message') addText(item.text ?? '')
        } else if (ev.type === 'turn.failed') {
          failure = String((ev.error as { message?: string })?.message ?? 'Codex turn failed')
        } else if (ev.type === 'error') {
          failure = String(ev.message ?? 'Codex error')
        }
      }
    }

    child.stdout.on('data', (d: Buffer) => {
      stdoutBuf += d.toString('utf8')
      let nl: number
      while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
        onLine(stdoutBuf.slice(0, nl))
        stdoutBuf = stdoutBuf.slice(nl + 1)
      }
    })
    child.stderr.on('data', (d: Buffer) => {
      stderr = (stderr + d.toString('utf8')).slice(-20_000)
    })

    const onAbort = (): void => {
      child.kill('SIGTERM')
    }
    p.signal.addEventListener('abort', onAbort, { once: true })

    child.on('error', (err) => {
      p.signal.removeEventListener('abort', onAbort)
      reject(err)
    })
    child.on('close', (code) => {
      p.signal.removeEventListener('abort', onAbort)
      onLine(stdoutBuf)
      if (p.signal.aborted) return reject(new Error('Request was aborted.'))
      if (failure) return reject(new Error(readableError(failure)))
      if (code !== 0) {
        return reject(new Error(`${p.bin} ออกด้วย exit code ${code}${stderr ? `\n${tailOf(stderr)}` : ''}`))
      }
      // claude: ถ้าไม่ได้ข้อความระหว่างทาง ใช้ผลสรุปท้ายสุด
      if (!text && finalText) addText(finalText)
      resolve({ text, sessionId })
    })

    child.stdin.end(p.prompt)
  })
}
