import type { DockerContainer } from '@shared/types'

// docker id/name มีแค่ [a-zA-Z0-9_.-] — ใช้กัน command injection ก่อนเอาไปต่อคำสั่ง
const ID_RE = /^[a-zA-Z0-9_.-]+$/

/** ตรวจว่า container id/name ปลอดภัยพอจะเอาไปต่อ shell command ไหม */
export function isValidContainerId(id: string): boolean {
  return ID_RE.test(id)
}

/** แปลง output ของ `docker ps -a --format '{{json .}}'` เป็น list container (pure, เทสต์ได้) */
export function parseDockerPs(output: string): DockerContainer[] {
  const containers: DockerContainer[] = []
  for (const line of output.split('\n')) {
    const t = line.trim()
    if (!t.startsWith('{')) continue
    let j: Record<string, string>
    try {
      j = JSON.parse(t) as Record<string, string>
    } catch {
      continue // ข้าม line ที่ไม่ใช่ JSON
    }
    const status = j.Status || ''
    const labels = j.Labels || ''
    const proj = /(?:^|,)com\.docker\.compose\.project=([^,]+)/.exec(labels)
    const svc = /(?:^|,)com\.docker\.compose\.service=([^,]+)/.exec(labels)
    containers.push({
      id: j.ID || '',
      name: j.Names || '',
      image: j.Image || '',
      status,
      state: (j.State || (/^up/i.test(status) ? 'running' : 'exited')).toLowerCase(),
      ports: j.Ports || '',
      created: j.CreatedAt || j.RunningFor || '',
      project: proj ? proj[1] : '',
      service: svc ? svc[1] : ''
    })
  }
  return containers
}
