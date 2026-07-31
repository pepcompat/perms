import { readFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { Client, type ConnectConfig, type ClientChannel } from 'ssh2'
import { getServerRow } from '../db/repos/servers-repo'
import { revealSecret } from '../secrets/safe-store'
import { checkHostKey } from './host-key-guard'
import { friendlySshError } from '@shared/ssh-errors'
import { chooseAgentSock, WIN_OPENSSH_PIPE } from './agent-sock'

/** ขยาย ~ เป็น home directory (เช่น ~/.ssh/id_ed25519) */
function expandHome(p: string): string {
  if (p === '~') return homedir()
  if (p.startsWith('~/')) return join(homedir(), p.slice(2))
  return p
}

/** สร้าง ConnectConfig จาก server row (ถอด secret + เลือก auth method) */
function buildConfig(serverId: string): ConnectConfig & { _host: string } {
  const row = getServerRow(serverId)
  if (!row) throw new Error(`Server ${serverId} not found`)

  const cfg: ConnectConfig & { _host: string } = {
    _host: row.host,
    host: row.host,
    port: row.port,
    username: row.username,
    keepaliveInterval: 15000,
    readyTimeout: 20000,
    // ตรวจตัวตนเซิร์ฟเวอร์ก่อนส่ง credential ใด ๆ — ถ้าไม่ใส่ ssh2 จะรับ key อะไรก็ได้
    // แปลว่าใครดักกลางทางก็สวมรอยเป็นเซิร์ฟเวอร์เราได้ทันที
    hostVerifier: (key: Buffer, cb: (ok: boolean) => void) => {
      checkHostKey(row.host, row.port, row.name, key).then(cb, () => cb(false))
    }
  }

  switch (row.auth_type) {
    case 'password': {
      const pw = revealSecret(row.secret_id)
      if (pw) cfg.password = pw
      break
    }
    case 'key': {
      // private key อาจมาจากไฟล์ หรือเก็บใน secrets
      let key: string | Buffer | undefined
      if (row.private_key_path) {
        key = readFileSync(expandHome(row.private_key_path))
      } else {
        const stored = revealSecret(row.secret_id)
        if (stored) key = stored
      }
      if (!key) throw new Error('Private key not found for server')
      cfg.privateKey = key
      // ถ้า auth เป็น key แต่มี secret อีกตัวเป็น passphrase (กรณี key อยู่ในไฟล์)
      if (row.private_key_path && row.secret_id) {
        const pass = revealSecret(row.secret_id)
        if (pass) cfg.passphrase = pass
      }
      break
    }
    case 'agent': {
      // Windows: เดิม default ไป Pageant เสมอ แต่คนส่วนใหญ่ใช้ OpenSSH agent (คนละ pipe)
      // → ต่อไม่ติด ตอนนี้เลือกให้ถูกตามที่มีจริง
      const opensshPipeExists =
        process.platform === 'win32' ? existsSync(WIN_OPENSSH_PIPE) : false
      cfg.agent = chooseAgentSock({
        authSock: process.env.SSH_AUTH_SOCK,
        platform: process.platform,
        opensshPipeExists
      })
      if (!cfg.agent)
        throw new Error('ไม่พบ SSH agent — เปิด ssh-agent (มี key โหลดอยู่) หรือเลือก auth วิธีอื่น')
      break
    }
  }

  return cfg
}

/**
 * เชื่อมต่อ SSH โดยรองรับ jump host chain
 * ไล่จาก server ปลายทาง -> ตาม jump_host_id ขึ้นไปจนถึงตัวที่ไม่มี jump host
 * แล้วเชื่อมจากนอกสุดเข้ามาทีละชั้นด้วย forwardOut
 */
export async function connectSsh(serverId: string): Promise<Client> {
  // สร้างลำดับ chain: [outermost bastion, ..., target]
  const chain: string[] = []
  let cursor: string | null = serverId
  const guard = new Set<string>()
  while (cursor) {
    if (guard.has(cursor)) throw new Error('Jump host loop detected')
    guard.add(cursor)
    chain.unshift(cursor)
    cursor = getServerRow(cursor)?.jump_host_id ?? null
  }

  let prevClient: Client | null = null

  for (let i = 0; i < chain.length; i++) {
    const cfg = buildConfig(chain[i])
    const client = new Client()

    if (prevClient) {
      // เปิด tunnel จาก hop ก่อนหน้าไปยัง hop นี้
      const stream = await forwardOut(prevClient, cfg._host, cfg.port ?? 22)
      cfg.sock = stream
    }

    await waitReady(client, cfg)

    // ปิด client ก่อนหน้าเมื่อ client ปลายสุดปิด (chain cleanup)
    if (prevClient) {
      const upstream = prevClient
      client.on('close', () => upstream.end())
    }
    prevClient = client
  }

  return prevClient!
}

function waitReady(client: Client, cfg: ConnectConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false
    const done = (err?: Error): void => {
      if (settled) return
      settled = true
      if (err) reject(err)
      else resolve()
    }
    // ใช้ on() ไม่ใช่ once() — ssh2 ยิง 'error' ได้หลายครั้ง (auth fail แล้วตอนปิด socket ยิงซ้ำ)
    // ถ้าใช้ once ตัวที่ 2 จะไม่มีคนดัก → กลายเป็น uncaught exception เด้ง crash dialog
    // persistent handler + settled guard = error ซ้ำถูกกลืนเงียบ ๆ ไม่ล้ม
    client.on('error', (err) => done(new Error(friendlySshError(err))))
    client.once('ready', () => done())
    client.connect(cfg)
  })
}

function forwardOut(client: Client, dstHost: string, dstPort: number): Promise<ClientChannel> {
  return new Promise((resolve, reject) => {
    client.forwardOut('127.0.0.1', 0, dstHost, dstPort, (err, stream) => {
      if (err) reject(err)
      else resolve(stream)
    })
  })
}

/** ทดสอบเชื่อมต่อแล้วปิดทันที — ใช้ปุ่ม "Test connection" */
export async function testConnection(serverId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = await connectSsh(serverId)
    client.end()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
