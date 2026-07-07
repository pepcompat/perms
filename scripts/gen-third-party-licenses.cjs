// สร้าง THIRD-PARTY-LICENSES.md จาก production dependencies
// รัน: pnpm licenses   (หรือ node scripts/gen-third-party-licenses.cjs)
const fs = require('fs')
const path = require('path')
const checker = require('license-checker')

const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'THIRD-PARTY-LICENSES.md')
const CAP = 16000 // จำกัดความยาว license text ต่อ package (กัน README ยาว ๆ)

checker.init({ start: ROOT, production: true }, (err, data) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }

  const pkgs = Object.entries(data)
    .map(([key, v]) => {
      const at = key.lastIndexOf('@')
      return { name: key.slice(0, at), version: key.slice(at + 1), ...v }
    })
    .filter((p) => p.name !== 'perms')
    .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))

  const counts = {}
  for (const p of pkgs) counts[p.licenses] = (counts[p.licenses] || 0) + 1
  const summary = Object.entries(counts).sort((a, b) => b[1] - a[1])

  let out = `# Third-Party Licenses / สัญญาอนุญาตของ dependency

Perms (ตัวโปรแกรมเอง) เผยแพร่ภายใต้ **MIT** (ดู [LICENSE](LICENSE))

โปรแกรมนี้ใช้ open-source components ต่อไปนี้ ${pkgs.length} รายการ (production dependencies)
รายการด้านล่างแสดง license + ข้อความสัญญาอนุญาต/ลิขสิทธิ์ของแต่ละตัวเพื่อการอ้างอิง (attribution)
ตามข้อกำหนดของ license แบบ permissive (MIT / BSD / Apache-2.0 / ISC / OFL ฯลฯ)

> ไฟล์นี้สร้างอัตโนมัติด้วย \`pnpm licenses\` — regenerate เมื่อ dependency เปลี่ยน

## สรุปตามชนิด license

| License | จำนวน |
|---------|------:|
${summary.map(([lic, n]) => `| ${lic} | ${n} |`).join('\n')}

---

`

  for (const p of pkgs) {
    out += `## ${p.name} — ${p.version}\n\n`
    out += `- **License:** ${p.licenses}\n`
    if (p.repository) out += `- **Repository:** ${p.repository}\n`
    if (p.publisher) out += `- **Publisher:** ${p.publisher}\n`
    out += `\n`
    let text = ''
    try {
      if (p.licenseFile && fs.existsSync(p.licenseFile)) {
        text = fs.readFileSync(p.licenseFile, 'utf8').trim()
      }
    } catch {
      /* skip */
    }
    if (text) {
      if (text.length > CAP) text = text.slice(0, CAP) + '\n\n… (ตัดทอน — ดูฉบับเต็มที่ repository)'
      out += '```\n' + text.replace(/```/g, "'''") + '\n```\n'
    } else {
      out += `_ไม่มีไฟล์ license แนบในแพ็กเกจ — ดูที่ ${p.repository || 'repository ของแพ็กเกจ'}_\n`
    }
    out += `\n---\n\n`
  }

  fs.writeFileSync(OUT, out)
  const kb = Math.round(fs.statSync(OUT).size / 1024)
  console.log(`THIRD-PARTY-LICENSES.md: ${pkgs.length} packages, ${kb} KB`)
})
