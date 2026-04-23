import sqlite3 from 'sqlite3';
import { app } from 'electron';
import path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type LogLevel = 'success' | 'error' | 'warn' | 'info';

export interface LogEntry {
  id: number;
  level: LogLevel;
  category: string; // 'file-processing' | 'hook' | 'app' | 'watcher'
  message: string;
  detail?: string;  // stack trace or extra info
  createdAt: string;
}

// ---------------------------------------------------------------------------
// DB setup
// ---------------------------------------------------------------------------
const dbPath = path.join(app.getPath('userData'), 'logs.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      category TEXT NOT NULL,
      message TEXT NOT NULL,
      detail TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// ---------------------------------------------------------------------------
// Reference to main window (set from main.ts)
// ---------------------------------------------------------------------------
let mainWindow: any = null;

export function setLoggerWindow(win: any) {
  mainWindow = win;
}

// ---------------------------------------------------------------------------
// Core log function
// ---------------------------------------------------------------------------
function writeLog(level: LogLevel, category: string, message: string, detail?: string) {
  db.run(
    `INSERT INTO logs (level, category, message, detail) VALUES (?, ?, ?, ?)`,
    [level, category, message, detail ?? null],
    function (err) {
      if (err) {
        console.error('[logger] Failed to write log:', err);
        return;
      }
      // Push real-time event to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('log-added', {
          id: this.lastID,
          level,
          category,
          message,
          detail: detail ?? null,
          createdAt: new Date().toISOString(),
        } satisfies Omit<LogEntry, 'id'> & { id: number });
      }
    }
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export const logger = {
  success: (category: string, message: string, detail?: string) =>
    writeLog('success', category, message, detail),
  error: (category: string, message: string, detail?: string) =>
    writeLog('error', category, message, detail),
  warn: (category: string, message: string, detail?: string) =>
    writeLog('warn', category, message, detail),
  info: (category: string, message: string, detail?: string) =>
    writeLog('info', category, message, detail),
};

// ---------------------------------------------------------------------------
// DB query helpers
// ---------------------------------------------------------------------------
export function getLogs({
  page = 1,
  pageSize = 50,
  level,
}: {
  page?: number;
  pageSize?: number;
  level?: LogLevel | 'all';
}): Promise<{ rows: LogEntry[]; total: number }> {
  const offset = (page - 1) * pageSize;
  const where =
    level && level !== 'all' ? `WHERE level = '${level}'` : '';

  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) as total FROM logs ${where}`, (err, countRow: any) => {
      if (err) return reject(err);
      const total = countRow?.total ?? 0;

      db.all(
        `SELECT * FROM logs ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        [pageSize, offset],
        (err2, rows) => {
          if (err2) return reject(err2);
          resolve({ rows: (rows ?? []) as LogEntry[], total });
        }
      );
    });
  });
}

export function clearLogs(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM logs`, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
