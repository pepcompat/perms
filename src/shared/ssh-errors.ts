// แปลง error ดิบจาก ssh2/เครือข่าย เป็นข้อความที่ผู้ใช้อ่านเข้าใจ
// ข้อความเป็นภาษาไทยและถูกใส่ไว้ใน i18n dictionary ด้วย → renderer เอาไปผ่าน t() แปลเป็นอังกฤษได้

export function friendlySshError(raw: unknown): string {
  const original = raw instanceof Error ? raw.message : String(raw ?? '')
  const msg = original.toLowerCase()
  const has = (s: string): boolean => msg.includes(s)

  if (has('all configured authentication methods failed') || has('authentication'))
    return 'ยืนยันตัวตนไม่สำเร็จ — ตรวจ username, รหัสผ่าน, private key หรือ passphrase ให้ถูกต้อง'
  if (has('host key') || has('host verification') || has('handshake failed'))
    return 'ยืนยัน host key ไม่ผ่าน — เซิร์ฟเวอร์อาจเปลี่ยนกุญแจ หรือถูกยกเลิกการเชื่อมต่อ'
  if (
    has('cannot parse privatekey') ||
    has('bad passphrase') ||
    has('unsupported key') ||
    has('unable to parse') ||
    has('encrypted openssh')
  )
    return 'อ่าน private key ไม่ได้ — รูปแบบไฟล์ไม่ถูกต้อง หรือ passphrase ผิด'
  if (has('econnrefused'))
    return 'เชื่อมต่อไม่ได้ — เซิร์ฟเวอร์ปฏิเสธการเชื่อมต่อ (ตรวจ host/port หรือ SSH เปิดอยู่ไหม)'
  if (has('etimedout') || has('timed out') || has('timeout'))
    return 'หมดเวลาเชื่อมต่อ — เข้าถึงเซิร์ฟเวอร์ไม่ได้ (ตรวจเครือข่าย/firewall)'
  if (has('enotfound') || has('getaddrinfo') || has('eai_again'))
    return 'หาเซิร์ฟเวอร์ไม่เจอ — ตรวจชื่อ host หรือการตั้งค่า DNS'
  if (has('ehostunreach') || has('enetunreach'))
    return 'เข้าถึงเซิร์ฟเวอร์ไม่ได้ — ไม่มีเส้นทางไปยัง host'
  if (has('econnreset'))
    return 'การเชื่อมต่อถูกตัด — เซิร์ฟเวอร์ปิดการเชื่อมต่อกะทันหัน'
  if (has('no ssh agent') || has('ssh_auth_sock'))
    return 'ไม่พบ SSH agent — ตรวจว่าเปิด ssh-agent อยู่ (หรือเลือก auth วิธีอื่น)'
  if (has('private key not found'))
    return 'ไม่พบไฟล์ private key ตาม path ที่ระบุ'

  // ไม่รู้จัก → คืนข้อความเดิม (กันข้อความว่าง)
  return original || 'เชื่อมต่อไม่สำเร็จ'
}
