/** ขนาดไบต์ → อ่านง่าย (B/KB/MB/GB/TB) */
export function humanSize(n: number): string {
  if (n < 1024) return `${n} B`
  const u = ['KB', 'MB', 'GB', 'TB']
  let v = n
  let i = -1
  do {
    v /= 1024
    i++
  } while (v >= 1024 && i < u.length - 1)
  return `${v.toFixed(1)} ${u[i]}`
}

/** ต่อ path แบบ remote (posix) */
export function joinRemote(dir: string, name: string): string {
  return dir.endsWith('/') ? dir + name : `${dir}/${name}`
}

/** ไฟล์นี้เป็นไฟล์บีบอัดที่แตกได้ไหม */
export function isArchive(name: string): boolean {
  return /\.(zip|tgz|tbz2|txz|tar|gz|bz2|xz)$|\.tar\.(gz|bz2|xz)$/i.test(name)
}

/** โฟลเดอร์แม่ของ path (คง / ที่รากไว้) */
export function parentPath(p: string): string {
  const parts = p.split('/').filter(Boolean)
  parts.pop()
  return '/' + parts.join('/')
}
