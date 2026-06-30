import { BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { ToolSchema } from './providers/types'
import { execInSession } from '../terminal/session-manager'
import { listServers } from '../db/repos/servers-repo'
import { getSession, searchCommands } from '../db/repos/sessions-repo'
import { saveKnowledge, searchKnowledge } from '../db/repos/knowledge-repo'

export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: 'run_command',
    description:
      'Run a shell command in the currently active terminal session (SSH or local) and return its stdout/stderr and exit code. Use for inspecting and operating the server.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to execute' }
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
  }
]

/** ชื่อ tool ที่ "ต้องขออนุมัติ" ในโหมด approve และ "ห้ามรัน" ในโหมด suggest */
export const MUTATING_TOOLS = new Set(['run_command'])

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
    default:
      return `Error: unknown tool ${name}`
  }
}
