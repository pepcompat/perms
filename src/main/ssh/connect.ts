import { readFileSync } from 'fs'
import { Client, type ConnectConfig, type ClientChannel } from 'ssh2'
import { getServerRow } from '../db/repos/servers-repo'
import { revealSecret } from '../secrets/safe-store'

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
    readyTimeout: 20000
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
        key = readFileSync(row.private_key_path)
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
      cfg.agent = process.env.SSH_AUTH_SOCK || (process.platform === 'win32' ? 'pageant' : undefined)
      if (!cfg.agent) throw new Error('No SSH agent available (SSH_AUTH_SOCK not set)')
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
    client.once('ready', () => resolve())
    client.once('error', (err) => reject(err))
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
