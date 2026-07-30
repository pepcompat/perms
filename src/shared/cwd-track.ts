// ตาม cwd ของ shell แบบ best-effort จากคำสั่ง cd ที่ผู้ใช้พิมพ์
// ใช้เปิด SFTP ที่โฟลเดอร์ปัจจุบันแทนที่จะกลับ home ทุกครั้ง
//
// เก็บ cwd เป็น 3 รูปแบบ: '/abs/path' · '~' หรือ '~/sub' · null (ไม่มั่นใจ → ให้ SFTP กลับ home)
// ไม่รู้ path จริงของ ~ ตอน track — ค่อยแปลงเป็น absolute ตอนเปิด SFTP (ตอนนั้นถาม home ได้)

/** รวม/ตัด segment . และ .. — คืน null ถ้า .. ทะลุเหนือ ~ (ไม่รู้ว่าคืออะไร) */
function normalize(p: string): string | null {
  const root = p.startsWith('/') ? '/' : p.startsWith('~') ? '~' : null
  if (!root) return null
  const rest = p.slice(root.length).replace(/^\/+/, '')
  const out: string[] = []
  for (const seg of rest.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') {
      if (out.length) out.pop()
      else if (root === '/') continue // อยู่ราก / แล้ว .. ก็ยังเป็นราก
      else return null // ~/.. = เหนือ home → ไม่รู้
    } else {
      out.push(seg)
    }
  }
  if (root === '/') return '/' + out.join('/')
  return out.length ? '~/' + out.join('/') : '~'
}

/** shell operator ที่ทำให้เดา cwd ต่อไม่ได้ */
const OPS = /[;`]|\|\||&&|\$\(|\|/

/**
 * cwd ถัดไปหลังรันคำสั่งหนึ่งบรรทัด
 * - ไม่ใช่ cd → cwd เดิม
 * - cd ปนกับคำสั่งอื่น (&&, ; ...) → null (ไม่มั่นใจ)
 * - cd - (กลับที่เดิม) → null (ไม่ได้ track ที่ก่อนหน้า)
 */
export function nextCwd(cwd: string | null, command: string): string | null {
  const cmd = command.trim()
  if (!cmd) return cwd

  const isCd = /^cd(\s|$)/.test(cmd)
  if (!isCd) {
    // มี cd ซ่อนอยู่หลัง operator (เช่น foo && cd bar) → ไม่มั่นใจ
    if (/\bcd\s/.test(cmd) && OPS.test(cmd)) return null
    return cwd
  }
  if (OPS.test(cmd)) return null

  let target = cmd.slice(2).trim().split(/\s+/)[0] ?? ''
  target = target.replace(/^['"]|['"]$/g, '')

  if (target === '' || target === '~' || target === '$HOME') return '~'
  if (target === '-') return null
  if (target.startsWith('/')) return normalize(target)
  if (target === '~' || target.startsWith('~/')) return normalize(target)
  // relative — ต้องรู้ที่อยู่ปัจจุบันก่อน
  if (cwd === null) return null
  return normalize(`${cwd}/${target}`)
}

/**
 * ดึง cwd จากบรรทัด prompt ปัจจุบันของ terminal
 * รองรับ prompt เริ่มต้นของ bash/zsh: `user@host:PATH$` / `root@host:PATH#`
 *
 * ข้อดีกว่าการ track cd: สะท้อน cwd จริงเสมอ ไม่ว่าจะมาจาก refresh (restore),
 * paste, กด ↑ เรียกประวัติ, หรือ tab completion — เพราะอ่านจากสิ่งที่เห็นบนจอ
 * ถ้า prompt ถูกปรับแต่ง (starship/มี git branch) จะจับไม่ได้ → คืน null ให้ fallback
 */
export function cwdFromPrompt(line: string): string | null {
  const m = /:\s?(~|~\/\S*|\/\S*?)\s*[#$%>❯]\s*$/.exec(line.trimEnd())
  if (!m) return null
  const p = m[1]
  return p === '~' || p.startsWith('~/') || p.startsWith('/') ? p : null
}

/**
 * แปลง cwd ที่ track ไว้เป็น absolute path สำหรับ SFTP
 * null → null (ให้ผู้เรียกใช้ home แทน)
 */
export function resolveCwd(cwd: string | null, home: string): string | null {
  if (!cwd) return null
  const h = home.replace(/\/+$/, '') || '/'
  if (cwd === '~') return h
  if (cwd.startsWith('~/')) return `${h}/${cwd.slice(2)}`
  if (cwd.startsWith('/')) return cwd
  return null
}
