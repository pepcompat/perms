// บันทึกสิ่งที่เปลี่ยนแต่ละเวอร์ชัน (ใหม่สุดอยู่บน) — ใช้โชว์ modal "มีอะไรใหม่" หลังอัปเดต
export interface ChangelogEntry {
  version: string
  title: string
  items: { icon: string; text: string }[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.3.0',
    title: 'รับส่งไฟล์ SFTP + ผู้ช่วย AI ฉลาดและปลอดภัยขึ้น',
    items: [
      {
        icon: '📁',
        text: 'SFTP: เปิด/อัปโหลด/ดาวน์โหลดไฟล์บนเซิร์ฟเวอร์ พร้อมแถบความคืบหน้า — กดปุ่มโฟลเดอร์บน toolbar ของ terminal SSH'
      },
      {
        icon: '✨',
        text: '“ถาม AI ว่าทำไมพัง” คลิกเดียว — ส่งคำสั่ง + ผลลัพธ์ล่าสุดให้ AI ช่วยหาสาเหตุและวิธีแก้'
      },
      {
        icon: '🔒',
        text: 'กรองความลับ (API key / password / token) อัตโนมัติก่อนส่งข้อความให้ AI'
      },
      {
        icon: '🛡️',
        text: 'โหมด Agentic จะถามยืนยันก่อนรันคำสั่งอันตราย (rm -rf, mkfs, dd, ฯลฯ)'
      },
      { icon: '📐', text: 'การ์ด server กระชับขึ้น และจัดกลุ่มให้เห็นลำดับชั้นชัดเจนขึ้น' }
    ]
  },
  {
    version: '1.2.1',
    title: 'แก้ไอคอนแอปใน Dock',
    items: [
      { icon: '🎨', text: 'ไอคอนแอปใน Dock (macOS) ไม่ใหญ่เกินอีกต่อไป — ปรับขนาดตามสเปกของ Apple' }
    ]
  },
  {
    version: '1.2.0',
    title: 'จัดกลุ่ม + อัปเดตอัตโนมัติ',
    items: [
      { icon: '🗂️', text: 'ลากจัดลำดับกลุ่ม server ได้' },
      { icon: '🔄', text: 'ตรวจอัปเดตอัตโนมัติทุก 30 นาที + ปุ่มตรวจเองใน Settings' },
      { icon: '👻', text: 'คำแนะนำคำสั่งแบบ inline (กด Tab รับ) และโฟกัส console อัตโนมัติเมื่อเปิด session' }
    ]
  },
  {
    version: '1.1.1',
    title: 'Terminal เจอทุกคำสั่งเหมือนปกติ',
    items: [
      {
        icon: '🐳',
        text: 'local terminal หา docker / brew / node (nvm) เจอแล้ว — เปิดเป็น login shell ได้ PATH ครบเหมือน Terminal จริง'
      }
    ]
  },
  {
    version: '1.1.0',
    title: 'Runbook แบบมีช่องกรอก + ปรับ AI ต่อ session',
    items: [
      { icon: '🧩', text: 'Runbook ใส่ตัวแปร {{param}} ได้ พอรันมีฟอร์มให้กรอก + จำค่าล่าสุด' },
      { icon: '🖱️', text: 'คลิก server ครั้งเดียว = ไป tab ล่าสุด · ดับเบิลคลิก = เปิด tab ใหม่' },
      { icon: '🤖', text: 'AI จำ mode/provider/model แยกต่อ session และรู้ว่าอยู่ local หรือ SSH ตั้งแต่เปิด' },
      { icon: '🔗', text: 'คลิกลิงก์ใน output เปิดด้วย browser ได้' }
    ]
  },
  {
    version: '1.0.0',
    title: 'เปิดตัว Perms',
    items: [
      {
        icon: '🔐',
        text: 'จัดการ SSH server ครบทุกวิธี auth (password / private key / agent / jump host) + จัดกลุ่มได้'
      },
      { icon: '🖥️', text: 'Terminal ทั้ง local และ SSH เปิดพร้อมกันหลาย tab' },
      {
        icon: '🤖',
        text: 'AI agent ในตัว (OpenAI / Anthropic / Google) 3 โหมด: แนะนำ · อนุมัติก่อนรัน · agentic'
      },
      { icon: '📚', text: 'คลังความรู้ (AI จำสิ่งที่สอน) + Runbooks + ประวัติคำสั่ง' },
      {
        icon: '🔒',
        text: 'เก็บ API key/ความลับเข้ารหัสในเครื่องด้วย Keychain · ทำงาน offline ข้อมูลอยู่ในเครื่องล้วน'
      }
    ]
  }
]

function cmpSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d !== 0) return d > 0 ? 1 : -1
  }
  return 0
}

/**
 * entry ที่ควรโชว์: ถ้าไม่มี changelog ของ current → ไม่โชว์
 * ถ้ายังไม่เคยเห็น version ใด (lastSeen=null) → โชว์เฉพาะ current
 * ถ้าเคยเห็นแล้ว → โชว์ทุก version ที่ใหม่กว่า lastSeen และไม่เกิน current
 */
export function whatsNewFor(lastSeen: string | null, current: string): ChangelogEntry[] {
  if (!CHANGELOG.some((e) => e.version === current)) return []
  if (!lastSeen) return CHANGELOG.filter((e) => e.version === current)
  if (lastSeen === current) return []
  return CHANGELOG.filter(
    (e) => cmpSemver(e.version, lastSeen) > 0 && cmpSemver(e.version, current) <= 0
  )
}
