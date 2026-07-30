import type { DockerContainer } from '@shared/types'
import { execSilent, getSessionHandle } from './terminal/session-manager'
import { SshSession } from './terminal/ssh-session'
import { parseDockerPs, isValidContainerId } from './docker-parse'

const ACTIONS: Record<string, string> = {
  start: 'start',
  stop: 'stop',
  restart: 'restart',
  remove: 'rm -f',
  pause: 'pause',
  unpause: 'unpause'
}

/** list container ทั้งหมด (running + stopped) — available=false ถ้าไม่มี docker/ไม่มีสิทธิ์ */
export async function dockerList(
  sessionId: string
): Promise<{ available: boolean; containers: DockerContainer[] }> {
  const res = await execSilent(sessionId, "docker ps -a --format '{{json .}}'")
  if (res.exitCode !== 0) return { available: false, containers: [] }
  return { available: true, containers: parseDockerPs(res.output) }
}

/** สั่ง start/stop/restart/remove/pause/unpause container */
export async function dockerAction(
  sessionId: string,
  action: string,
  id: string
): Promise<{ ok: boolean; output: string }> {
  const sub = ACTIONS[action]
  if (!sub) throw new Error(`unknown docker action: ${action}`)
  if (!isValidContainerId(id)) throw new Error('invalid container id')
  const res = await execSilent(sessionId, `docker ${sub} ${id}`)
  return { ok: res.exitCode === 0, output: res.output.trim() }
}

/** ดู logs ล่าสุดของ container (ครั้งเดียว) */
export async function dockerLogs(sessionId: string, id: string): Promise<string> {
  if (!isValidContainerId(id)) throw new Error('invalid container id')
  const res = await execSilent(sessionId, `docker logs --tail 400 ${id} 2>&1`)
  return res.output
}

/**
 * stream log แบบ live (`docker logs -f`) — ป้อนทีละก้อนผ่าน onData
 * คืนฟังก์ชันหยุด stream (ปิด channel = docker logs ฝั่ง remote จบ)
 */
export function dockerLogsStream(
  sessionId: string,
  id: string,
  onData: (chunk: string) => void
): () => void {
  if (!isValidContainerId(id)) throw new Error('invalid container id')
  const s = getSessionHandle(sessionId)
  if (!(s instanceof SshSession)) throw new Error('live log ใช้ได้เฉพาะ session แบบ SSH')
  // --tail 400 ให้เห็นของเก่าก่อน แล้ว -f ไหลต่อ · 2>&1 รวม stderr (docker เขียน log ที่ stderr บ่อย)
  return s.execStream(`docker logs --tail 400 -f ${id} 2>&1`, onData)
}
