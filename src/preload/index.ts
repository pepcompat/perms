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
  UpdateProgress,
  SftpEntry,
  SftpProgress,
  SftpFileContent,
  DockerContainer,
  FileSnapshot,
  FileSnapshotMeta,
  HostKeyPrompt,
  TunnelInfo,
  SystemdUnit,
  JournalLine,
  KnownHostRecord,
  LiveSession
} from '../shared/types'
import type { TransferItem } from '../shared/transfer-queue'
import type { GuardPolicy } from '../shared/ai-guard'

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
    /** session ที่ยังเปิดอยู่ใน main — ใช้สร้าง tab กลับหลัง refresh */
    list: (): Promise<LiveSession[]> => ipcRenderer.invoke(IPC.terminalList),
    /** output ล่าสุดของ session (เล่นซ้ำตอนต่อกลับ) */
    replay: (id: string): Promise<string> => ipcRenderer.invoke(IPC.terminalReplay, id),
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

  sftp: {
    home: (sessionId: string): Promise<string> => ipcRenderer.invoke(IPC.sftpHome, sessionId),
    list: (sessionId: string, path: string): Promise<{ path: string; entries: SftpEntry[] }> =>
      ipcRenderer.invoke(IPC.sftpList, sessionId, path),
    mkdir: (sessionId: string, path: string): Promise<void> =>
      ipcRenderer.invoke(IPC.sftpMkdir, sessionId, path),
    remove: (sessionId: string, path: string, isDir: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC.sftpDelete, sessionId, path, isDir),
    rename: (sessionId: string, from: string, to: string): Promise<void> =>
      ipcRenderer.invoke(IPC.sftpRename, sessionId, from, to),
    download: (
      sessionId: string,
      remotePath: string,
      name: string
    ): Promise<{ ok?: boolean; canceled?: boolean; savedTo?: string; error?: string }> =>
      ipcRenderer.invoke(IPC.sftpDownload, sessionId, remotePath, name),
    upload: (
      sessionId: string,
      remoteDir: string
    ): Promise<{ ok?: boolean; canceled?: boolean; count?: number; error?: string }> =>
      ipcRenderer.invoke(IPC.sftpUpload, sessionId, remoteDir),
    read: (sessionId: string, path: string): Promise<SftpFileContent> =>
      ipcRenderer.invoke(IPC.sftpRead, sessionId, path),
    write: (
      sessionId: string,
      path: string,
      content: string,
      mode: number,
      expectedMtime: number | null
    ): Promise<{ mtime: number }> =>
      ipcRenderer.invoke(IPC.sftpWrite, sessionId, path, content, mode, expectedMtime),
    archive: (
      sessionId: string,
      dir: string,
      names: string[],
      base: string
    ): Promise<{ path: string; name: string }> =>
      ipcRenderer.invoke(IPC.sftpArchive, sessionId, dir, names, base),
    extract: (sessionId: string, dir: string, name: string): Promise<void> =>
      ipcRenderer.invoke(IPC.sftpExtract, sessionId, dir, name),
    downloadArchive: (
      sessionId: string,
      dir: string,
      names: string[]
    ): Promise<{ ok?: boolean; canceled?: boolean; savedTo?: string; error?: string }> =>
      ipcRenderer.invoke(IPC.sftpDownloadArchive, sessionId, dir, names),
    onProgress: (cb: (p: SftpProgress) => void): (() => void) => {
      const listener = (_e: unknown, p: SftpProgress): void => cb(p)
      ipcRenderer.on(IPC.sftpProgress, listener)
      return () => ipcRenderer.removeListener(IPC.sftpProgress, listener)
    }
  },

  transfers: {
    enqueue: (input: {
      sessionId: string
      kind: 'upload' | 'download'
      remotePath: string
      localPath: string
    }): Promise<TransferItem> => ipcRenderer.invoke(IPC.transferEnqueue, input),
    list: (): Promise<TransferItem[]> => ipcRenderer.invoke(IPC.transferList),
    cancel: (id: string): Promise<void> => ipcRenderer.invoke(IPC.transferCancel, id),
    retry: (id: string): Promise<void> => ipcRenderer.invoke(IPC.transferRetry, id),
    clear: (): Promise<void> => ipcRenderer.invoke(IPC.transferClear),
    onUpdate: (cb: (items: TransferItem[]) => void): (() => void) => {
      const listener = (_e: unknown, items: TransferItem[]): void => cb(items)
      ipcRenderer.on(IPC.transferUpdate, listener)
      return () => ipcRenderer.removeListener(IPC.transferUpdate, listener)
    }
  },

  snapshots: {
    list: (serverId: string | null, path: string): Promise<FileSnapshotMeta[]> =>
      ipcRenderer.invoke(IPC.snapshotList, serverId, path),
    get: (id: string): Promise<FileSnapshot | null> => ipcRenderer.invoke(IPC.snapshotGet, id),
    remove: (id: string): Promise<void> => ipcRenderer.invoke(IPC.snapshotDelete, id)
  },

  hostKeys: {
    list: (): Promise<KnownHostRecord[]> => ipcRenderer.invoke(IPC.hostKeysList),
    forget: (id: string): Promise<void> => ipcRenderer.invoke(IPC.hostKeysForget, id),
    respond: (id: string, accepted: boolean): void =>
      ipcRenderer.send(IPC.hostKeyRespond, id, accepted),
    onPrompt: (cb: (p: HostKeyPrompt) => void): (() => void) => {
      const listener = (_e: unknown, p: HostKeyPrompt): void => cb(p)
      ipcRenderer.on(IPC.hostKeyPrompt, listener)
      return () => ipcRenderer.removeListener(IPC.hostKeyPrompt, listener)
    }
  },

  tunnels: {
    open: (input: {
      sessionId: string
      type: 'local' | 'remote'
      listenPort: number
      destHost: string
      destPort: number
    }): Promise<TunnelInfo> => ipcRenderer.invoke(IPC.tunnelOpen, input),
    close: (id: string): Promise<void> => ipcRenderer.invoke(IPC.tunnelClose, id),
    list: (sessionId?: string): Promise<TunnelInfo[]> =>
      ipcRenderer.invoke(IPC.tunnelList, sessionId),
    onUpdate: (cb: (items: TunnelInfo[]) => void): (() => void) => {
      const listener = (_e: unknown, items: TunnelInfo[]): void => cb(items)
      ipcRenderer.on(IPC.tunnelUpdate, listener)
      return () => ipcRenderer.removeListener(IPC.tunnelUpdate, listener)
    }
  },

  systemd: {
    has: (sessionId: string): Promise<boolean> => ipcRenderer.invoke(IPC.systemdHas, sessionId),
    list: (sessionId: string): Promise<SystemdUnit[]> =>
      ipcRenderer.invoke(IPC.systemdList, sessionId),
    action: (
      sessionId: string,
      unit: string,
      action: string
    ): Promise<{ ok: boolean; output: string }> =>
      ipcRenderer.invoke(IPC.systemdAction, sessionId, unit, action),
    status: (sessionId: string, unit: string): Promise<string> =>
      ipcRenderer.invoke(IPC.systemdStatus, sessionId, unit),
    logs: (sessionId: string, unit: string, lines?: number): Promise<JournalLine[]> =>
      ipcRenderer.invoke(IPC.systemdLogs, sessionId, unit, lines)
  },

  guard: {
    get: (): Promise<GuardPolicy> => ipcRenderer.invoke(IPC.guardGet),
    set: (policy: GuardPolicy): Promise<void> => ipcRenderer.invoke(IPC.guardSet, policy)
  },

  docker: {
    list: (
      sessionId: string
    ): Promise<{ available: boolean; containers: DockerContainer[] }> =>
      ipcRenderer.invoke(IPC.dockerList, sessionId),
    action: (
      sessionId: string,
      action: string,
      id: string
    ): Promise<{ ok: boolean; output: string }> =>
      ipcRenderer.invoke(IPC.dockerAction, sessionId, action, id),
    logs: (sessionId: string, id: string): Promise<string> =>
      ipcRenderer.invoke(IPC.dockerLogs, sessionId, id)
  },

  sessions: {
    list: (): Promise<SessionRecord[]> => ipcRenderer.invoke(IPC.sessionsList),
    commands: (sessionId: string): Promise<CommandRecord[]> =>
      ipcRenderer.invoke(IPC.sessionCommands, sessionId),
    recentCommands: (): Promise<string[]> => ipcRenderer.invoke(IPC.sessionRecentCommands),
    commandStats: (
      serverId: string | null
    ): Promise<{ command: string; count: number; lastRan: number; sameServer: number }[]> =>
      ipcRenderer.invoke(IPC.sessionCommandStats, serverId),
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
