import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

// เทสต์เฉพาะ logic แบบ pure (ไม่พึ่ง electron/native module) — รันบน node ล้วน
export default defineConfig({
  // เทสรันนอก electron-vite เลยไม่ได้ alias จาก electron.vite.config.ts มาด้วย
  // ต้องประกาศซ้ำตรงนี้ ไม่งั้น import '@shared/...' ที่ไม่ใช่ type-only จะหาไฟล์ไม่เจอ
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
})
