import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

const DEFAULT_DB_PATH = 'data/app.sqlite';

let database;

function getDatabasePath() {
  return process.env.SQLITE_DB_PATH || DEFAULT_DB_PATH;
}

function openDatabase() {
  if (database) return database;

  const dbPath = getDatabasePath();
  const dbDir = path.dirname(dbPath);
  if (dbDir && dbDir !== '.') {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  database = new DatabaseSync(dbPath);
  database.exec('PRAGMA journal_mode = WAL');
  database.exec('PRAGMA foreign_keys = ON');
  migrate(database);
  return database;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      api_token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_tiktok_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      cookies TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active',
      last_used TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES agent_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agent_task_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES agent_users(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES agent_tiktok_accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agent_action_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES agent_users(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES agent_tiktok_accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comment_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account TEXT NOT NULL,
      video_url TEXT,
      content TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function toPlainObject(row) {
  return row ? { ...row } : null;
}

function normalizeCountRows(rows) {
  return rows.map((row) => ({
    action: row.action,
    count: Number(row.count)
  }));
}

export function getLocalDbInfo() {
  return {
    provider: 'sqlite',
    path: getDatabasePath()
  };
}

export function findUserByEmail(email) {
  return toPlainObject(
    openDatabase()
      .prepare('SELECT id, email, api_token, created_at FROM agent_users WHERE email = ?')
      .get(email)
  );
}

export function createUser({ email, token }) {
  const db = openDatabase();
  const result = db
    .prepare('INSERT INTO agent_users (email, api_token) VALUES (?, ?)')
    .run(email, token);

  return toPlainObject(
    db
      .prepare('SELECT id, email, api_token, created_at FROM agent_users WHERE id = ?')
      .get(Number(result.lastInsertRowid))
  );
}

export function findUserByCredentials({ email, apiToken }) {
  return toPlainObject(
    openDatabase()
      .prepare('SELECT id, email, api_token, created_at FROM agent_users WHERE email = ? AND api_token = ?')
      .get(email, apiToken)
  );
}

export function createTikTokAccount({ userId, name, cookies = [] }) {
  const db = openDatabase();
  const result = db
    .prepare(`
      INSERT INTO agent_tiktok_accounts (user_id, name, cookies, status)
      VALUES (?, ?, ?, 'active')
    `)
    .run(Number(userId), name, JSON.stringify(cookies));

  return toPlainObject(
    db
      .prepare('SELECT * FROM agent_tiktok_accounts WHERE id = ?')
      .get(Number(result.lastInsertRowid))
  );
}

export function listTikTokAccounts(userId) {
  return openDatabase()
    .prepare(`
      SELECT id, name, status, created_at
      FROM agent_tiktok_accounts
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
    `)
    .all(Number(userId))
    .map(toPlainObject);
}

export function findTikTokAccount({ userId, accountId }) {
  return toPlainObject(
    openDatabase()
      .prepare('SELECT * FROM agent_tiktok_accounts WHERE id = ? AND user_id = ?')
      .get(Number(accountId), Number(userId))
  );
}

export function updateTikTokAccountStatus({ accountId, status, lastUsed }) {
  openDatabase()
    .prepare(`
      UPDATE agent_tiktok_accounts
      SET status = ?, last_used = COALESCE(?, last_used)
      WHERE id = ?
    `)
    .run(status, lastUsed || null, Number(accountId));
}

export function insertTaskLog({ userId, accountId, action }) {
  openDatabase()
    .prepare('INSERT INTO agent_task_logs (user_id, account_id, action) VALUES (?, ?, ?)')
    .run(Number(userId), Number(accountId), action);
}

export function insertActionLog({ userId, accountId, action, details }) {
  openDatabase()
    .prepare('INSERT INTO agent_action_logs (user_id, account_id, action, details) VALUES (?, ?, ?, ?)')
    .run(Number(userId), Number(accountId), action, details || null);
}

export function insertCommentLog({ account, videoUrl, content, status }) {
  openDatabase()
    .prepare('INSERT INTO comment_logs (account, video_url, content, status) VALUES (?, ?, ?, ?)')
    .run(account, videoUrl || null, content || null, status);
}

export function getUserStats(userId) {
  const db = openDatabase();
  const actions = db
    .prepare(`
      SELECT action, COUNT(*) AS count
      FROM agent_action_logs
      WHERE user_id = ?
      GROUP BY action
      ORDER BY action
    `)
    .all(Number(userId));

  const tasks = db
    .prepare(`
      SELECT action, COUNT(*) AS count
      FROM agent_task_logs
      WHERE user_id = ?
      GROUP BY action
      ORDER BY action
    `)
    .all(Number(userId));

  return {
    actions: normalizeCountRows(actions),
    tasks: normalizeCountRows(tasks)
  };
}
