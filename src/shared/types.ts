// Type ที่ใช้ร่วมกันระหว่าง main process และ renderer

import type { PayloadPreview } from './ai-guard'
import type { HostKeyVerdict } from './host-key'

export type AuthType = 'password' | 'key' | 'agent'
export type SessionKind = 'ssh' | 'local'
export type AiProvider = 'openai' | 'anthropic' | 'google'
export type AiMode = 'suggest' | 'approve' | 'agentic'
export type CommandSource = 'user' | 'ai'

/** ข้อมูล server ที่เก็บใน DB (ไม่มี secret ดิบ) */
export interface ServerRecord {
  id: string
  name: string
  host: string
  port: number
  username: string
  authType: AuthType
  /** มี secret เก็บไว้หรือไม่ (password / passphrase / private key) */
  hasSecret: boolean
  privateKeyPath: string | null
  jumpHostId: string | null
  groupName: string | null
  color: string | null
  notes: string | null
  createdAt: number
  updatedAt: number
}

/** payload สำหรับสร้าง/แก้ไข server — secret ส่งมาเป็น plaintext ครั้งเดียวแล้วถูกเข้ารหัส */
export interface ServerInput {
  name: string
  host: string
  port: number
  username: string
  authType: AuthType
  /** password หรือ passphrase ของ key (plaintext, optional ถ้าไม่เปลี่ยน) */
  secret?: string | null
  /** เนื้อหา private key (plaintext, optional) */
  privateKey?: string | null
  privateKeyPath?: string | null
  jumpHostId?: string | null
  groupName?: string | null
  color?: string | null
  notes?: string | null
}

export interface SessionRecord {
  id: string
  serverId: string | null
  kind: SessionKind
  startedAt: number
  endedAt: number | null
  status: 'active' | 'closed' | 'error'
  title: string
}

export interface CommandRecord {
  id: string
  sessionId: string
  command: string
  exitCode: number | null
  outputPreview: string | null
  ranAt: number
  source: CommandSource
}

export interface AiMessageRecord {
  id: string
  sessionId: string | null
  provider: AiProvider
  model: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  toolCalls: AiToolCall[] | null
  createdAt: number
}

export interface AiToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
  result?: string
}

export interface RunbookStep {
  command: string
  description?: string
}

export interface RunbookRecord {
  id: string
  name: string
  description: string | null
  steps: RunbookStep[]
  createdAt: number
  updatedAt: number
}

export interface KnowledgeRecord {
  id: string
  title: string
  content: string
  tags: string[]
  serverId: string | null
  source: 'ai' | 'user'
  useCount: number
  createdAt: number
  updatedAt: number
}

export interface KnowledgeInput {
  id?: string | null
  title: string
  content: string
  tags?: string[]
  serverId?: string | null
  source?: 'ai' | 'user'
}

export interface AiSettings {
  defaultProvider: AiProvider
  defaultMode: AiMode
  models: Record<AiProvider, string>
  /** provider ไหนตั้ง API key ไว้แล้วบ้าง (ไม่คืนค่า key จริง) */
  configured: Record<AiProvider, boolean>
}

export interface AppSettings {
  ai: AiSettings
  theme: string
  encryptionAvailable: boolean
}

// ---- payload สำหรับ terminal ----
export interface OpenSessionInput {
  /** ถ้ามี serverId = เปิด SSH, ถ้าไม่มี = local shell */
  serverId?: string | null
  cols: number
  rows: number
  /** override shell สำหรับ local */
  shell?: string | null
}

export interface OpenSessionResult {
  sessionId: string
  kind: SessionKind
  title: string
}

// ---- payload สำหรับ AI chat ----
export interface AiChatInput {
  sessionId: string | null
  provider?: AiProvider
  model?: string
  mode?: AiMode
  message: string
  /** renderer สร้าง id เองเพื่อ subscribe stream ก่อนเริ่มงาน (กัน event หาย) */
  requestId?: string
  /** เปิด web search (provider-native) — ถูกบังคับปิดในโหมด agentic */
  webSearch?: boolean
}

// ---- auto-update ----
export interface UpdateProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

/** รายการไฟล์/โฟลเดอร์จาก SFTP */
export interface SftpEntry {
  name: string
  type: 'dir' | 'file' | 'link'
  size: number
  /** epoch ms */
  mtime: number
}

/** Docker container บนเซิร์ฟเวอร์ (จาก `docker ps -a`) */
export interface DockerContainer {
  id: string
  name: string
  image: string
  status: string
  /** running | exited | created | paused | restarting | dead */
  state: string
  ports: string
  created: string
  /** compose project (label com.docker.compose.project) — ว่าง = ไม่ได้อยู่ใน compose */
  project: string
  /** compose service (label com.docker.compose.service) */
  service: string
}

/** เนื้อหาไฟล์ที่อ่านมาแก้ (SFTP) */
export interface SftpFileContent {
  content: string
  /** สิทธิ์ไฟล์เดิม (เก็บไว้เขียนกลับให้เหมือนเดิม) */
  mode: number
  /** epoch ms — ใช้ตรวจว่าไฟล์ถูกแก้บนเซิร์ฟเวอร์ระหว่างเปิดอยู่ไหม */
  mtime: number
  size: number
}

/** progress การถ่ายโอนไฟล์ SFTP (main→renderer) */
export interface SftpProgress {
  transferId: string
  name: string
  direction: 'up' | 'down'
  transferred: number
  total: number
  done?: boolean
  error?: string
}

/** event ที่ stream กลับมาระหว่าง AI ทำงาน */
export type AiStreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; call: AiToolCall }
  | { type: 'tool_result'; callId: string; result: string }
  | {
      type: 'approval_request'
      callId: string
      command: string
      sessionId: string | null
      /** ถ้าตั้ง = คำสั่งเข้าข่ายอันตราย (บังคับอนุมัติแม้ agentic) พร้อมเหตุผล */
      danger?: string | null
      /** รายละเอียดเต็มของสิ่งที่จะรัน — ให้ผู้ใช้ตรวจก่อนกดอนุมัติ */
      preview?: PayloadPreview
    }
  | {
      /** guard บล็อคคำสั่งนี้ก่อนถึงมือผู้ใช้ (เช่นตรง deny pattern / เกินโควตา) */
      type: 'guard_blocked'
      callId: string
      command: string
      reasons: string[]
    }
  | { type: 'done' }
  | { type: 'error'; message: string }

/** คำขอยืนยัน host key (main→renderer) */
export interface HostKeyPrompt {
  id: string
  host: string
  port: number
  serverName: string
  keyType: string
  fingerprint: string
  verdict: HostKeyVerdict
  /** ลายนิ้วมือเดิมที่เคยยอมรับไว้ — มีค่าเฉพาะกรณี changed */
  previousFingerprint: string | null
  previousKeyType: string | null
}

/** session ที่ยังเปิดอยู่จริงใน main — ใช้สร้าง tab กลับหลัง refresh */
export interface LiveSession {
  sessionId: string
  kind: SessionKind
  title: string
  serverId: string | null
  openedAt: number
}

/** host key ที่เคยยอมรับไว้แล้ว */
export interface KnownHostRecord {
  id: string
  host: string
  port: number
  keyType: string
  fingerprint: string
  firstSeen: number
  lastSeen: number
}

/** สำเนาไฟล์ก่อนถูกเขียนทับ */
export interface FileSnapshot {
  id: string
  serverId: string | null
  path: string
  content: string
  size: number
  mode: number | null
  reason: 'save' | 'rollback' | 'manual'
  createdAt: number
}

/** รายการ snapshot แบบไม่เอาเนื้อหา (ใช้โชว์ list ไม่ต้องโหลดทั้งไฟล์) */
export type FileSnapshotMeta = Omit<FileSnapshot, 'content'>

/** service ของ systemd (parse มาจาก systemctl list-units) */
export interface SystemdUnit {
  unit: string
  load: string
  active: string
  sub: string
  description: string
}

/** บรรทัด log จาก journalctl */
export interface JournalLine {
  time: string
  host: string
  source: string
  message: string
}

/** อุโมงค์ SSH ที่เปิดค้างไว้ */
export interface TunnelInfo {
  id: string
  sessionId: string
  type: 'local' | 'remote'
  /** พอร์ตฝั่งที่เปิดรับ (local สำหรับ type=local, บนเซิร์ฟเวอร์สำหรับ type=remote) */
  listenPort: number
  destHost: string
  destPort: number
  status: 'open' | 'error'
  error?: string
  /** จำนวนการเชื่อมต่อที่ผ่านอุโมงค์นี้ */
  connections: number
  createdAt: number
}
