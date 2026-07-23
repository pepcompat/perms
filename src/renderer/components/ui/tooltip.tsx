import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '../../lib/utils'

const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 8, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={8}
      className={cn(
        'z-50 max-w-xs rounded-lg border border-border/80 bg-popover px-2.5 py-1.5',
        'text-[13px] font-medium leading-snug text-popover-foreground shadow-xl',
        'ring-1 ring-black/20 backdrop-blur-sm',
        'origin-[var(--radix-tooltip-content-transform-origin)]',
        'data-[state=delayed-open]:animate-tooltip-in data-[state=instant-open]:animate-tooltip-in',
        className
      )}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow
        width={11}
        height={5}
        className="fill-popover drop-shadow-[0_1px_0_hsl(var(--border))]"
      />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

/**
 * ทางลัดสำหรับกรณีที่ใช้บ่อยที่สุด: ครอบปุ่มหนึ่งตัวแล้วมีคำอธิบายโผล่
 *
 *   <Hint label="ค้นหา"><button>…</button></Hint>
 *
 * ใช้แทน title="" ของเบราว์เซอร์ ซึ่งรอ ~1 วินาทีกว่าจะขึ้น ตัวเล็ก
 * และแต่งหน้าตาไม่ได้เลย
 */
export function Hint({
  label,
  children,
  side = 'bottom',
  align = 'center',
  /** คีย์ลัด — โชว์เป็น kbd ต่อท้ายคำอธิบาย */
  keys,
  disabled = false,
  delay,
  ...content
}: {
  label: React.ReactNode
  children: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  keys?: string
  disabled?: boolean
  /** หน่วงก่อนแสดง (ms) — ใส่ค่าสูงกับพื้นที่ใหญ่ ๆ กันเด้งรัวตอนเลื่อนเมาส์ผ่าน */
  delay?: number
} & Omit<React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>, 'children'>): JSX.Element {
  if (disabled || !label) return <>{children}</>
  return (
    <Tooltip delayDuration={delay}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align} {...content}>
        <span className="flex items-center gap-1.5">
          {label}
          {keys && (
            <kbd className="rounded border border-border/70 bg-black/25 px-1 py-px font-mono text-[11px] font-normal text-muted-foreground">
              {keys}
            </kbd>
          )}
        </span>
      </TooltipContent>
    </Tooltip>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
