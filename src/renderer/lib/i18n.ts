import { create } from 'zustand'

export type Lang = 'th' | 'en'

/**
 * คำแปลอังกฤษ — ใช้ "ข้อความไทย" เป็น key (แบบ gettext)
 * ข้อดี: UI ไทยเดิมไม่เปลี่ยน และถ้าคำไหนยังไม่มีคำแปล จะ fallback เป็นไทยอัตโนมัติ
 */
const EN: Record<string, string> = {
  // --- v1.8.0: ย่อ/ขยายแถบ, progress ในรายการไฟล์, เลือกทั้งหมด ---
  'เปิดแผง AI Agent': 'Show AI Agent panel',
  'ซ่อนแผง AI Agent': 'Hide AI Agent panel',
  'ทำงานอยู่': 'running',
  'ขยายแถบ server': 'Expand server bar',
  'ย่อแถบ server': 'Collapse server bar',
  'คัดลอก path แล้ว': 'Path copied',
  'คัดลอก path': 'Copy path',
  'ตรวจไฟล์ตรงกัน': 'checksum verified',
  'เสร็จแล้ว': 'finished',
  'ไม่สำเร็จ': 'failed',
  'เปิดอยู่': 'open',
  // --- v1.7.0: snapshot/diff, host key, guard, คิวโอนไฟล์, tunnel, systemd ---
  '(เว้นว่างถ้าไม่เปลี่ยน)': '(leave blank to keep unchanged)',
  'Local — เปิดพอร์ตในเครื่องเรา': 'Local — open a port on this machine',
  'Remote — เปิดพอร์ตบนเซิร์ฟเวอร์': 'Remote — open a port on the server',
  'กรอกค่าก่อนรัน': 'Fill in values before running',
  'การเชื่อมต่อ': 'connections',
  'กำลังถ่ายโอน': 'Transferring',
  'ก่อนบันทึก': 'before save',
  'ครั้งแรก': 'first time',
  'คัดลอก': 'Copy',
  'คัดลอกแล้ว': 'Copied',
  'คำสั่งไม่สำเร็จ': 'Command failed',
  'ค้นหา (⌘F)': 'Search (⌘F)',
  'ค้นหา service': 'Search services',
  'จัดการ service (systemd)': 'Manage services (systemd)',
  'จัดการ service บนเซิร์ฟเวอร์ และดู log จาก journalctl': 'Manage services on the server and read journalctl logs',
  'ฉันตรวจกับผู้ดูแลเซิร์ฟเวอร์แล้วว่าการเปลี่ยนแปลงนี้ถูกต้อง และยอมรับความเสี่ยง': 'I verified this change with the server administrator and accept the risk',
  'ชุดคำสั่งที่บันทึกไว้ใช้ซ้ำ': 'Saved command sets for reuse',
  'ซ่อน': 'hiding',
  'ดู log': 'View logs',
  'ตรวจได้จากเซิร์ฟเวอร์โดยตรงด้วยคำสั่ง': 'Verify on the server itself with',
  'ต้องระบุปลายทาง': 'A destination is required',
  'ถูกบล็อคโดยตัวกรอง': 'Blocked by the guard',
  'ถ่ายโอนเสร็จ': 'Transferred',
  'บรรทัด': 'lines',
  'บรรทัดที่เหมือนกัน': 'unchanged lines',
  'บันทึก': 'Save',
  'ประวัติ': 'History',
  'ประวัติเวอร์ชัน': 'Version history',
  'ปลายทาง (host)': 'Destination (host)',
  'ปลายทาง (พอร์ต)': 'Destination (port)',
  'ปลายทาง': 'Target',
  'ปิดอุโมงค์': 'Close tunnel',
  'พอร์ตบนเซิร์ฟเวอร์': 'Port on server',
  'พอร์ตในเครื่อง': 'Local port',
  'พอร์ตไม่ถูกต้อง': 'Invalid port',
  'มีอะไรใหม่': 'What\'s new',
  'ยกเลิกการเชื่อมต่อ': 'Cancel connection',
  'ยอมรับ key ใหม่': 'Accept new key',
  'ยอมรับและจำไว้': 'Accept and remember',
  'ยังไม่มีอุโมงค์ที่เปิดอยู่': 'No tunnels open yet',
  'ยังไม่มีเวอร์ชันเก่า — จะเก็บให้อัตโนมัติทุกครั้งที่บันทึก': 'No earlier versions yet — one is kept automatically on every save',
  'ยังไม่เคยเชื่อมต่อเครื่องนี้มาก่อน ตรวจลายนิ้วมือให้ตรงกับเซิร์ฟเวอร์จริงก่อนยอมรับ': 'You have never connected to this machine before. Check the fingerprint against the real server before accepting',
  'ยืนยันตัวตนเซิร์ฟเวอร์': 'Verify server identity',
  'ยืนยันหยุด service': 'Confirm stopping service',
  'ย้อนกลับ': 'Back',
  'ย้อนกลับมาเวอร์ชันนี้': 'Restore this version',
  'รอคิว': 'Queued',
  'ลองแล้ว': 'attempts',
  'ลายนิ้วมือ': 'Fingerprint',
  'ลายนิ้วมือเซิร์ฟเวอร์เปลี่ยนไป': 'Server fingerprint has changed',
  'ลายนิ้วมือเดิมที่เคยยอมรับ': 'Previously accepted fingerprint',
  'ลายนิ้วมือใหม่ที่ได้รับตอนนี้': 'Fingerprint received now',
  'ล้างรายการที่เสร็จแล้ว': 'Clear finished items',
  'สำเร็จ': 'succeeded',
  'ส่งต่อพอร์ตผ่านการเชื่อมต่อ SSH ที่เปิดอยู่ — เช่น ต่อฐานข้อมูลหลัง firewall จากเครื่องเรา': 'Forward a port over the open SSH connection — for example, reach a database behind a firewall from this machine',
  'ส่งเข้า AI': 'Send to AI',
  'อนุมัติ': 'Approve',
  'อัปเดตพร้อมติดตั้ง': 'Update ready to install',
  'อาจมีคนดักกลางทาง (MITM) หรือเซิร์ฟเวอร์ถูกติดตั้งใหม่ — อย่ายอมรับถ้าไม่แน่ใจ': 'Someone may be intercepting the connection (MITM), or the server was rebuilt — do not accept unless you are sure',
  'อุโมงค์ SSH (Port forward)': 'SSH tunnel (port forward)',
  'อุโมงค์ SSH (port forward)': 'SSH tunnel (port forward)',
  'เครื่องมือ': 'Tool',
  'เซิร์ฟเวอร์': 'Server',
  'เทียบ: เวอร์ชันเก่า → ที่กำลังแก้อยู่': 'Comparing: older version → what you are editing',
  'เนื้อหาเหมือนกันทุกประการ': 'The contents are identical',
  'เปลี่ยน': 'changed',
  'เปิดพอร์ตที่ 127.0.0.1 ในเครื่องเรา แล้ววิ่งผ่าน SSH ไปหาปลายทางที่มองเห็นจากเซิร์ฟเวอร์': 'Opens a port on 127.0.0.1 here and forwards it over SSH to a destination reachable from the server',
  'เปิดพอร์ตบนเซิร์ฟเวอร์ แล้ววิ่งกลับมาหาปลายทางที่มองเห็นจากเครื่องเรา': 'Opens a port on the server and forwards it back to a destination reachable from this machine',
  'เปิดอุโมงค์': 'Open tunnel',
  'เปิดอุโมงค์แล้ว': 'Tunnel opened',
  'เพิ่ม server': 'Add server',
  'เลือก server เพื่อเชื่อม SSH หรือเปิด local terminal': 'Pick a server to connect over SSH, or open a local terminal',
  'เลือกเวอร์ชันทางซ้ายเพื่อดูความต่าง': 'Pick a version on the left to see the differences',
  'เหตุผล': 'Reason',
  'แนะนำ': 'Suggest',
  'โหลดเวอร์ชันเก่าเข้ามาแล้ว — กดบันทึกเพื่อยืนยัน': 'Older version loaded — press Save to confirm',
  'ไฟล์บนเซิร์ฟเวอร์ (SFTP)': 'Server files (SFTP)',
  'ไม่พบ service': 'No services found',
  'ไม่มี log': 'No logs',
  // ทั่วไป
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
  'ยังไม่บันทึก': 'Unsaved changes',
  'บันทึกแล้ว': 'Saved',
  'บันทึกไม่สำเร็จ: ': 'Save failed: ',
  'บันทึกไม่สำเร็จ': 'Save failed',

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
  'ชื่อ runbook': 'Runbook name',
  'ยังไม่มี runbook': 'No runbooks yet',
  'ช่องกรอก': 'inputs',
  'คำสั่ง': 'commands',

  // WhatsNew
  'บันทึกการเปลี่ยนแปลง': 'Changelog',

  // Update toast
  'รีสตาร์ทเลย': 'Restart now',
  'ภายหลัง': 'Later',

  // --- เติมรอบแปลงทั้งแอป ---
  "(ไม่มี log)": "(no logs)",
  "Group ที่มีอยู่": "Existing groups",
  "Passphrase (ถ้ามี)": "Passphrase (if any)",
  "SSH keys ใน ~/.ssh": "SSH keys in ~/.ssh",
  "session ใช้งานอยู่": "active session",
  "tags คั่นด้วย , (เช่น nginx, deploy)": "tags separated by , (e.g. nginx, deploy)",
  "web search ปิดในโหมด agentic (กัน prompt injection)": "Web search is off in agentic mode (prevents prompt injection)",
  "web search รองรับเฉพาะ Anthropic / Google": "Web search only works with Anthropic / Google",
  "web search: ปิด": "Web search: off",
  "web search: เปิด": "Web search: on",
  "กด “Always Allow” ได้เลย": "just click “Always Allow”",
  "ครั้ง": "times",
  "ความรู้กลาง": "General knowledge",
  "คัดลอกโค้ด": "Copy code",
  "คำสั่ง (บรรทัดละ 1 คำสั่ง · ใช้": "Commands (one per line · use",
  "ค้นหาความรู้…": "Search knowledge…",
  "ชื่อ (display)": "Name (display)",
  "ดึง log ไม่ได้": "Couldn’t fetch logs",
  "ตรวจให้ดีก่อนอนุมัติ": "check carefully before approving",
  "ถาม AI เกี่ยวกับ server ได้เลย": "Ask the AI about your servers",
  "ทดสอบ": "Test",
  "พิมพ์โมเดลเองได้ที่ Settings": "You can type a custom model in Settings",
  "มีการแก้ไขที่ยังไม่บันทึก — ปิดโดยไม่บันทึกไหม?": "You have unsaved changes — close without saving?",
  "ยังไม่มีความรู้ — AI จะบันทึกเองเมื่อเรียนรู้ หรือเพิ่มเองด้านล่าง": "No knowledge yet — the AI saves what it learns, or add your own below",
  "ยังไม่มีประวัติ": "No history yet",
  "ยังไม่ได้ตั้ง API key ของ": "No API key set for",
  "รหัสผ่าน/คีย์ถูกเข้ารหัสเก็บในเครื่องด้วย Keychain — macOS อาจถามขออนุญาตครั้งแรก": "Passwords and keys are encrypted locally with the system keychain — macOS may ask for permission the first time",
  "รายละเอียดการเชื่อมต่อ SSH": "SSH connection details",
  "รายละเอียดความรู้ (วิธีแก้, quirk, preference…)": "Details (fix, quirk, preference…)",
  "ลบ container": "Delete container",
  "ลบ server": "Delete server",
  "ลบความรู้นี้?": "Delete this entry?",
  "ลองใหม่": "Try again",
  "ล้างแชท": "Clear chat",
  "สรุปสิ่งที่เพิ่ม/ปรับ": "here’s what was added and changed",
  "หรือวางเนื้อหา private key (เก็บแบบเข้ารหัส)": "or paste the private key contents (stored encrypted)",
  "หัวข้อ": "Title",
  "เกิดข้อผิดพลาดในส่วนนี้": "Something went wrong in this pane",
  "เขียนแบบปลอดภัย (atomic + คงสิทธิ์ไฟล์เดิม) · ⌘Z ย้อน / ⇧⌘Z ทำซ้ำ · เนื้อหาไม่ถูกส่งไป AI": "Safe writes (atomic + original permissions kept) · ⌘Z undo / ⇧⌘Z redo · contents are never sent to the AI",
  "เช่น “เช็ค disk ว่าตัวไหนเต็ม” หรือ “หา process ที่กิน CPU สูงสุด”": "e.g. “check which disk is full” or “find the process using the most CPU”",
  "เปิด terminal session ก่อนถึงจะรัน runbook ได้": "Open a terminal session to run a runbook",
  "เปิด terminal session ก่อนเพื่อให้ AI รันคำสั่งได้": "Open a terminal session so the AI can run commands",
  "เพิ่ม Server ใหม่": "Add a server",
  "เพิ่มความรู้": "Add knowledge",
  "เพื่อสร้างช่องให้กรอกตอนรัน)": "to create an input asked for at run time)",
  "เรียกดูไฟล์อื่น…": "Browse for another file…",
  "เลือก group ที่มี": "Pick an existing group",
  "เลือก key ในเครื่อง": "Pick a key on this machine",
  "เลือก session เพื่อดูประวัติคำสั่ง": "Pick a session to see its command history",
  "แก้ไข Server": "Edit server",
  "แก้ไข runbook": "Edit runbook",
  "แก้ไขความรู้": "Edit knowledge",
  "แล้ว —": "—",
  "โมเดล": "Models",
  "โหมด dev ยังไม่มีระบบอัปเดต (เฉพาะตัวติดตั้งจริง)": "Dev mode has no updater (installed builds only)",
  "ใช้": "used",
  "ใช้งาน docker บนเซิร์ฟเวอร์นี้ไม่ได้ (อาจไม่มี docker หรือผู้ใช้ไม่มีสิทธิ์)": "Can’t use docker on this server (not installed, or the user lacks permission)",
  "ได้เลย ปลอดภัย": "— it’s safe",
  "ไปที่ Settings": "go to Settings",
  "ไฟล์ถูกแก้ไขบนเซิร์ฟเวอร์ระหว่างที่คุณเปิดอยู่ — บันทึกทับของเดิมไหม?": "The file changed on the server while you had it open — overwrite it?",
  "ไม่พบ key ใน ~/.ssh": "No keys found in ~/.ssh",
  "ไม่พบที่ค้นหา": "No matches",
  "ไม่มีคำสั่งที่บันทึกใน session นี้": "No commands recorded in this session",
  "— ไม่มี —": "— none —",

  // --- เก็บตกรอบสุดท้าย ---
  "เสนอคำสั่ง ไม่รันให้": "Proposes commands without running them",
  "รันเองอัตโนมัติเป็น loop": "Runs by itself in a loop",
  "แก้ไขความรู้แล้ว": "Knowledge updated",
  "เพิ่มความรู้แล้ว": "Knowledge added",
  "{{ชื่อ}}": "{{name}}",
  "แก้ไข server แล้ว": "Server updated",
  "เพิ่ม server แล้ว": "Server added",
  "เชื่อมต่อสำเร็จ": "Connected successfully",
  "ล้มเหลว": "Failed",
  "อื่นๆ": "Other",
  "ตรวจสอบไม่สำเร็จ": "Check failed",
  "พบเวอร์ชันใหม่": "New version available",
  "กำลังดาวน์โหลด…": "downloading…",
  "บันทึก API key แล้ว": "API key saved",
  "ลบ API key แล้ว": "API key removed",
  "เลือกโมเดล": "Pick a model",
  "บันทึกการตั้งค่าแล้ว": "Settings saved",
  "API key ถูกเข้ารหัสเก็บในเครื่องคุณด้วย Keychain ของระบบ (ไม่ส่งออกที่ไหน) — ครั้งแรก macOS อาจถามขออนุญาตเข้าถึง Keychain กด “Always Allow” ได้เลย ปลอดภัย": "Your API key is encrypted on this machine with the system keychain and never leaves it — the first time, macOS may ask for keychain access; clicking “Always Allow” is safe.",
  "•••••••• (เปลี่ยน key)": "•••••••• (change key)",
  "ดาวน์โหลดไม่สำเร็จ": "Download failed",
  "รายการที่เลือก": "selected items",
  "รายการ": "items",
  "ยังไม่มี session — เปิดจากรายการ server หรือ local": "No sessions yet — open one from the server list or a local shell",
  "ช่วยดูให้หน่อยว่าเกิดอะไรขึ้นใน terminal นี้ ถ้ามี error บอกสาเหตุและวิธีแก้": "Take a look at what happened in this terminal — if there's an error, explain the cause and how to fix it",
  "กำลังดาวน์โหลดอัปเดต": "Downloading update",
  "ดาวน์โหลดเสร็จแล้ว — รีสตาร์ทเพื่อใช้เวอร์ชันใหม่": "has been downloaded — restart to use the new version",
  "กำลังใช้": "currently on",
  "อัปเดตเป็น Perms": "Updated to Perms"
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
