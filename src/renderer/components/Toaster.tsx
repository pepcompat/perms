import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { useToast, type ToastType } from '../store/useToast'
import { cn } from '../lib/utils'

const ICON: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info
}

const COLOR: Record<ToastType, string> = {
  success: 'text-[hsl(var(--success))]',
  error: 'text-destructive',
  info: 'text-primary'
}

export default function Toaster(): JSX.Element {
  const { toasts, dismiss } = useToast()

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex flex-col items-end gap-2">
      {toasts.map((t) => {
        const Icon = ICON[t.type]
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex min-w-[220px] max-w-sm animate-slide-up items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-2xl"
          >
            <Icon className={cn('size-4 shrink-0', COLOR[t.type])} />
            <span className="flex-1 text-sm">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
