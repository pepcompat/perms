// เลือก socket/pipe ของ ssh-agent ให้ถูกตามระบบ
// แยก logic ตัดสินใจออกมาเป็นฟังก์ชันบริสุทธิ์ (เทสได้) ส่วนการเช็คไฟล์จริงอยู่ที่ผู้เรียก

/** named pipe ของ Windows OpenSSH agent (service ในตัวของ Windows) */
export const WIN_OPENSSH_PIPE = '\\\\.\\pipe\\openssh-ssh-agent'

/**
 * ตัดสินว่าจะใช้ agent ตัวไหน
 * - มี SSH_AUTH_SOCK (mac/linux, Git-Bash, WSL) → ใช้ตามนั้น
 * - Windows: ถ้ามี OpenSSH agent pipe → ใช้ตัวนั้น (พบบ่อยสุด) ไม่งั้นลอง Pageant (PuTTY)
 * - อื่น ๆ ที่ไม่มี → undefined (ผู้เรียกจะแจ้ง error ว่าไม่มี agent)
 */
export function chooseAgentSock(opts: {
  authSock?: string
  platform: NodeJS.Platform
  opensshPipeExists: boolean
}): string | undefined {
  if (opts.authSock) return opts.authSock
  if (opts.platform === 'win32') {
    return opts.opensshPipeExists ? WIN_OPENSSH_PIPE : 'pageant'
  }
  return undefined
}
