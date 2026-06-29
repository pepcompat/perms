import { Component, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
  /** ข้อความ/ปุ่ม fallback แบบกะทัดรัด (สำหรับ pane เดียว) */
  compact?: boolean
  /** reset เมื่อค่า key นี้เปลี่ยน (เช่น sessionId) */
  resetKey?: string | number
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidUpdate(prev: Props): void {
    // เปลี่ยน resetKey (เช่นเปิด session ใหม่) ให้เคลียร์ error
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  componentDidCatch(error: unknown): void {
    // log ไว้ดูใน devtools
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-background p-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/15">
            <AlertTriangle className="size-6 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-medium">เกิดข้อผิดพลาดในส่วนนี้</p>
            <p className="mt-1 max-w-md break-words font-mono text-xs text-muted-foreground">
              {this.state.error.message}
            </p>
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
          >
            <RotateCcw className="size-4" /> ลองใหม่
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
