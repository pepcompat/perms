import { BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { ToolSchema } from './providers/types'
import {
  execInSession,
  runInTerminal,
  runInTerminalCapture,
  terminalText,
  getSessionHandle
} from '../terminal/session-manager'
import { listServers } from '../db/repos/servers-repo'
import { getSession, searchCommands } from '../db/repos/sessions-repo'
import { saveKnowledge, searchKnowledge } from '../db/repos/knowledge-repo'
import { listRunbooks } from '../db/repos/runbooks-repo'
import { extractPlaceholdersAll, fillTemplate } from '@shared/template'
import { matchDangerous } from '@shared/dangerous-commands'

export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: 'run_command',
    description:
      'Run a NON-INTERACTIVE shell command and get its stdout/stderr, exit code and the resulting working directory back. Each call is a fresh non-TTY shell, but the working directory DOES persist between run_command calls (a `cd` carries over); env vars/exports do not. Use for inspection and for ordinary non-interactive work (mkdir, file edits, builds, ls, systemctl status, grep...). Do NOT use for programs that prompt for input or need a TTY — use run_in_terminal for those.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to execute' }
      },
      required: ['command']
    }
  },
  {
    name: 'run_in_terminal',
    description:
      "Type a command into the user's REAL interactive terminal (with a TTY) so it runs live and the user can see it and respond to any prompts. Use for: interactive installers that ask y/n (e.g. apt install, bash install scripts), TUI apps (vim, htop, top, less), long-running/streaming processes, or anything that must change the user's own shell state (export, source). Returns the terminal output captured until the output goes quiet for a couple of seconds (up to ~30s) — a long-running or prompting command may still be running; check again with run_command if needed.",
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The command to type into the terminal' }
      },
      required: ['command']
    }
  },
  {
    name: 'list_servers',
    description: 'List the saved SSH servers (name, host, username, group).',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'get_session_info',
    description: 'Get info about the current terminal session (kind, server, title).',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'search_command_history',
    description: 'Search previously run commands across all sessions by substring.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query']
    }
  },
  {
    name: 'save_knowledge',
    description:
      'Save a durable learning to the persistent knowledge base so it can help in future sessions. Use when the user teaches you something, corrects you, states a preference, or when you discover a reusable fix or a server-specific quirk. Keep it concise and self-contained. NEVER save secrets, passwords, API keys, or one-off trivia.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title for the learning' },
        content: { type: 'string', description: 'The knowledge (concise, self-contained)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags' }
      },
      required: ['title', 'content']
    }
  },
  {
    name: 'search_knowledge',
    description:
      'Search the saved knowledge base for previously learned facts, fixes, or preferences relevant to the current task.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query']
    }
  },
  {
    name: 'list_runbooks',
    description:
      'List the saved runbooks (named, reusable command sequences) with their steps. Use to see if a saved procedure already exists for the task.',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'run_runbook',
    description:
      "Run a saved runbook by name — types its commands into the user's interactive terminal in order. If the runbook has {{placeholders}}, provide their values via params_json. Call list_runbooks first to see each runbook's params.",
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The runbook name' },
        params_json: {
          type: 'string',
          description:
            'JSON object mapping placeholder names to values, e.g. {"version":"v1.0.0","service":"backend"}. Required if the runbook has {{placeholders}}.'
        }
      },
      required: ['name']
    }
  }
]

/** ชื่อ tool ที่ "ต้องขออนุมัติ" ในโหมด approve และ "ห้ามรัน" ในโหมด suggest */
export const MUTATING_TOOLS = new Set(['run_command', 'run_in_terminal', 'run_runbook'])

/**
 * คืนเหตุผลถ้า tool call นี้จะรันคำสั่งอันตราย (บังคับขออนุมัติแม้โหมด agentic) → null ถ้าปลอดภัย
 * run_runbook: ตรวจทุก step หลังแทนค่า placeholder แล้ว
 */
export function dangerousReasonForCall(name: string, args: Record<string, unknown>): string | null {
  if (name === 'run_command' || name === 'run_in_terminal') {
    return matchDangerous(String(args.command ?? ''))
  }
  if (name === 'run_runbook') {
    const rbName = String(args.name ?? '')
    const rb = listRunbooks().find((r) => r.name.toLowerCase() === rbName.toLowerCase())
    if (!rb) return null
    let params: Record<string, string> = {}
    if (args.params_json) {
      try {
        const p = JSON.parse(String(args.params_json))
        if (p && typeof p === 'object') {
          params = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)]))
        }
      } catch {
        /* params เสีย — ตรวจ step ดิบไปก่อน */
      }
    }
    for (const step of rb.steps) {
      const reason = matchDangerous(fillTemplate(step.command, params))
      if (reason) return reason
    }
    return null
  }
  return null
}

export interface ToolContext {
  sessionId: string | null
  signal?: AbortSignal
}

/**
 * cwd ของ AI ต่อ session — run_command แต่ละครั้งเป็น shell ใหม่ เลยต้องจำเองว่าอยู่ที่ไหน
 * เริ่มจาก cwd จริงของ terminal (local) ไม่งั้น home · คงอยู่ข้ามรอบสนทนาจนกว่า session จะปิด
 */
const agentCwds = new Map<string, string | null>()

export async function agentCwd(sessionId: string): Promise<string | null> {
  if (agentCwds.has(sessionId)) return agentCwds.get(sessionId) ?? null
  const handle = getSessionHandle(sessionId)
  const cwd = handle?.getCwd ? await handle.getCwd().catch(() => null) : null
  agentCwds.set(sessionId, cwd)
  return cwd
}

/** ผลยาวเกิน → เก็บหัว+ท้าย (error มักอยู่ท้าย) */
function clip(text: string, max: number): string {
  if (text.length <= max) return text
  const head = Math.floor(max * 0.3)
  return `${text.slice(0, head)}\n…[${text.length - max} chars truncated]…\n${text.slice(-(max - head))}`
}

/** เรียกใช้ tool จริง (ฝั่ง main) */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  switch (name) {
    case 'run_command': {
      if (!ctx.sessionId) {
        return 'Error: no active terminal session. Ask the user to open a session first.'
      }
      const command = String(args.command ?? '')
      if (!command) return 'Error: empty command'
      const res = await execInSession(ctx.sessionId, command, 'ai', {
        cwd: await agentCwd(ctx.sessionId)
      })
      agentCwds.set(ctx.sessionId, res.cwd)
      return `exit_code=${res.exitCode}${res.cwd ? `\ncwd=${res.cwd}` : ''}\n${clip(res.output, 8000)}`
    }
    case 'run_in_terminal': {
      if (!ctx.sessionId) {
        return 'Error: no active terminal session. Ask the user to open a session first.'
      }
      const command = String(args.command ?? '')
      if (!command) return 'Error: empty command'
      const res = await runInTerminalCapture(ctx.sessionId, command, { signal: ctx.signal })
      const out = clip(terminalText(res.output).trim(), 6000)
      return `${
        res.settled
          ? 'Command sent to the interactive terminal; output went quiet.'
          : 'Command sent to the interactive terminal; it may still be running or waiting for user input.'
      }\nTerminal output:\n${out || '(no output)'}`
    }
    case 'list_servers': {
      const servers = listServers().map((s) => ({
        id: s.id,
        name: s.name,
        host: s.host,
        username: s.username,
        group: s.groupName
      }))
      return JSON.stringify(servers)
    }
    case 'get_session_info': {
      if (!ctx.sessionId) return 'No active session'
      const s = getSession(ctx.sessionId)
      return JSON.stringify(s)
    }
    case 'search_command_history': {
      const results = searchCommands(String(args.query ?? ''))
      return JSON.stringify(
        results.map((c) => ({ command: c.command, exitCode: c.exitCode, ranAt: c.ranAt }))
      )
    }
    case 'save_knowledge': {
      const title = String(args.title ?? '').trim()
      const content = String(args.content ?? '').trim()
      if (!title || !content) return 'Error: title and content are required'
      const tags = Array.isArray(args.tags) ? args.tags.map(String) : []
      const serverId = ctx.sessionId ? (getSession(ctx.sessionId)?.serverId ?? null) : null
      const rec = saveKnowledge({ title, content, tags, serverId, source: 'ai' })
      // แจ้ง renderer ให้โชว์ toast
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send(IPC.knowledgeSaved, rec.title)
      }
      return `Saved to knowledge base: "${rec.title}"`
    }
    case 'search_knowledge': {
      const serverId = ctx.sessionId ? (getSession(ctx.sessionId)?.serverId ?? null) : null
      const results = searchKnowledge(String(args.query ?? ''), { serverId })
      return JSON.stringify(results.map((k) => ({ title: k.title, content: k.content, tags: k.tags })))
    }
    case 'list_runbooks': {
      const rbs = listRunbooks().map((r) => ({
        name: r.name,
        description: r.description,
        steps: r.steps.map((s) => s.command),
        params: extractPlaceholdersAll(r.steps.map((s) => s.command))
      }))
      return JSON.stringify(rbs)
    }
    case 'run_runbook': {
      if (!ctx.sessionId) {
        return 'Error: no active terminal session. Ask the user to open a session first.'
      }
      const name = String(args.name ?? '')
      const rb = listRunbooks().find((r) => r.name.toLowerCase() === name.toLowerCase())
      if (!rb) return `Error: runbook "${name}" not found. Use list_runbooks to see available runbooks.`
      let params: Record<string, string> = {}
      if (args.params_json) {
        try {
          const parsed = JSON.parse(String(args.params_json))
          if (parsed && typeof parsed === 'object') {
            params = Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v)]))
          }
        } catch {
          return 'Error: params_json is not valid JSON'
        }
      }
      const needed = extractPlaceholdersAll(rb.steps.map((s) => s.command))
      const missing = needed.filter((n) => !params[n])
      if (missing.length) {
        return `Error: runbook "${rb.name}" needs values for {{${missing.join('}}, {{')}}}. Provide them in params_json.`
      }
      for (const step of rb.steps) runInTerminal(ctx.sessionId, fillTemplate(step.command, params))
      return `Ran runbook "${rb.name}" (${rb.steps.length} steps) in the terminal. Verify the result with a quick run_command if needed.`
    }
    default:
      return `Error: unknown tool ${name}`
  }
}
