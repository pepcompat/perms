-- ตารางเริ่มต้นทั้งหมด

CREATE TABLE IF NOT EXISTS secrets (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,           -- ssh_password | ssh_passphrase | ssh_private_key | api_key
  ciphertext  BLOB NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS servers (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  host             TEXT NOT NULL,
  port             INTEGER NOT NULL DEFAULT 22,
  username         TEXT NOT NULL,
  auth_type        TEXT NOT NULL,       -- password | key | agent
  secret_id        TEXT,                -- FK -> secrets
  private_key_path TEXT,
  jump_host_id     TEXT,                -- FK -> servers (bastion)
  group_name       TEXT,
  color            TEXT,
  notes            TEXT,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  FOREIGN KEY (secret_id) REFERENCES secrets(id) ON DELETE SET NULL,
  FOREIGN KEY (jump_host_id) REFERENCES servers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  server_id   TEXT,                     -- null = local shell
  kind        TEXT NOT NULL,            -- ssh | local
  started_at  INTEGER NOT NULL,
  ended_at    INTEGER,
  status      TEXT NOT NULL DEFAULT 'active',
  title       TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS commands (
  id             TEXT PRIMARY KEY,
  session_id     TEXT NOT NULL,
  command        TEXT NOT NULL,
  exit_code      INTEGER,
  output_preview TEXT,
  ran_at         INTEGER NOT NULL,
  source         TEXT NOT NULL DEFAULT 'user',  -- user | ai
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_history (
  id          TEXT PRIMARY KEY,
  session_id  TEXT,
  provider    TEXT NOT NULL,
  model       TEXT NOT NULL,
  role        TEXT NOT NULL,            -- user | assistant | tool | system
  content     TEXT NOT NULL,
  tool_calls  TEXT,                     -- JSON
  created_at  INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS runbooks (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  steps       TEXT NOT NULL,            -- JSON array
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- knowledge: คลังความรู้ของ AI (สิ่งที่สอน/เคสที่สำเร็จ) ดึงมาช่วยในอนาคต
CREATE TABLE IF NOT EXISTS knowledge (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  tags        TEXT,                       -- JSON array
  server_id   TEXT,                       -- ผูก server (null = ความรู้กลาง)
  source      TEXT NOT NULL DEFAULT 'ai', -- ai | user
  use_count   INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_commands_session ON commands(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_history_session ON ai_history(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_server ON sessions(server_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_server ON knowledge(server_id);
