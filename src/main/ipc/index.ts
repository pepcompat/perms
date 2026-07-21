import { ipcMain, shell, app, dialog, BrowserWindow } from 'electron'
import { nanoid } from 'nanoid'
import { basename } from 'path'
import { IPC } from '@shared/ipc-channels'
import type {
  ServerInput,
  OpenSessionInput,
  AiChatInput,
  AiProvider,
  AiMode,
  RunbookStep,
  KnowledgeInput,
  SftpProgress
} from '@shared/types'

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
  commandStats,
  recordCommand
} from '../db/repos/sessions-repo'
import { listRunbooks, saveRunbook, deleteRunbook } from '../db/repos/runbooks-repo'
import {
  listKnowledge,
  saveKnowledge,
  deleteKnowledge,
  searchKnowledge
} from '../db/repos/knowledge-repo'
import {
  getAppSettings,
  setAiKey,
  clearAiKey,
  updateAiSettings
} from '../db/repos/settings-repo'
import { listMessages } from '../db/repos/ai-repo'
import { testConnection } from '../ssh/connect'
import { listPrivateKeys, pickKeyFile } from '../ssh/keys'
import {
  openSession,
  writeSession,
  resizeSession,
  closeSession
} from '../terminal/session-manager'
import {
  sftpHome,
  sftpList,
  sftpMkdir,
  sftpDelete,
  sftpRename,
  sftpDownload,
  sftpUpload,
  sftpReadFile,
  sftpWriteFile,
  sftpArchive,
  sftpExtract,
  sftpRemoveRemote,
  remoteJoin
} from '../terminal/sftp'
import { dockerList, dockerAction, dockerLogs } from '../docker'
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
  // เปิด URL ด้วย default browser (เฉพาะ http/https — กัน scheme อันตรายจาก output)
  ipcMain.on(IPC.shellOpenExternal, (_e, url: string) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
  })
  ipcMain.handle(IPC.appVersion, () => app.getVersion())

  ipcMain.handle(IPC.sshListKeys, () => listPrivateKeys())
  ipcMain.handle(IPC.sshPickKey, () => pickKeyFile())

  // ---- sftp ----
  const emitSftp = (p: SftpProgress): void => {
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.sftpProgress, p)
  }
  const activeWindow = (): BrowserWindow | undefined =>
    BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]

  ipcMain.handle(IPC.sftpHome, (_e, sessionId: string) => sftpHome(sessionId))
  ipcMain.handle(IPC.sftpList, (_e, sessionId: string, path: string) => sftpList(sessionId, path))
  ipcMain.handle(IPC.sftpMkdir, (_e, sessionId: string, path: string) => sftpMkdir(sessionId, path))
  ipcMain.handle(IPC.sftpDelete, (_e, sessionId: string, path: string, isDir: boolean) =>
    sftpDelete(sessionId, path, isDir)
  )
  ipcMain.handle(IPC.sftpRename, (_e, sessionId: string, from: string, to: string) =>
    sftpRename(sessionId, from, to)
  )
  ipcMain.handle(IPC.sftpRead, (_e, sessionId: string, path: string) =>
    sftpReadFile(sessionId, path)
  )
  ipcMain.handle(
    IPC.sftpWrite,
    (_e, sessionId: string, path: string, content: string, mode: number, expectedMtime: number | null) =>
      sftpWriteFile(sessionId, path, content, mode, expectedMtime)
  )

  // บีบอัดในที่เดิม (ปุ่ม zip)
  ipcMain.handle(
    IPC.sftpArchive,
    (_e, sessionId: string, dir: string, names: string[], base: string) =>
      sftpArchive(sessionId, dir, names, dir, base)
  )
  ipcMain.handle(IPC.sftpExtract, (_e, sessionId: string, dir: string, name: string) =>
    sftpExtract(sessionId, dir, name)
  )

  // ดาวน์โหลดหลายไฟล์/ทั้งโฟลเดอร์ → บีบอัดที่ /tmp แล้วโหลด แล้วลบไฟล์ชั่วคราว
  ipcMain.handle(
    IPC.sftpDownloadArchive,
    async (_e, sessionId: string, dir: string, names: string[]) => {
      const win = activeWindow()
      if (!win) return { ok: false, error: 'no window' }
      const base = `perms-${nanoid(6)}`
      let archive: { path: string; name: string }
      try {
        archive = await sftpArchive(sessionId, dir, names, '/tmp', base)
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
      const ext = archive.name.slice(base.length)
      const suggested = (names.length === 1 ? names[0] : basename(dir) || 'download') + ext
      const res = await dialog.showSaveDialog(win, { defaultPath: suggested })
      if (res.canceled || !res.filePath) {
        await sftpRemoveRemote(sessionId, archive.path)
        return { canceled: true }
      }
      const transferId = nanoid()
      try {
        await sftpDownload(sessionId, archive.path, res.filePath, (transferred, total) =>
          emitSftp({ transferId, name: suggested, direction: 'down', transferred, total })
        )
        emitSftp({ transferId, name: suggested, direction: 'down', transferred: 1, total: 1, done: true })
        return { ok: true, savedTo: res.filePath }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        emitSftp({ transferId, name: suggested, direction: 'down', transferred: 0, total: 1, done: true, error })
        return { ok: false, error }
      } finally {
        await sftpRemoveRemote(sessionId, archive.path)
      }
    }
  )

  // ---- docker ----
  ipcMain.handle(IPC.dockerList, (_e, sessionId: string) => dockerList(sessionId))
  ipcMain.handle(IPC.dockerAction, (_e, sessionId: string, action: string, id: string) =>
    dockerAction(sessionId, action, id)
  )
  ipcMain.handle(IPC.dockerLogs, (_e, sessionId: string, id: string) => dockerLogs(sessionId, id))

  ipcMain.handle(
    IPC.sftpDownload,
    async (_e, sessionId: string, remotePath: string, name: string) => {
      const win = activeWindow()
      if (!win) return { ok: false, error: 'no window' }
      const res = await dialog.showSaveDialog(win, { defaultPath: name })
      if (res.canceled || !res.filePath) return { canceled: true }
      const transferId = nanoid()
      try {
        await sftpDownload(sessionId, remotePath, res.filePath, (transferred, total) =>
          emitSftp({ transferId, name, direction: 'down', transferred, total })
        )
        emitSftp({ transferId, name, direction: 'down', transferred: 1, total: 1, done: true })
        return { ok: true, savedTo: res.filePath }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        emitSftp({ transferId, name, direction: 'down', transferred: 0, total: 1, done: true, error })
        return { ok: false, error }
      }
    }
  )

  ipcMain.handle(IPC.sftpUpload, async (_e, sessionId: string, remoteDir: string) => {
    const win = activeWindow()
    if (!win) return { ok: false, error: 'no window' }
    const res = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections']
    })
    if (res.canceled || res.filePaths.length === 0) return { canceled: true }
    let count = 0
    for (const local of res.filePaths) {
      const name = basename(local)
      const transferId = nanoid()
      try {
        await sftpUpload(sessionId, local, remoteJoin(remoteDir, name), (transferred, total) =>
          emitSftp({ transferId, name, direction: 'up', transferred, total })
        )
        emitSftp({ transferId, name, direction: 'up', transferred: 1, total: 1, done: true })
        count++
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        emitSftp({ transferId, name, direction: 'up', transferred: 0, total: 1, done: true, error })
      }
    }
    return { ok: true, count }
  })

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
  ipcMain.handle(IPC.sessionCommandStats, (_e, serverId: string | null) => commandStats(serverId))
  ipcMain.on(IPC.sessionRecordCommand, (_e, sessionId: string, command: string) => {
    try {
      if (command.trim()) recordCommand(sessionId, command.trim(), 'user')
    } catch {
      /* session อาจปิดไปแล้ว — ไม่ต้องล้มแอป */
    }
  })

  // ---- ai ----
  ipcMain.handle(IPC.aiChat, (_e, input: AiChatInput) => {
    // ใช้ requestId จาก renderer ถ้ามี (renderer subscribe ก่อนแล้ว → ไม่พลาด event แรก)
    const requestId = input.requestId || nanoid()
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

  // ---- knowledge ----
  ipcMain.handle(IPC.knowledgeList, () => listKnowledge())
  ipcMain.handle(IPC.knowledgeSave, (_e, input: KnowledgeInput) => saveKnowledge(input))
  ipcMain.handle(IPC.knowledgeDelete, (_e, id: string) => deleteKnowledge(id))
  ipcMain.handle(IPC.knowledgeSearch, (_e, query: string) => searchKnowledge(query))

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
