// บันทึกสิ่งที่เปลี่ยนแต่ละเวอร์ชัน (ใหม่สุดอยู่บน) — ใช้โชว์ modal "มีอะไรใหม่" หลังอัปเดต
// เก็บ 2 ภาษาในตัว (text = ไทย, textEn = อังกฤษ) เพราะเป็นเนื้อหายาว ไม่เหมาะยัดใน dictionary ของ UI
// เพิ่มเวอร์ชันใหม่: ใส่ entry บนสุด และเขียนให้ครบทั้ง 2 ภาษา
import type { Lang } from './i18n'

export interface ChangelogItem {
  icon: string
  text: string
  textEn: string
}

export interface ChangelogEntry {
  version: string
  title: string
  titleEn: string
  items: ChangelogItem[]
}

/** เลือกข้อความตามภาษาที่ใช้อยู่ */
export function pickLang(th: string, en: string, lang: Lang): string {
  return lang === 'en' ? en || th : th
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.6.0',
    title: 'สลับภาษา ไทย/อังกฤษ + SFTP ทำงานเป็นชุดได้',
    titleEn: 'Thai/English switcher + batch SFTP',
    items: [
      {
        icon: '🌐',
        text: 'สลับภาษา ไทย ⇄ English ได้ทั้งโปรแกรมจาก Settings — รวมถึงหน้านี้ด้วย',
        textEn: 'Switch the whole app between Thai and English from Settings — including this page'
      },
      {
        icon: '🗜️',
        text: 'SFTP บีบอัด/แตกไฟล์บนเซิร์ฟเวอร์ได้ (zip · tar.gz · tgz · tar) โดยไม่ต้องพิมพ์คำสั่งเอง',
        textEn: 'Compress and extract archives on the server (zip · tar.gz · tgz · tar) without typing a command'
      },
      {
        icon: '📥',
        text: 'เลือกหลายไฟล์ดาวน์โหลดพร้อมกัน หรือดาวน์โหลดทั้งโฟลเดอร์ในครั้งเดียว',
        textEn: 'Select multiple files to download at once, or grab an entire folder in one go'
      },
      {
        icon: '🧠',
        text: 'คำแนะนำคำสั่งฉลาดขึ้น — เรียงตามความถี่ + ใช้ล่าสุด และดันคำสั่งของ server เครื่องนั้นขึ้นก่อน',
        textEn:
          'Smarter command suggestions — ranked by how often and how recently you use them, with this server’s own commands first'
      }
    ]
  },
  {
    version: '1.5.0',
    title: 'จัดการ Docker container บนเซิร์ฟเวอร์',
    titleEn: 'Manage Docker containers on your servers',
    items: [
      {
        icon: '🐳',
        text: 'พอต่อ SSH แล้วมี container จะมีปุ่ม Docker บน toolbar — กดเปิดหน้าจัดการ container ทั้งหมด',
        textEn:
          'When an SSH session has containers, a Docker button appears in the toolbar and opens a panel with all of them'
      },
      {
        icon: '🎛️',
        text: 'สั่ง เริ่ม / หยุด / รีสตาร์ท / ดู logs / ลบ container ได้ (ปุ่มมีสีตามการกระทำ)',
        textEn: 'Start / stop / restart / view logs / remove containers — each action colour-coded'
      },
      {
        icon: '💻',
        text: 'เปิด terminal เข้า container ได้เลย (docker exec) — เปิดเป็น tab ใหม่',
        textEn: 'Open a terminal inside a container (docker exec) in a new tab'
      },
      {
        icon: '📦',
        text: 'จัดกลุ่มตาม compose stack + สั่ง เริ่ม/หยุด/รีสตาร์ท ทั้งชุดทีเดียว',
        textEn: 'Containers grouped by compose stack, with start/stop/restart for the whole stack'
      }
    ]
  },
  {
    version: '1.4.0',
    title: 'แก้ไขไฟล์บนเซิร์ฟเวอร์ได้ในตัว',
    titleEn: 'Edit files on the server, in the app',
    items: [
      {
        icon: '📝',
        text: 'แก้ไฟล์บนเซิร์ฟเวอร์ (เช่น .env) ได้เลย — เปิดจาก SFTP (ดับเบิลคลิกไฟล์ หรือปุ่มดินสอ) แล้วบันทึกด้วย ⌘S',
        textEn:
          'Edit server files such as .env — open from SFTP (double-click or the pencil button) and save with ⌘S'
      },
      {
        icon: '🎨',
        text: 'Editor มี syntax highlight ตามชนิดไฟล์ (.env / .json / .yml / .sh / Dockerfile / nginx / …) และ ⌘Z ย้อน · ⇧⌘Z ทำซ้ำ',
        textEn:
          'Syntax highlighting by file type (.env / .json / .yml / .sh / Dockerfile / nginx / …) plus ⌘Z undo · ⇧⌘Z redo'
      },
      {
        icon: '🔒',
        text: 'บันทึกแบบปลอดภัย: atomic write (เน็ตหลุดไฟล์ไม่พัง) · คงสิทธิ์ไฟล์เดิม · เตือนถ้าไฟล์ถูกแก้ซ้อนบนเซิร์ฟเวอร์ · กันไฟล์ไบนารี/ใหญ่เกิน · ไม่ส่งเนื้อหาไป AI',
        textEn:
          'Safe saving: atomic writes (a dropped connection can’t corrupt the file) · original permissions kept · warns if the file changed on the server · blocks binary/oversized files · contents never sent to the AI'
      },
      {
        icon: '📜',
        text: 'กดเลขเวอร์ชันใต้ Settings เพื่อดู changelog ครบทุกเวอร์ชันในที่เดียว',
        textEn: 'Click the version number under Settings to read the full changelog in one place'
      }
    ]
  },
  {
    version: '1.3.0',
    title: 'รับส่งไฟล์ SFTP + ผู้ช่วย AI ฉลาดและปลอดภัยขึ้น',
    titleEn: 'SFTP file transfer + a smarter, safer AI assistant',
    items: [
      {
        icon: '📁',
        text: 'SFTP: เปิด/อัปโหลด/ดาวน์โหลดไฟล์บนเซิร์ฟเวอร์ พร้อมแถบความคืบหน้า — กดปุ่มโฟลเดอร์บน toolbar ของ terminal SSH',
        textEn:
          'SFTP: browse, upload and download server files with a progress bar — via the folder button in an SSH terminal’s toolbar'
      },
      {
        icon: '✨',
        text: '“ถาม AI ว่าทำไมพัง” คลิกเดียว — ส่งคำสั่ง + ผลลัพธ์ล่าสุดให้ AI ช่วยหาสาเหตุและวิธีแก้',
        textEn:
          '“Ask AI why it failed” in one click — sends the last command and its output for a diagnosis and a fix'
      },
      {
        icon: '🔒',
        text: 'กรองความลับ (API key / password / token) อัตโนมัติก่อนส่งข้อความให้ AI',
        textEn: 'Secrets (API keys / passwords / tokens) are redacted automatically before anything reaches the AI'
      },
      {
        icon: '🛡️',
        text: 'โหมด Agentic จะถามยืนยันก่อนรันคำสั่งอันตราย (rm -rf, mkfs, dd, ฯลฯ)',
        textEn: 'Agentic mode asks for confirmation before running destructive commands (rm -rf, mkfs, dd, …)'
      },
      {
        icon: '📐',
        text: 'การ์ด server กระชับขึ้น และจัดกลุ่มให้เห็นลำดับชั้นชัดเจนขึ้น',
        textEn: 'More compact server cards, with clearer group hierarchy'
      }
    ]
  },
  {
    version: '1.2.1',
    title: 'แก้ไอคอนแอปใน Dock',
    titleEn: 'Dock icon fix',
    items: [
      {
        icon: '🎨',
        text: 'ไอคอนแอปใน Dock (macOS) ไม่ใหญ่เกินอีกต่อไป — ปรับขนาดตามสเปกของ Apple',
        textEn: 'The macOS Dock icon is no longer oversized — resized to Apple’s icon grid'
      }
    ]
  },
  {
    version: '1.2.0',
    title: 'จัดกลุ่ม + อัปเดตอัตโนมัติ',
    titleEn: 'Grouping + automatic updates',
    items: [
      {
        icon: '🗂️',
        text: 'ลากจัดลำดับกลุ่ม server ได้',
        textEn: 'Drag to reorder server groups'
      },
      {
        icon: '🔄',
        text: 'ตรวจอัปเดตอัตโนมัติทุก 30 นาที + ปุ่มตรวจเองใน Settings',
        textEn: 'Checks for updates every 30 minutes, plus a manual check button in Settings'
      },
      {
        icon: '👻',
        text: 'คำแนะนำคำสั่งแบบ inline (กด Tab รับ) และโฟกัส console อัตโนมัติเมื่อเปิด session',
        textEn:
          'Inline command suggestions (press Tab to accept) and the console focuses itself when a session opens'
      }
    ]
  },
  {
    version: '1.1.1',
    title: 'Terminal เจอทุกคำสั่งเหมือนปกติ',
    titleEn: 'The terminal finds every command',
    items: [
      {
        icon: '🐳',
        text: 'local terminal หา docker / brew / node (nvm) เจอแล้ว — เปิดเป็น login shell ได้ PATH ครบเหมือน Terminal จริง',
        textEn:
          'Local terminals now find docker / brew / node (nvm) — they start as a login shell, so the PATH matches your real terminal'
      }
    ]
  },
  {
    version: '1.1.0',
    title: 'Runbook แบบมีช่องกรอก + ปรับ AI ต่อ session',
    titleEn: 'Runbooks with inputs + per-session AI settings',
    items: [
      {
        icon: '🧩',
        text: 'Runbook ใส่ตัวแปร {{param}} ได้ พอรันมีฟอร์มให้กรอก + จำค่าล่าสุด',
        textEn: 'Runbooks accept {{param}} placeholders — a form asks for the values and remembers the last ones'
      },
      {
        icon: '🖱️',
        text: 'คลิก server ครั้งเดียว = ไป tab ล่าสุด · ดับเบิลคลิก = เปิด tab ใหม่',
        textEn: 'Single-click a server to jump to its latest tab · double-click to open a new one'
      },
      {
        icon: '🤖',
        text: 'AI จำ mode/provider/model แยกต่อ session และรู้ว่าอยู่ local หรือ SSH ตั้งแต่เปิด',
        textEn:
          'The AI keeps mode/provider/model per session, and knows whether it is on a local or SSH session from the start'
      },
      {
        icon: '🔗',
        text: 'คลิกลิงก์ใน output เปิดด้วย browser ได้',
        textEn: 'Links in the output open in your browser'
      }
    ]
  },
  {
    version: '1.0.0',
    title: 'เปิดตัว Perms',
    titleEn: 'Introducing Perms',
    items: [
      {
        icon: '🔐',
        text: 'จัดการ SSH server ครบทุกวิธี auth (password / private key / agent / jump host) + จัดกลุ่มได้',
        textEn:
          'Manage SSH servers with every auth method (password / private key / agent / jump host), organised in groups'
      },
      {
        icon: '🖥️',
        text: 'Terminal ทั้ง local และ SSH เปิดพร้อมกันหลาย tab',
        textEn: 'Local and SSH terminals, several tabs at once'
      },
      {
        icon: '🤖',
        text: 'AI agent ในตัว (OpenAI / Anthropic / Google) 3 โหมด: แนะนำ · อนุมัติก่อนรัน · agentic',
        textEn:
          'Built-in AI agent (OpenAI / Anthropic / Google) in 3 modes: suggest · approve before running · agentic'
      },
      {
        icon: '📚',
        text: 'คลังความรู้ (AI จำสิ่งที่สอน) + Runbooks + ประวัติคำสั่ง',
        textEn: 'Knowledge base (the AI remembers what you teach it), runbooks and command history'
      },
      {
        icon: '🔒',
        text: 'เก็บ API key/ความลับเข้ารหัสในเครื่องด้วย Keychain · ทำงาน offline ข้อมูลอยู่ในเครื่องล้วน',
        textEn:
          'API keys and secrets encrypted locally with the system keychain · works offline, data never leaves your machine'
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
