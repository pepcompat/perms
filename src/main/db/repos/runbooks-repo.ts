import { nanoid } from 'nanoid'
import { getDb } from '../index'
import type { RunbookRecord, RunbookStep } from '@shared/types'

interface RunbookRow {
  id: string
  name: string
  description: string | null
  steps: string
  created_at: number
  updated_at: number
}

function toRecord(row: RunbookRow): RunbookRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    steps: JSON.parse(row.steps) as RunbookStep[],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function listRunbooks(): RunbookRecord[] {
  const rows = getDb()
    .prepare('SELECT * FROM runbooks ORDER BY name')
    .all() as RunbookRow[]
  return rows.map(toRecord)
}

export function saveRunbook(input: {
  id?: string | null
  name: string
  description?: string | null
  steps: RunbookStep[]
}): RunbookRecord {
  const now = Date.now()
  if (input.id) {
    getDb()
      .prepare(
        'UPDATE runbooks SET name=?, description=?, steps=?, updated_at=? WHERE id=?'
      )
      .run(input.name, input.description ?? null, JSON.stringify(input.steps), now, input.id)
    return toRecord(
      getDb().prepare('SELECT * FROM runbooks WHERE id = ?').get(input.id) as RunbookRow
    )
  }
  const id = nanoid()
  getDb()
    .prepare(
      `INSERT INTO runbooks (id, name, description, steps, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(id, input.name, input.description ?? null, JSON.stringify(input.steps), now, now)
  return toRecord(getDb().prepare('SELECT * FROM runbooks WHERE id = ?').get(id) as RunbookRow)
}

export function deleteRunbook(id: string): void {
  getDb().prepare('DELETE FROM runbooks WHERE id = ?').run(id)
}
