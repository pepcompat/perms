// กรองความลับออกจากข้อความก่อนส่งให้ AI (LLM) — output จาก terminal อาจมี API key/password
// หลุดโดยไม่ตั้งใจ (cat .env, env, docker inspect ...) โมดูล pure → unit test ได้
// bias: จับ token รูปแบบที่รู้จักชัด ๆ (false positive ต่ำ) + key=value ที่ชื่อสื่อว่าเป็นความลับ

const R = '[REDACTED]'

const TOKEN_RULES: { re: RegExp; label: string }[] = [
  { re: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g, label: 'private-key' },
  { re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g, label: 'anthropic-key' },
  { re: /\bsk-[A-Za-z0-9]{20,}/g, label: 'openai-key' },
  { re: /\bAIza[0-9A-Za-z_-]{35}/g, label: 'google-key' },
  { re: /\bA(?:KIA|SIA|GPA|IDA|ROA|IPA|NPA|NVA)[0-9A-Z]{12,}\b/g, label: 'aws-key' },
  { re: /\bgh[posru]_[A-Za-z0-9]{30,}\b/g, label: 'github-token' },
  { re: /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g, label: 'github-pat' },
  { re: /\bglpat-[A-Za-z0-9_-]{20,}\b/g, label: 'gitlab-token' },
  { re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, label: 'slack-token' },
  { re: /\bey[A-Za-z0-9_-]{8,}\.ey[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, label: 'jwt' }
]

/** กรองความลับออก คืนข้อความที่แทนที่ด้วย [REDACTED] แล้ว */
export function redactSecrets(text: string): string {
  if (!text) return text
  let out = text

  // 1) token รูปแบบที่รู้จัก + private key block
  for (const { re, label } of TOKEN_RULES) out = out.replace(re, `[REDACTED:${label}]`)

  // 2) password ใน URL / connection string: scheme://user:PASSWORD@host
  out = out.replace(/(\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)([^\s@/]+)(@)/gi, `$1${R}$3`)

  // 3) Authorization: Bearer/Basic <token>
  out = out.replace(/\b(authorization\s*:\s*)(bearer|basic)\s+([A-Za-z0-9._~+/=-]{8,})/gi, `$1$2 ${R}`)

  // 4) KEY=value / KEY: value ที่ชื่อ key สื่อว่าเป็นความลับ
  // (prefix เป็น * ปล่อยว่างได้ ไม่งั้นตัวหน้าจะกลืนตัว "a" ของ api_key; ตัด "auth" ออกเลี่ยง author=)
  out = out.replace(
    /\b([A-Za-z0-9_]*(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|credential)[A-Za-z0-9_]*)(\s*[:=]\s*|\s+)(["']?)([^\s"']{3,})\3/gi,
    (_m, key, sep, q) => `${key}${sep}${q}${R}${q}`
  )

  // 5) mysql/mariadb -p<password> ติดกัน (มีตัวอักษร ไม่ใช่ตัวเลขล้วน เลี่ยงจับ port)
  out = out.replace(/\b(mysql\w*|mariadb)\b([^\n]*?)\s-p(?=\S*[A-Za-z])(\S+)/gi, `$1$2 -p${R}`)

  return out
}
