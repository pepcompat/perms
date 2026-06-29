import { app } from 'electron'
import { join } from 'path'
import Database from 'better-sqlite3'
import initSql from './migrations/001_init.sql?raw'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db
  const dbPath = join(app.getPath('userData'), 'perms.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

function migrate(database: Database.Database): void {
  database.exec(initSql)
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
