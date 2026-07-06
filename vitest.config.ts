import { defineConfig } from 'vitest/config'

// เทสต์เฉพาะ logic แบบ pure (ไม่พึ่ง electron/native module) — รันบน node ล้วน
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
})
