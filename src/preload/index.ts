import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type {
  ServerRecord,
  ServerInput,
  OpenSessionInput,
  OpenSessionResult,
  SessionRecord,
  CommandRecord,
  AiChatInput,
  AiStreamEvent,
  AiMessageRecord,
  AiProvider,
  AiMode,
  RunbookRecord,
  RunbookStep,
  AppSettings
} from '../shared/types'

const api = {
  platform: process.platform,

  servers: {
    list: (): Promise<ServerRecord[]> => ipcRenderer.invoke(IPC.serversList),
    get: (id: string): Promise<ServerRecord | null> => ipcRenderer.invoke(IPC.serversGet, id),
    create: (input: ServerInput): Promise<ServerRecord> =>
      ipcRenderer.invoke(IPC.serversCreate, input),
    update: (id: string, input: ServerInput): Promise<ServerRecord> =>
      ipcRenderer.invoke(IPC.serversUpdate, id, input),
    remove: (id: string): Promise<void> => ipcRenderer.invoke(IPC.serversDelete, id),
    test: (id: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.serversTest, id)
  },

  terminal: {
    open: (input: OpenSessionInput): Promise<OpenSessionResult> =>
      ipcRenderer.invoke(IPC.terminalOpen, input),
    write: (id: string, data: string): void => ipcRenderer.send(IPC.terminalWrite, id, data),
    resize: (id: string, cols: number, rows: number): void =>
      ipcRenderer.send(IPC.terminalResize, id, cols, rows),
    close: (id: string): void => ipcRenderer.send(IPC.terminalClose, id),
    onData: (id: string, cb: (data: string) => void): (() => void) => {
      const ch = IPC.terminalDataPrefix + id
      const listener = (_e: unknown, data: string): void => cb(data)
      ipcRenderer.on(ch, listener)
      return () => ipcRenderer.removeListener(ch, listener)
    },
    onExit: (id: string, cb: (code: number | null) => void): (() => void) => {
      const ch = IPC.terminalExitPrefix + id
      const listener = (_e: unknown, code: number | null): void => cb(code)
      ipcRenderer.on(ch, listener)
      return () => ipcRenderer.removeListener(ch, listener)
    }
  },

  sessions: {
    list: (): Promise<SessionRecord[]> => ipcRenderer.invoke(IPC.sessionsList),
    commands: (sessionId: string): Promise<CommandRecord[]> =>
      ipcRenderer.invoke(IPC.sessionCommands, sessionId)
  },

  ai: {
    chat: (input: AiChatInput): Promise<string> => ipcRenderer.invoke(IPC.aiChat, input),
    approve: (callId: string, approved: boolean): void =>
      ipcRenderer.send(IPC.aiApprove, callId, approved),
    cancel: (requestId: string): void => ipcRenderer.send(IPC.aiCancel, requestId),
    history: (sessionId: string | null): Promise<AiMessageRecord[]> =>
      ipcRenderer.invoke(IPC.aiHistory, sessionId),
    onStream: (requestId: string, cb: (event: AiStreamEvent) => void): (() => void) => {
      const ch = IPC.aiStreamPrefix + requestId
      const listener = (_e: unknown, event: AiStreamEvent): void => cb(event)
      ipcRenderer.on(ch, listener)
      return () => ipcRenderer.removeListener(ch, listener)
    }
  },

  runbooks: {
    list: (): Promise<RunbookRecord[]> => ipcRenderer.invoke(IPC.runbooksList),
    save: (input: {
      id?: string | null
      name: string
      description?: string | null
      steps: RunbookStep[]
    }): Promise<RunbookRecord> => ipcRenderer.invoke(IPC.runbooksSave, input),
    remove: (id: string): Promise<void> => ipcRenderer.invoke(IPC.runbooksDelete, id)
  },

  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.settingsGet),
    setAiKey: (provider: AiProvider, apiKey: string): Promise<AppSettings> =>
      ipcRenderer.invoke(IPC.settingsSetAiKey, provider, apiKey),
    clearAiKey: (provider: AiProvider): Promise<AppSettings> =>
      ipcRenderer.invoke(IPC.settingsClearAiKey, provider),
    updateAi: (patch: {
      defaultProvider?: AiProvider
      defaultMode?: AiMode
      models?: Partial<Record<AiProvider, string>>
    }): Promise<AppSettings> => ipcRenderer.invoke(IPC.settingsUpdateAi, patch)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
