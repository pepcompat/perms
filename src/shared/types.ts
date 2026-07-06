// Type ที่ใช้ร่วมกันระหว่าง main process และ renderer

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
    }
  | { type: 'done' }
  | { type: 'error'; message: string }
