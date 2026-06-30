import { app, BrowserWindow, ipcMain } from 'electron'
import pkg from 'electron-updater'
import { IPC } from '@shared/ipc-channels'

const { autoUpdater } = pkg

function broadcast(channel: string, payload?: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

let initialized = false

export function initAutoUpdate(): void {
  if (initialized) return
  initialized = true

  // ดาวน์โหลดเองอัตโนมัติ แล้วค่อยเด้ง alert ให้ restart
  autoUpdater.autoDownload = true
  // ถ้า user ยังไม่ restart ให้ติดตั้งตอนปิดแอปครั้งถัดไป
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    broadcast(IPC.updateAvailable, info.version)
  })
  autoUpdater.on('download-progress', (p) => {
    broadcast(IPC.updateProgress, {
      percent: p.percent,
      bytesPerSecond: p.bytesPerSecond,
      transferred: p.transferred,
      total: p.total
    })
  })
  autoUpdater.on('update-downloaded', (info) => {
    broadcast(IPC.updateDownloaded, info.version)
  })
  autoUpdater.on('error', (err) => {
    broadcast(IPC.updateError, err == null ? 'unknown' : (err.message ?? String(err)))
  })

  // renderer สั่ง restart เพื่อติดตั้ง
  ipcMain.on(IPC.updateRestart, () => {
    // ปิดเฉพาะเพื่อให้ updater เข้ามาแทนที่ไฟล์ แล้วเปิดใหม่
    setImmediate(() => autoUpdater.quitAndInstall())
  })

  // ให้ renderer สั่งเช็คเองได้ (เช่นปุ่ม "Check for updates")
  ipcMain.handle(IPC.updateCheck, async () => {
    if (!app.isPackaged) return { ok: false, reason: 'dev' }
    try {
      const r = await autoUpdater.checkForUpdates()
      return { ok: true, version: r?.updateInfo.version }
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : String(e) }
    }
  })

  // เช็คตอนเปิดแอป (เฉพาะ build จริง — dev ไม่มี updater)
  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch(() => {
      /* ออฟไลน์/ยังไม่มี release ก็เงียบไว้ */
    })
  }
}
