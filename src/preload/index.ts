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
  KnowledgeRecord,
  KnowledgeInput,
  AppSettings,
  UpdateProgress
} from '../shared/types'

const api = {
  platform: process.platform,

  openExternal: (url: string): void => ipcRenderer.send(IPC.shellOpenExternal, url),

  appVersion: (): Promise<string> => ipcRenderer.invoke(IPC.appVersion),

  onFullscreen: (cb: (isFullscreen: boolean) => void): (() => void) => {
    const listener = (_e: unknown, v: boolean): void => cb(v)
    ipcRenderer.on(IPC.windowFullscreen, listener)
    return () => ipcRenderer.removeListener(IPC.windowFullscreen, listener)
  },

  servers: {
    list: (): Promise<ServerRecord[]> => ipcRenderer.invoke(IPC.serversList),
    get: (id: string): Promise<ServerRecord | null> => ipcRenderer.invoke(IPC.serversGet, id),
    create: (input: ServerInput): Promise<ServerRecord> =>
      ipcRenderer.invoke(IPC.serversCreate, input),
    update: (id: string, input: ServerInput): Promise<ServerRecord> =>
      ipcRenderer.invoke(IPC.serversUpdate, id, input),
    remove: (id: string): Promise<void> => ipcRenderer.invoke(IPC.serversDelete, id),
    test: (id: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.serversTest, id),
    listKeys: (): Promise<string[]> => ipcRenderer.invoke(IPC.sshListKeys),
    pickKey: (): Promise<string | null> => ipcRenderer.invoke(IPC.sshPickKey)
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
      ipcRenderer.invoke(IPC.sessionCommands, sessionId),
    recentCommands: (): Promise<string[]> => ipcRenderer.invoke(IPC.sessionRecentCommands),
    recordCommand: (sessionId: string, command: string): void =>
      ipcRenderer.send(IPC.sessionRecordCommand, sessionId, command)
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

  knowledge: {
    list: (): Promise<KnowledgeRecord[]> => ipcRenderer.invoke(IPC.knowledgeList),
    save: (input: KnowledgeInput): Promise<KnowledgeRecord> =>
      ipcRenderer.invoke(IPC.knowledgeSave, input),
    remove: (id: string): Promise<void> => ipcRenderer.invoke(IPC.knowledgeDelete, id),
    search: (query: string): Promise<KnowledgeRecord[]> =>
      ipcRenderer.invoke(IPC.knowledgeSearch, query)
  },

  onKnowledgeSaved: (cb: (title: string) => void): (() => void) => {
    const listener = (_e: unknown, title: string): void => cb(title)
    ipcRenderer.on(IPC.knowledgeSaved, listener)
    return () => ipcRenderer.removeListener(IPC.knowledgeSaved, listener)
  },

  updates: {
    check: (): Promise<{
      ok: boolean
      version?: string
      currentVersion?: string
      updateAvailable?: boolean
      reason?: string
    }> => ipcRenderer.invoke(IPC.updateCheck),
    restart: (): void => ipcRenderer.send(IPC.updateRestart),
    onAvailable: (cb: (version: string) => void): (() => void) => {
      const listener = (_e: unknown, v: string): void => cb(v)
      ipcRenderer.on(IPC.updateAvailable, listener)
      return () => ipcRenderer.removeListener(IPC.updateAvailable, listener)
    },
    onProgress: (cb: (p: UpdateProgress) => void): (() => void) => {
      const listener = (_e: unknown, p: UpdateProgress): void => cb(p)
      ipcRenderer.on(IPC.updateProgress, listener)
      return () => ipcRenderer.removeListener(IPC.updateProgress, listener)
    },
    onDownloaded: (cb: (version: string) => void): (() => void) => {
      const listener = (_e: unknown, v: string): void => cb(v)
      ipcRenderer.on(IPC.updateDownloaded, listener)
      return () => ipcRenderer.removeListener(IPC.updateDownloaded, listener)
    },
    onError: (cb: (message: string) => void): (() => void) => {
      const listener = (_e: unknown, m: string): void => cb(m)
      ipcRenderer.on(IPC.updateError, listener)
      return () => ipcRenderer.removeListener(IPC.updateError, listener)
    }
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
