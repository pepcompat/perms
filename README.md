# AI Terminal

Desktop SSH/terminal manager พร้อม AI agent ในตัว — ใช้งาน offline บน Windows / macOS / Linux

## Stack

- **Electron + electron-vite + React + TypeScript + Tailwind**
- **xterm.js** — terminal UI
- **node-pty** — local shell · **ssh2** — remote (รองรับ password / private key / ssh-agent / jump host)
- **better-sqlite3** — local database · **safeStorage** — เข้ารหัส secret ด้วย OS keychain
- **OpenAI / Anthropic / Google** — AI agent (3 โหมด: แนะนำ / อนุมัติก่อนรัน / agentic)

## คุณสมบัติ

- บันทึก server สำหรับ SSH (host, port, user, auth, group, jump host, notes)
- Terminal ได้ทั้ง remote (SSH) และ local shell หลาย session พร้อมกัน (tabs)
- AI sidebar: ถาม AI ให้ช่วยดู/แก้ปัญหา server — รันคำสั่งผ่าน tool `run_command`
  - **แนะนำ** — AI เสนอคำสั่งเฉย ๆ ไม่รัน
  - **อนุมัติ** — AI ขอรัน แต่เด้งปุ่มให้กดอนุมัติก่อน
  - **Agentic** — AI รันเป็น loop เองจนจบงาน
- ใส่ API key ใน Settings (เข้ารหัสด้วย safeStorage — เปิดไฟล์ `.db` ตรง ๆ ไม่เห็นค่า)
- Session history (ประวัติคำสั่ง + output) และ Runbooks (ชุดคำสั่งใช้ซ้ำ)

## Dev

ใช้ **pnpm** (ดู `packageManager` ใน `package.json`)

```bash
pnpm install     # ติดตั้ง + rebuild native modules ให้ Electron อัตโนมัติ
pnpm dev         # เปิดแอปแบบ dev (HMR)
pnpm build       # build installer ของ OS ปัจจุบัน (.dmg / .exe / .AppImage)
```

> pnpm 10 บล็อก build script ของ dependency โดย default — โปรเจกต์นี้ allow ไว้แล้วใน
> `pnpm.onlyBuiltDependencies` (better-sqlite3, node-pty, cpu-features, ssh2, electron, esbuild)
> และตั้ง `node-linker=hoisted` ใน `.npmrc` เพื่อให้ native addon + electron-builder resolve ได้

### หมายเหตุ: native modules + Python ใหม่

`better-sqlite3` และ `node-pty` เป็น native addon ที่ build ด้วย `node-gyp` ซึ่ง
**ต้องการ `distutils`** — แต่ Python 3.12+ เอา `distutils` ออกจาก stdlib แล้ว
ถ้า `pnpm install` ขึ้น error `ModuleNotFoundError: No module named 'distutils'`
ให้สร้าง venv ที่มี `setuptools` (ซึ่ง vendor `distutils` ไว้) แล้วชี้ node-gyp ไปใช้:

```bash
python3 -m venv .gypvenv
.gypvenv/bin/pip install setuptools
npm_config_python="$PWD/.gypvenv/bin/python" pnpm install
```

## โครงสร้าง

```
src/
├─ main/        Electron main = local backend (db, ssh, terminal, ai, secrets, ipc)
├─ preload/     contextBridge → window.api (type-safe)
├─ renderer/    React UI (ServerList, Terminal, AISidebar, Settings, History, Runbooks)
└─ shared/      types + ipc channel constants (ใช้ร่วม main↔renderer)
```

DB tables: `servers`, `secrets`, `sessions`, `commands`, `ai_history`, `runbooks`, `settings`
(เก็บที่ `app.getPath('userData')/perms.db`)
