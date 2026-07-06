// ตัวตรวจจับคำสั่งอันตราย — บังคับให้ "ขออนุมัติก่อนรัน" เสมอ แม้อยู่โหมด agentic
// (กัน prompt injection จาก output/หน้าเว็บที่ไม่น่าเชื่อถือ หลอกให้ AI รันคำสั่งทำลาย)
// pure ไม่มี dependency → unit test ได้ง่าย. bias ไปทาง "จับให้ครบ" (false positive แค่กดยืนยันเพิ่ม
// แต่ false negative = ข้อมูลหาย) แต่ก็เลี่ยง pattern ที่ปนคำสั่งปกติบ่อย ๆ

/** rm ที่ทั้ง recursive และ force (rm -rf / -fr / -r -f / --recursive --force) */
function rmRecursiveForce(cmd: string): boolean {
  // แฟลกรวมกลุ่มเดียวที่มีทั้ง r/R และ f (เช่น -rf, -fr, -Rf, -xrf)
  if (/\brm\b[^;|&\n]*?\s-[a-z]*[rR][a-z]*f\b/i.test(cmd)) return true
  if (/\brm\b[^;|&\n]*?\s-[a-z]*f[a-z]*[rR]\b/.test(cmd)) return true
  // แฟลกแยก (สลับลำดับได้)
  const hasR = /\brm\b[^;|&\n]*?\s(-[a-z]*[rR]\b|--recursive\b)/.test(cmd)
  const hasF = /\brm\b[^;|&\n]*?\s(-[a-z]*f\b|--force\b)/i.test(cmd)
  return hasR && hasF
}

const RULES: { test: (c: string) => boolean; reason: string }[] = [
  { test: rmRecursiveForce, reason: 'ลบแบบ recursive + force (rm -rf)' },
  { test: (c) => /\bmkfs(\.\w+)?\b|\bmke2fs\b/i.test(c), reason: 'ฟอร์แมตดิสก์ (mkfs)' },
  { test: (c) => /\bwipefs\b/i.test(c), reason: 'ลบ signature ของ filesystem (wipefs)' },
  { test: (c) => /\bdd\b[^;|&\n]*\bof=\/dev\//i.test(c), reason: 'dd เขียนทับลง device' },
  {
    test: (c) => />\s*\/dev\/(sd|nvme|hd|disk|vd|mmcblk|xvd)/i.test(c),
    reason: 'redirect เขียนทับ block device'
  },
  {
    test: (c) => /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;/.test(c) || /\{\s*:\s*\|\s*:\s*&\s*\}/.test(c),
    reason: 'fork bomb'
  },
  {
    test: (c) => /\b(curl|wget|fetch)\b[^\n]*\|\s*(sudo\s+)?(ba|z|k)?sh\b/i.test(c),
    reason: 'ดาวน์โหลดแล้ว pipe เข้า shell (remote code execution)'
  },
  {
    test: (c) => /\bch(mod|own)\b[^;|&\n]*\s-R\b[^;|&\n]*\s\/(\s|$)/i.test(c),
    reason: 'เปลี่ยนสิทธิ์แบบ recursive ที่ราก /'
  },
  {
    test: (c) => /\b(shutdown|reboot|poweroff|halt)\b/i.test(c) || /\binit\s+[06]\b/.test(c),
    reason: 'ปิด/รีบูตเครื่อง'
  }
]

/** คืนเหตุผล (ภาษาไทย) ถ้าคำสั่งเข้าข่ายอันตราย → null ถ้าปลอดภัย */
export function matchDangerous(command: string): string | null {
  const c = command ?? ''
  for (const r of RULES) {
    if (r.test(c)) return r.reason
  }
  return null
}
