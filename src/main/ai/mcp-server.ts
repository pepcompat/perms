import http from 'http'
import { randomBytes } from 'crypto'
import type { AddressInfo } from 'net'
import type { ToolSchema } from './providers/types'

// MCP server (streamable HTTP แบบตอบ JSON ตรง ๆ) ที่ Perms เปิดใน 127.0.0.1 ให้ CLI ของ subscription
// (codex / claude) เรียกเครื่องมือของ Perms — คำสั่งจึงยังผ่าน guard/การอนุมัติ และรันบน session
// ที่ผู้ใช้เปิดอยู่ (SSH/local) ไม่ใช่บนเครื่องที่ CLI รัน
// แต่ละรอบสนทนาได้ path ลับของตัวเอง (/mcp/<token>) — รอบจบ = ปิด path ทิ้ง

export type McpToolHandler = (name: string, args: Record<string, unknown>) => Promise<string>

interface Run {
  tools: ToolSchema[]
  handler: McpToolHandler
}

const runs = new Map<string, Run>()
let server: http.Server | null = null
let port = 0

interface RpcRequest {
  jsonrpc: '2.0'
  id?: string | number | null
  method: string
  params?: Record<string, unknown>
}

async function handleRpc(run: Run, req: RpcRequest): Promise<unknown | null> {
  const ok = (result: unknown): unknown => ({ jsonrpc: '2.0', id: req.id, result })
  const fail = (code: number, message: string): unknown => ({
    jsonrpc: '2.0',
    id: req.id,
    error: { code, message }
  })
  // notification (ไม่มี id) ไม่ต้องตอบ
  if (req.id === undefined || req.id === null) return null
  switch (req.method) {
    case 'initialize':
      return ok({
        protocolVersion: (req.params?.protocolVersion as string) || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'perms', version: '1' }
      })
    case 'ping':
      return ok({})
    case 'tools/list':
      return ok({
        tools: run.tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.parameters }))
      })
    case 'tools/call': {
      const name = String(req.params?.name ?? '')
      const args = (req.params?.arguments as Record<string, unknown>) ?? {}
      if (!run.tools.some((t) => t.name === name)) return fail(-32602, `Unknown tool: ${name}`)
      try {
        const text = await run.handler(name, args)
        return ok({ content: [{ type: 'text', text }], isError: false })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return ok({ content: [{ type: 'text', text: `Error: ${msg}` }], isError: true })
      }
    }
    default:
      return fail(-32601, `Method not found: ${req.method}`)
  }
}

function onRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  const m = (req.url ?? '').match(/^\/mcp\/([A-Za-z0-9_-]+)\/?$/)
  const run = m ? runs.get(m[1]) : undefined
  if (!run) {
    res.writeHead(404).end()
    return
  }
  if (req.method === 'DELETE') {
    res.writeHead(200).end()
    return
  }
  if (req.method !== 'POST') {
    // ไม่มี stream ฝั่ง server→client
    res.writeHead(405, { Allow: 'POST' }).end()
    return
  }
  let body = ''
  let tooBig = false
  req.on('data', (d: Buffer) => {
    body += d.toString('utf8')
    if (body.length > 2 * 1024 * 1024) tooBig = true
  })
  req.on('end', () => {
    void (async () => {
      if (tooBig) return res.writeHead(413).end()
      let parsed: RpcRequest | RpcRequest[]
      try {
        parsed = JSON.parse(body)
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }))
      }
      const list = Array.isArray(parsed) ? parsed : [parsed]
      const out = (await Promise.all(list.map((r) => handleRpc(run, r)))).filter((r) => r !== null)
      if (!out.length) return res.writeHead(202).end()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(Array.isArray(parsed) ? out : out[0]))
    })()
  })
}

async function ensureServer(): Promise<number> {
  if (server) return port
  server = http.createServer(onRequest)
  // tool อย่าง run_in_terminal / รออนุมัติ ใช้เวลานาน — อย่าให้ node ตัด connection เอง
  server.requestTimeout = 0
  server.headersTimeout = 60_000
  await new Promise<void>((resolve, reject) => {
    server!.once('error', reject)
    server!.listen(0, '127.0.0.1', () => resolve())
  })
  port = (server.address() as AddressInfo).port
  return port
}

/** เปิด endpoint สำหรับรอบสนทนาหนึ่ง — คืน url ให้ CLI และ dispose() เมื่อจบรอบ */
export async function registerMcpRun(
  tools: ToolSchema[],
  handler: McpToolHandler
): Promise<{ url: string; dispose: () => void }> {
  const p = await ensureServer()
  const token = randomBytes(24).toString('base64url')
  runs.set(token, { tools, handler })
  return { url: `http://127.0.0.1:${p}/mcp/${token}`, dispose: () => runs.delete(token) }
}
