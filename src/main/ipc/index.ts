import { ipcMain } from 'electron'
import { nanoid } from 'nanoid'
import { IPC } from '@shared/ipc-channels'
import type { ServerInput, OpenSessionInput, AiChatInput, AiProvider, AiMode, RunbookStep } from '@shared/types'

import {
  listServers,
  getServer,
  createServer,
  updateServer,
  deleteServer
} from '../db/repos/servers-repo'
import {
  listSessions,
  listCommands,
  recentCommands,
  recordCommand
} from '../db/repos/sessions-repo'
import { listRunbooks, saveRunbook, deleteRunbook } from '../db/repos/runbooks-repo'
import {
  getAppSettings,
  setAiKey,
  clearAiKey,
  updateAiSettings
} from '../db/repos/settings-repo'
import { listMessages } from '../db/repos/ai-repo'
import { testConnection } from '../ssh/connect'
import {
  openSession,
  writeSession,
  resizeSession,
  closeSession
} from '../terminal/session-manager'
import { runChat, resolveApproval, cancelRequest } from '../ai/agent'

export function registerIpc(): void {
  // ---- servers ----
  ipcMain.handle(IPC.serversList, () => listServers())
  ipcMain.handle(IPC.serversGet, (_e, id: string) => getServer(id))
  ipcMain.handle(IPC.serversCreate, (_e, input: ServerInput) => createServer(input))
  ipcMain.handle(IPC.serversUpdate, (_e, id: string, input: ServerInput) =>
    updateServer(id, input)
  )
  ipcMain.handle(IPC.serversDelete, (_e, id: string) => deleteServer(id))
  ipcMain.handle(IPC.serversTest, (_e, id: string) => testConnection(id))

  // ---- terminal ----
  ipcMain.handle(IPC.terminalOpen, (_e, input: OpenSessionInput) => openSession(input))
  ipcMain.on(IPC.terminalWrite, (_e, id: string, data: string) => writeSession(id, data))
  ipcMain.on(IPC.terminalResize, (_e, id: string, cols: number, rows: number) =>
    resizeSession(id, cols, rows)
  )
  ipcMain.on(IPC.terminalClose, (_e, id: string) => closeSession(id))

  // ---- sessions / history ----
  ipcMain.handle(IPC.sessionsList, () => listSessions())
  ipcMain.handle(IPC.sessionCommands, (_e, sessionId: string) => listCommands(sessionId))
  ipcMain.handle(IPC.sessionRecentCommands, () => recentCommands())
  ipcMain.on(IPC.sessionRecordCommand, (_e, sessionId: string, command: string) => {
    if (command.trim()) recordCommand(sessionId, command.trim(), 'user')
  })

  // ---- ai ----
  ipcMain.handle(IPC.aiChat, (_e, input: AiChatInput) => {
    const requestId = nanoid()
    // ไม่ await — สตรีมผ่าน event channel แทน
    void runChat(requestId, input)
    return requestId
  })
  ipcMain.on(IPC.aiApprove, (_e, callId: string, approved: boolean) =>
    resolveApproval(callId, approved)
  )
  ipcMain.on(IPC.aiCancel, (_e, requestId: string) => cancelRequest(requestId))
  ipcMain.handle(IPC.aiHistory, (_e, sessionId: string | null) => listMessages(sessionId))

  // ---- runbooks ----
  ipcMain.handle(IPC.runbooksList, () => listRunbooks())
  ipcMain.handle(
    IPC.runbooksSave,
    (
      _e,
      input: { id?: string | null; name: string; description?: string | null; steps: RunbookStep[] }
    ) => saveRunbook(input)
  )
  ipcMain.handle(IPC.runbooksDelete, (_e, id: string) => deleteRunbook(id))

  // ---- settings ----
  ipcMain.handle(IPC.settingsGet, () => getAppSettings())
  ipcMain.handle(IPC.settingsSetAiKey, (_e, provider: AiProvider, apiKey: string) => {
    setAiKey(provider, apiKey)
    return getAppSettings()
  })
  ipcMain.handle(IPC.settingsClearAiKey, (_e, provider: AiProvider) => {
    clearAiKey(provider)
    return getAppSettings()
  })
  ipcMain.handle(
    IPC.settingsUpdateAi,
    (
      _e,
      patch: {
        defaultProvider?: AiProvider
        defaultMode?: AiMode
        models?: Partial<Record<AiProvider, string>>
      }
    ) => {
      updateAiSettings(patch)
      return getAppSettings()
    }
  )
}
