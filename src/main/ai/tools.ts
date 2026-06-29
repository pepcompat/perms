import type { ToolSchema } from './providers/types'
import { execInSession } from '../terminal/session-manager'
import { listServers } from '../db/repos/servers-repo'
import { getSession, searchCommands } from '../db/repos/sessions-repo'

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
    default:
      return `Error: unknown tool ${name}`
  }
}
