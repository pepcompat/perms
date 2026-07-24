import { useState } from 'react'
import { Coffee } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { logoUrl } from '../lib/logo'
import { useT } from '../lib/i18n'

const BMC_URL = 'https://buymeacoffee.com/nongskyper'

/**
 * ปุ่มเลี้ยงกาแฟ — คลิกเปิดลิงก์ในเบราว์เซอร์ · hover เห็น QR ให้สแกนจากมือถือ
 * QR generate ในเครื่อง (แอป offline โหลดรูปจากเน็ตไม่ได้)
 */
export default function SupportButton({ compact = false }: { compact?: boolean }): JSX.Element {
  const t = useT()
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {compact ? (
        <button
          onClick={() => window.api.openExternal(BMC_URL)}
          className="no-drag flex size-7 items-center justify-center rounded-lg text-[#e6b800] transition-colors hover:bg-[#FFDD00]/15"
        >
          <Coffee className="size-4" />
        </button>
      ) : (
        <button
          onClick={() => window.api.openExternal(BMC_URL)}
          className="no-drag flex items-center gap-1.5 rounded-full border border-[#FFDD00]/40 bg-[#FFDD00]/10 px-2.5 py-1 text-xs font-medium text-[#e6b800] transition-colors hover:bg-[#FFDD00]/20"
        >
          <Coffee className="size-3.5" />
          {t('เลี้ยงกาแฟ')}
        </button>
      )}

      {hovered && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 animate-fade-in rounded-xl border border-border bg-popover p-3 shadow-2xl">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-xs font-medium">{t('ถ้าชอบ Perms เลี้ยงกาแฟกันได้นะ ☕')}</p>
            <div className="rounded-lg bg-white p-2">
              <QRCodeSVG
                value={BMC_URL}
                size={140}
                level="M"
                imageSettings={{ src: logoUrl, height: 30, width: 30, excavate: true }}
              />
            </div>
            <p className="break-all font-mono text-[10px] text-muted-foreground">
              buymeacoffee.com/nongskyper
            </p>
            <p className="text-[10px] text-muted-foreground">{t('สแกน หรือคลิกปุ่มเพื่อเปิดลิงก์')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
