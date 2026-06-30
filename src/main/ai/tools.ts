import { BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { ToolSchema } from './providers/types'
import { execInSession, runInTerminal } from '../terminal/session-manager'
import { listServers } from '../db/repos/servers-repo'
import { getSession, searchCommands } from '../db/repos/sessions-repo'
import { saveKnowledge, searchKnowledge } from '../db/repos/knowledge-repo'
import { listRunbooks } from '../db/repos/runbooks-repo'

export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: 'run_command',
    description:
      'Run a NON-INTERACTIVE shell command and get its stdout/stderr + exit code back. Runs in a fresh non-TTY shell each time (state like cd/env does NOT persist). Use for quick inspection/diagnostics (ls, df, systemctl status, cat, grep). Do NOT use for interactive programs that prompt for input or need a TTY — use run_in_terminal for those.',
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
      "Type a command into the user's REAL interactive terminal (with a TTY) so it runs live and the user can see it and respond to any prompts. Use for: interactive installers that ask y/n (e.g. apt install, bash install scripts), TUI apps (vim, htop, top, less), long-running/streaming processes, or command sequences that need persistent shell state (cd, export, source). NOTE: you do NOT get the output back — the user watches it. After it likely finishes, you can run a quick read-only run_command to verify the result.",
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
      "Run a saved runbook by name — types its commands into the user's interactive terminal in order. Use when a matching runbook exists for the task.",
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: 'The runbook name' } },
      required: ['name']
    }
  }
]

/** ชื่อ tool ที่ "ต้องขออนุมัติ" ในโหมด approve และ "ห้ามรัน" ในโหมด suggest */
export const MUTATING_TOOLS = new Set(['run_command', 'run_in_terminal', 'run_runbook'])

export interface ToolContext {
  sessionId: string | null
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
      const res = await execInSession(ctx.sessionId, command, 'ai')
      return `exit_code=${res.exitCode}\n${res.output.slice(0, 6000)}`
    }
    case 'run_in_terminal': {
      if (!ctx.sessionId) {
        return 'Error: no active terminal session. Ask the user to open a session first.'
      }
      const command = String(args.command ?? '')
      if (!command) return 'Error: empty command'
      runInTerminal(ctx.sessionId, command)
      return 'Command sent to the interactive terminal. The user can see it and respond to any prompts. Output is not captured here — verify later with a quick run_command if needed.'
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
        steps: r.steps.map((s) => s.command)
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
      for (const step of rb.steps) runInTerminal(ctx.sessionId, step.command)
      return `Ran runbook "${rb.name}" (${rb.steps.length} steps) in the terminal. Verify the result with a quick run_command if needed.`
    }
    default:
      return `Error: unknown tool ${name}`
  }
}
