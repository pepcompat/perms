import { useMemo } from 'react'
import { diffLines, diffStat, toHunks } from '@shared/diff'
import { useT } from '../lib/i18n'

/**
 * แสดงความต่างแบบรวมคอลัมน์ (unified) — เขียว = เพิ่ม, แดง = ลบ
 * ยุบช่วงที่เหมือนกันยาว ๆ ทิ้ง เหลือ context รอบจุดที่เปลี่ยน
 */
export default function DiffView({
  before,
  after,
  className = ''
}: {
  before: string
  after: string
  className?: string
}): JSX.Element {
  const t = useT()
  const { hunks, stat } = useMemo(() => {
    const lines = diffLines(before, after)
    return { hunks: toHunks(lines, 3), stat: diffStat(lines) }
  }, [before, after])

  if (!stat.changed) {
    return (
      <div className={`flex items-center justify-center p-6 text-sm text-muted-foreground ${className}`}>
        {t('เนื้อหาเหมือนกันทุกประการ')}
      </div>
    )
  }

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-1.5 text-xs">
        <span className="text-emerald-400">+{stat.added}</span>
        <span className="text-red-400">−{stat.removed}</span>
        <span className="text-muted-foreground">{t('บรรทัด')}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto font-mono text-xs leading-relaxed">
        {hunks.map((h, hi) => (
          <div key={hi}>
            {h.skippedBefore > 0 && (
              <div className="bg-secondary/40 px-3 py-1 text-center text-[11px] text-muted-foreground">
                ⋯ {t('ซ่อน')} {h.skippedBefore} {t('บรรทัดที่เหมือนกัน')}
              </div>
            )}
            {h.lines.map((l, i) => (
              <div
                key={i}
                className={`flex ${
                  l.op === 'add'
                    ? 'bg-emerald-500/10'
                    : l.op === 'del'
                      ? 'bg-red-500/10'
                      : ''
                }`}
              >
                <span className="w-10 shrink-0 select-none px-1 text-right text-muted-foreground/60">
                  {l.aLine ?? ''}
                </span>
                <span className="w-10 shrink-0 select-none px-1 text-right text-muted-foreground/60">
                  {l.bLine ?? ''}
                </span>
                <span
                  className={`w-4 shrink-0 select-none text-center ${
                    l.op === 'add'
                      ? 'text-emerald-400'
                      : l.op === 'del'
                        ? 'text-red-400'
                        : 'text-transparent'
                  }`}
                >
                  {l.op === 'add' ? '+' : l.op === 'del' ? '−' : ' '}
                </span>
                <span className="whitespace-pre-wrap break-all pr-3">{l.text || ' '}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
