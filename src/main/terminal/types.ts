import type { SessionKind } from '@shared/types'

export interface ExecResult {
  output: string
  exitCode: number | null
}

/** อินเทอร์เฟซกลางที่ทั้ง SSH และ local PTY ต้องทำได้เหมือนกัน */
export interface TermSession {
  readonly id: string
  readonly kind: SessionKind
  write(data: string): void
  resize(cols: number, rows: number): void
  onData(cb: (data: string) => void): void
  onExit(cb: (code: number | null) => void): void
  /** รันคำสั่งแบบ one-off เพื่อเก็บ output (ใช้โดย AI agent) */
  exec(command: string): Promise<ExecResult>
  dispose(): void
}
