import { describe, it, expect } from 'vitest'
import { execFileSync } from 'child_process'
import { mkdtempSync, realpathSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { wrapWithCwd, splitCwdMarker } from './cwd-exec'

/** รันแบบเดียวกับ exec ของ session (shell -c) แล้วแกะผล */
function run(shell: string, command: string, cwd: string | null): { output: string; cwd: string | null; code: number } {
  try {
    const out = execFileSync(shell, ['-c', wrapWithCwd(command, cwd)], { encoding: 'utf8' })
    return { ...splitCwdMarker(out), code: 0 }
  } catch (e) {
    const err = e as { stdout: string; status: number }
    return { ...splitCwdMarker(err.stdout), code: err.status }
  }
}

const shells = ['/bin/sh', '/bin/bash', '/bin/zsh'].filter((s) => existsSync(s))

describe.each(shells)('wrapWithCwd ใน %s', (shell) => {
  it('cd ในคำสั่งหนึ่ง → คำสั่งถัดไปเริ่มที่โฟลเดอร์นั้น (หลายขั้นต่อเนื่องได้)', () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), 'perms cwd ')))
    const a = run(shell, 'mkdir demo && cd demo && echo hi > a.txt', base)
    expect(a.code).toBe(0)
    expect(a.cwd).toBe(join(base, 'demo'))
    const b = run(shell, 'ls', a.cwd)
    expect(b.output.trim()).toBe('a.txt')
    expect(b.cwd).toBe(join(base, 'demo'))
  })

  it('คง exit code เดิม และ output ไม่มี marker ปน', () => {
    const r = run(shell, 'echo out; exit_code_test() { return 3; }; exit_code_test', null)
    expect(r.code).toBe(3)
    expect(r.output).toBe('out\n')
  })

  it('cwd ที่จำไว้หายไปแล้ว → ถอยไป home แทนที่จะพัง', () => {
    const r = run(shell, 'pwd', '/nonexistent/perms-test')
    expect(r.cwd).toBe(realpathSync(process.env.HOME!))
  })
})

describe('splitCwdMarker', () => {
  it('ไม่มี marker (คำสั่ง exit เอง) → คืน output เดิม cwd=null', () => {
    expect(splitCwdMarker('hello')).toEqual({ output: 'hello', cwd: null })
  })
})
