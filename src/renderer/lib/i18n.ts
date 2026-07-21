import { create } from 'zustand'

export type Lang = 'th' | 'en'

/**
 * คำแปลอังกฤษ — ใช้ "ข้อความไทย" เป็น key (แบบ gettext)
 * ข้อดี: UI ไทยเดิมไม่เปลี่ยน และถ้าคำไหนยังไม่มีคำแปล จะ fallback เป็นไทยอัตโนมัติ
 */
const EN: Record<string, string> = {
  // ทั่วไป
  บันทึก: 'Save',
  ยกเลิก: 'Cancel',
  ลบ: 'Delete',
  แก้ไข: 'Edit',
  ปิด: 'Close',
  รีเฟรช: 'Refresh',
  ค้นหา: 'Search',
  'ค้นหา…': 'Search…',
  เริ่ม: 'Start',
  หยุด: 'Stop',
  รัน: 'Run',
  ดาวน์โหลด: 'Download',
  อัปโหลด: 'Upload',
  'สร้างใหม่': 'New',
  'เริ่มใช้งาน': 'Get started',
  'ยังไม่มี': 'None yet',
  'กำลังโหลด…': 'Loading…',

  // ServerList / ServerForm
  'เพิ่ม server': 'Add server',
  'ยังไม่มี server': 'No servers yet',
  'Local terminal': 'Local terminal',
  'Session history': 'Session history',
  Runbooks: 'Runbooks',
  Settings: 'Settings',
  'เชื่อมต่ออยู่': 'Connected',
  'ไม่ได้เชื่อมต่อ': 'Not connected',
  'คลิก: ไป tab ล่าสุด · ดับเบิลคลิก: เปิด tab ใหม่':
    'Click: go to latest tab · Double-click: open a new tab',
  'ดูว่ามีอะไรใหม่ (changelog)': 'See what’s new (changelog)',

  // Terminal toolbar / menu
  'ค้นหา (⌘F)': 'Search (⌘F)',
  'คัดลอกที่เลือก': 'Copy selection',
  'ล้างหน้าจอ': 'Clear screen',
  'ลดขนาดฟอนต์': 'Decrease font size',
  'เพิ่มขนาดฟอนต์': 'Increase font size',
  'ไฟล์ (SFTP)': 'Files (SFTP)',
  'จัดการ Docker containers': 'Manage Docker containers',
  'ถาม AI: ทำไมพัง / ช่วยแก้': 'Ask AI: what broke / help me fix it',
  'ส่งที่เลือกให้ AI': 'Send selection to AI',
  วาง: 'Paste',
  'เลือกทั้งหมด': 'Select all',
  'ก่อนหน้า (⇧⏎)': 'Previous (⇧⏎)',
  'ถัดไป (⏎)': 'Next (⏎)',
  'ปิด (Esc)': 'Close (Esc)',

  // SFTP
  'ไฟล์บนเซิร์ฟเวอร์ (SFTP)': 'Files on server (SFTP)',
  'ขึ้นบน': 'Up',
  'สร้างโฟลเดอร์': 'New folder',
  'ชื่อโฟลเดอร์ใหม่': 'New folder name',
  'โฟลเดอร์ว่าง': 'Empty folder',
  'แตกไฟล์ (unzip)': 'Extract (unzip)',
  'ดาวน์โหลดทั้งโฟลเดอร์ (บีบอัด)': 'Download whole folder (archived)',
  'บีบอัด': 'Compress',
  เลือก: 'Select',
  'ยกเลิกการเลือก': 'Clear selection',
  'ลบที่เลือก': 'Delete selected',
  'ชื่อไฟล์บีบอัด (ไม่ต้องใส่นามสกุล)': 'Archive name (no extension)',
  เสร็จ: 'Done',
  'ผิดพลาด': 'Error',

  // File editor
  'กรอกค่าก่อนรัน': 'Fill in values before running',
  'ยังไม่บันทึก': 'Unsaved changes',
  'บันทึกแล้ว': 'Saved',
  'บันทึกไม่สำเร็จ: ': 'Save failed: ',

  // Docker
  'Docker Containers': 'Docker Containers',
  'เริ่มทั้งชุด': 'Start whole stack',
  'หยุดทั้งชุด': 'Stop whole stack',
  'รีสตาร์ททั้งชุด': 'Restart whole stack',
  'รีสตาร์ท': 'Restart',
  'ดู logs': 'View logs',
  'เปิด terminal ใน container': 'Open a terminal in the container',
  'กลับไปรายการ': 'Back to list',
  'ไม่มี container': 'No containers',
  'แยกเดี่ยว': 'Standalone',
  'กำลังโหลด log…': 'Loading logs…',

  // AI sidebar
  'อนุมัติ': 'Approve',
  'ปฏิเสธ': 'Reject',
  'อนุมัติ & รัน': 'Approve & run',
  'AI ขออนุมัติรันคำสั่ง': 'The AI wants to run a command',
  'คำสั่งอันตราย — ต้องยืนยันก่อนรัน': 'Dangerous command — confirm before running',
  'แนะนำเฉยๆ': 'Suggest only',
  'อนุมัติก่อนรัน': 'Approve before running',
  'Agentic (รันเอง)': 'Agentic (runs itself)',
  'ขออนุมัติก่อนรันทุกคำสั่ง': 'Ask before running every command',
  'พิมพ์คำถามถึง AI… (รองรับ Markdown)': 'Ask the AI… (Markdown supported)',

  // Settings
  'AI Providers': 'AI Providers',
  'คลังความรู้': 'Knowledge base',
  'อัปเดต': 'Updates',
  'Provider เริ่มต้น': 'Default provider',
  'โหมด AI เริ่มต้น': 'Default AI mode',
  'ตรวจสอบอัปเดต': 'Check for updates',
  'เวอร์ชันปัจจุบัน': 'Current version',
  'ภาษา': 'Language',
  'ไทย': 'Thai',
  'อังกฤษ': 'English',
  'ตั้งค่าแล้ว': 'Configured',
  'ยังไม่ตั้ง': 'Not set',
  'เลือกหรือพิมพ์ชื่อโมเดล': 'Pick or type a model name',
  'เป็นเวอร์ชันล่าสุดแล้ว': 'You’re on the latest version',

  // Runbooks / knowledge
  'ชุดคำสั่งที่บันทึกไว้ใช้ซ้ำ': 'Saved command sets you can reuse',
  'ชื่อ runbook': 'Runbook name',
  'ยังไม่มี runbook': 'No runbooks yet',
  'ช่องกรอก': 'inputs',
  'คำสั่ง': 'commands',

  // WhatsNew
  'มีอะไรใหม่': 'What’s new',
  'บันทึกการเปลี่ยนแปลง': 'Changelog',

  // Update toast
  'อัปเดตพร้อมติดตั้ง': 'Update ready to install',
  'รีสตาร์ทเลย': 'Restart now',
  'ภายหลัง': 'Later'
}

interface LangState {
  lang: Lang
  setLang: (l: Lang) => void
}

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('ui.lang')
    if (saved === 'en' || saved === 'th') return saved
  } catch {
    /* localStorage ใช้ไม่ได้ — ใช้ค่า default */
  }
  return 'th'
}

export const useLang = create<LangState>((set) => ({
  lang: initialLang(),
  setLang: (lang) => {
    try {
      localStorage.setItem('ui.lang', lang)
    } catch {
      /* ข้าม */
    }
    set({ lang })
  }
}))

/** แปลข้อความตามภาษาปัจจุบัน (คีย์ = ข้อความไทย) */
export function translate(s: string, lang: Lang): string {
  return lang === 'en' ? (EN[s] ?? s) : s
}

/** hook สำหรับคอมโพเนนต์ — subscribe ภาษา แล้วคืนฟังก์ชันแปล */
export function useT(): (s: string) => string {
  const lang = useLang((s) => s.lang)
  return (s: string) => translate(s, lang)
}
