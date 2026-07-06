import { app, shell, BrowserWindow, nativeImage } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { IPC } from '@shared/ipc-channels'
import { getDb, closeDb } from './db'
import { registerIpc } from './ipc'
import { disposeAll } from './terminal/session-manager'
import { initAutoUpdate } from './updater'

// icon แอปสำหรับ dock/หน้าต่างตอน dev — ใช้ build/icon.png ที่มี padding แบบ macOS แล้ว
// (ห้ามใช้ public/images/perms-logo.png ที่เต็มขอบ ไม่งั้น dock icon จะดูใหญ่กว่า app อื่น)
// prod ใช้ .icns ของ bundle ที่ electron-builder สร้างจากไฟล์เดียวกัน
const ICON_PATH = join(__dirname, '../../build/icon.png')

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0c0c10',
    icon: existsSync(ICON_PATH) ? ICON_PATH : undefined,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())

  // แจ้ง renderer เรื่อง fullscreen (บน mac จะได้เอา inset ของ traffic-light ออก)
  const sendFullscreen = (): void => {
    if (!win.isDestroyed()) win.webContents.send(IPC.windowFullscreen, win.isFullScreen())
  }
  win.on('enter-full-screen', sendFullscreen)
  win.on('leave-full-screen', sendFullscreen)
  win.webContents.on('did-finish-load', sendFullscreen)

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // electron-vite: dev ใช้ renderer dev server, prod โหลดไฟล์ build
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // dock icon บน macOS ตอน dev (prod ใช้ icns ของ bundle)
  if (process.platform === 'darwin' && app.dock && existsSync(ICON_PATH)) {
    app.dock.setIcon(nativeImage.createFromPath(ICON_PATH))
  }
  getDb() // เปิด DB + รัน migration
  registerIpc()
  createWindow()
  initAutoUpdate()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  disposeAll()
  closeDb()
})
