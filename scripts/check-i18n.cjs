#!/usr/bin/env node
/**
 * ตรวจว่าข้อความไทยใน UI มีคำแปลอังกฤษครบไหม
 *
 * ทำไมต้องมี: รอบแรกที่ทำ i18n เราตรวจแค่ข้อความที่อยู่ใน t('...') ตรง ๆ
 * เลยมองไม่เห็นข้อความที่เก็บใน constant ระดับโมดูลแล้วส่งเข้า t() เป็นตัวแปร
 * (เช่น MODE_OPTS) — ผลคือรายงานว่าแปลครบ 100% ทั้งที่ dropdown ยังเป็นไทย
 * สคริปต์นี้เลยสแกน "string literal ภาษาไทยทุกตัว" ในโค้ด renderer แทน
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const RENDERER = path.join(ROOT, 'src', 'renderer')
const I18N = path.join(RENDERER, 'lib', 'i18n.ts')

const THAI = /[฀-๿]/

/** ไฟล์ที่ไม่ต้องตรวจ — พจนานุกรมเอง, เทส, และ changelog (เก็บ 2 ภาษาในตัวอยู่แล้ว) */
const SKIP = [path.join('lib', 'i18n.ts'), path.join('lib', 'changelog.ts')]

/** ไฟล์เทส — คำอธิบายเทสเป็นไทยได้ ไม่ใช่ข้อความที่ผู้ใช้เห็น */
const isTest = (f) => /\.test\.tsx?$/.test(f)

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(e.name)) out.push(p)
  }
  return out
}

/** ดึง key ทั้งหมดจากดิกชันนารี EN ใน i18n.ts */
function dictKeys() {
  const src = fs.readFileSync(I18N, 'utf8')
  const start = src.indexOf('const EN: Record<string, string> = {')
  if (start < 0) throw new Error('หา EN dictionary ใน i18n.ts ไม่เจอ')
  const body = src.slice(start, src.indexOf('\n}', start))
  const keys = new Set()
  // อ่านทีละบรรทัด ห้ามใช้ global regex สแกนทั้งก้อน:
  // ค่าที่มี apostrophe (เช่น "What's new") จะทำให้ regex คร่อมข้ามหลายบรรทัด
  // แล้วมองไม่เห็นคีย์ถัดไป → รายงานว่า "ยังไม่แปล" ทั้งที่แปลไปแล้ว
  const re = /^\s*(?:'([^']+)'|"([^"]+)"|([^\s:'"][^:]*?))\s*:/
  const dupes = []
  for (const line of body.split('\n')) {
    const m = re.exec(line)
    if (!m) continue
    const k = (m[1] ?? m[2] ?? m[3] ?? '').trim()
    if (!k || !THAI.test(k)) continue
    // คีย์ซ้ำ = คำแปลตัวหลังถูกทับเงียบ ๆ (เคยพลาดมาแล้ว 2 ครั้งตอนเติมคำเป็นชุด)
    if (keys.has(k)) dupes.push(k)
    keys.add(k)
  }
  return { keys, dupes }
}

/**
 * ตัดคอมเมนต์ทิ้งก่อนสแกน — ข้อความในคอมเมนต์เป็นคำอธิบายให้คนอ่านโค้ด
 * ไม่ใช่ข้อความที่ผู้ใช้เห็น และมักมีเครื่องหมายคำพูดคร่อมจนถูกจับผิดว่าเป็น literal
 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
}

/** ดึง string literal ที่มีอักษรไทยออกจากไฟล์ (single/double quote และ template ที่ไม่มี ${}) */
function thaiLiterals(src) {
  const found = new Set()
  const patterns = [/'((?:[^'\\]|\\.)*)'/g, /"((?:[^"\\]|\\.)*)"/g, /`([^`$\\]*)`/g]
  for (const re of patterns) {
    let m
    while ((m = re.exec(src))) {
      const s = m[1]
      if (!THAI.test(s)) continue
      // ข้อความ UI จริงไม่มีเครื่องหมายคำพูด/วงเล็บปีกกา/แท็ก — ถ้ามีแปลว่า regex
      // คร่อมข้ามโค้ดมา (เช่น double-quote pass กิน Thai ที่อยู่ใน single-quote)
      if (/["'`{}<>=;\n]/.test(s)) continue
      found.add(s)
    }
  }
  return found
}

/**
 * ข้อความไทยที่อยู่ใน JSX โดยตรง เช่น <span>สวัสดี</span> — พวกนี้ไม่ได้ผ่าน t() แน่นอน
 * ต้องอยู่บรรทัดเดียวและไม่มีสัญลักษณ์ของโค้ด ไม่งั้นจะไปแมตช์ generic อย่าง
 * useState<...> ที่คร่อมคอมเมนต์ภาษาไทยข้ามบรรทัด (เคยเจอมาแล้ว)
 */
function bareJsxThai(src) {
  const found = new Set()
  const re = />([^<>{}\n]*[฀-๿][^<>{}\n]*)</g
  let m
  while ((m = re.exec(src))) {
    const s = m[1].trim()
    if (!s || /["'`()=;]/.test(s)) continue
    found.add(s)
  }
  return found
}

const { keys, dupes } = dictKeys()
const files = walk(RENDERER).filter((f) => !isTest(f) && !SKIP.some((s) => f.endsWith(s)))

const missing = new Map()
const bare = new Map()

for (const file of files) {
  const src = stripComments(fs.readFileSync(file, 'utf8'))
  const rel = path.relative(ROOT, file)

  for (const s of thaiLiterals(src)) {
    if (!keys.has(s)) {
      if (!missing.has(s)) missing.set(s, rel)
    }
  }
  for (const s of bareJsxThai(src)) {
    if (!bare.has(s)) bare.set(s, rel)
  }
}

let bad = 0

if (dupes.length) {
  bad += dupes.length
  console.error(`\n❌ คีย์ซ้ำในดิกชันนารี (${dupes.length} คำ) — ตัวหลังจะทับตัวแรกเงียบ ๆ:`)
  for (const k of dupes) console.error(`   '${k}'`)
}

if (bare.size) {
  bad += bare.size
  console.error(`\n❌ ข้อความไทยใน JSX ที่ไม่ได้ห่อ t() (${bare.size} จุด):`)
  for (const [s, f] of bare) console.error(`   ${f}\n      "${s}"`)
}

if (missing.size) {
  bad += missing.size
  console.error(`\n❌ ข้อความไทยที่ยังไม่มีคำแปลอังกฤษ (${missing.size} คำ):`)
  for (const [s, f] of missing) console.error(`   ${f}\n      '${s}': '',`)
}

if (bad === 0) {
  console.log(`✅ i18n ครบ — ดิกชันนารี ${keys.size} คำ, ตรวจ ${files.length} ไฟล์`)
  process.exit(0)
}

console.error(`\nรวม ${bad} จุดที่ต้องแก้`)
process.exit(1)
