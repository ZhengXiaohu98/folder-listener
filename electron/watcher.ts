import { watch, FSWatcher } from 'chokidar';
import sharp from 'sharp';
import sqlite3 from 'sqlite3';
import { app, shell } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { createRequire } from 'node:module';
import { logger } from './logger.js';

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
const dbPath = path.join(app.getPath('userData'), 'history.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT,
      originalSize INTEGER,
      compressedSize INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let watcher: FSWatcher | null = null;
let mainWindow: any = null;
let activeConfig: any = null;
let activeSourceFolder: string | null = null;
let watcherTransition: Promise<void> = Promise.resolve();

// ---------------------------------------------------------------------------
// Concurrency Queue
// ---------------------------------------------------------------------------
const CONCURRENCY_LIMIT = 5;
let activeJobs = 0;
const jobQueue: (() => Promise<void>)[] = [];

function enqueue(job: () => Promise<void>) {
  jobQueue.push(job);
  drainQueue();
}

function drainQueue() {
  while (activeJobs < CONCURRENCY_LIMIT && jobQueue.length > 0) {
    const job = jobQueue.shift()!;
    activeJobs++;
    job().finally(() => {
      activeJobs--;
      drainQueue();
    });
  }
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

/** Map supportedFormats config keys → file extensions */
const FORMAT_EXT_MAP: Record<string, string[]> = {
  jpeg: ['.jpg', '.jpeg'],
  png:  ['.png'],
  webp: ['.webp'],
  gif:  ['.gif'],
  svg:  ['.svg'],
  avif: ['.avif'],
};

/**
 * Formats that sharp can convert TO (output targets).
 * SVG and GIF are excluded because sharp cannot produce them.
 */
const CONVERTIBLE_OUTPUT_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif']);

/** Build the set of extensions the watcher should react to based on config. */
function buildAllowedExtensions(supportedFormats: Record<string, boolean>): Set<string> {
  const exts = new Set<string>();
  for (const [key, enabled] of Object.entries(supportedFormats)) {
    if (enabled && FORMAT_EXT_MAP[key]) {
      for (const ext of FORMAT_EXT_MAP[key]) {
        exts.add(ext);
      }
    }
  }
  return exts;
}

/** Generate a random 6-digit numeric string. */
function randomSixDigits(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** Resolve the destination filename according to advanced options. */
function resolveDestFilename(
  sourceFilename: string,
  sourceExt: string,
  destExt: string,
  advancedOptions: any
): string {
  const { enableCustomFileName, customFileName, enableCustomSuffix, customSuffix } = advancedOptions ?? {};
  const nameWithoutExt = path.basename(sourceFilename, sourceExt);

  // 1. Custom Filename takes highest priority
  if (enableCustomFileName && customFileName) {
    return `${customFileName}-${randomSixDigits()}${destExt}`;
  }

  // 2. Custom Suffix
  const suffix = enableCustomSuffix ? (customSuffix ?? '-min') : '';
  return `${nameWithoutExt}${suffix}${destExt}`;
}

/** Determine the output extension and sharp pipeline method for a given config. */
function resolveOutputFormat(
  sourceExt: string,
  outputFormatConfig: string
): { destExt: string; sharpFormat: string | null } {
  // Normalise source ext → format key
  const srcFmt = sourceExt === '.jpg' ? 'jpeg' : sourceExt.replace('.', '');

  if (!outputFormatConfig || outputFormatConfig === 'Original') {
    // Keep original, but GIF/SVG can't be re-encoded by sharp — pass through
    if (['gif', 'svg'].includes(srcFmt)) {
      return { destExt: sourceExt, sharpFormat: null }; // copy only
    }
    return { destExt: sourceExt, sharpFormat: srcFmt };
  }

  const target = outputFormatConfig.toLowerCase(); // 'jpeg' | 'png' | 'webp' | 'avif'

  if (!CONVERTIBLE_OUTPUT_FORMATS.has(target)) {
    // Unsupported target — fall back to original
    console.warn(`[watcher] Cannot convert to "${outputFormatConfig}", keeping original format.`);
    return { destExt: sourceExt, sharpFormat: srcFmt === 'gif' || srcFmt === 'svg' ? null : srcFmt };
  }

  // Source is GIF or SVG — sharp can READ them but cannot write them as-is
  // We can still convert to the target format
  const extMap: Record<string, string> = { jpeg: '.jpg', png: '.png', webp: '.webp', avif: '.avif' };
  return { destExt: extMap[target], sharpFormat: target };
}

// ---------------------------------------------------------------------------
// Core processing
// ---------------------------------------------------------------------------
async function processFile(filePath: string, config: any): Promise<void> {
  const {
    sourceFolder,
    destFolder,
    compressionLevel = 'Medium',
    customOptions = { quality: 80, maxWidth: 1920 },
    supportedFormats = {},
    advancedOptions = {},
    outputFormat = 'Original',
  } = config;

  if (sourceFolder && !isPathInsideFolder(filePath, sourceFolder)) return;
  if (!destFolder) return;

  const sourceExt = path.extname(filePath).toLowerCase();
  const allowedExts = buildAllowedExtensions(supportedFormats);

  if (!allowedExts.has(sourceExt)) return; // not a watched format

  const { destExt, sharpFormat } = resolveOutputFormat(sourceExt, outputFormat);
  const sourceFilename = path.basename(filePath);
  const destFilename = resolveDestFilename(sourceFilename, sourceExt, destExt, advancedOptions);
  await fs.mkdir(destFolder, { recursive: true });
  const destPath = path.join(destFolder, destFilename);

  const stat = await fs.stat(filePath);
  const originalSize = stat.size;

  // Quality mapping for compression levels
  const qualityMap: Record<string, number> = { Low: 90, Medium: 80, High: 50, Custom: customOptions.quality ?? 80 };
  const quality = qualityMap[compressionLevel] ?? 80;
  const maxWidth = compressionLevel === 'Custom' ? (customOptions.maxWidth ?? 1920) : undefined;

  if (sharpFormat === null) {
    // Can't process with sharp (e.g. SVG → keep original, GIF without target conversion)
    await fs.copyFile(filePath, destPath);
  } else {
    let pipeline = sharp(filePath);

    // Resize if maxWidth is set
    if (maxWidth) {
      pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
    }

    // Apply format conversion + compression
    switch (sharpFormat) {
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality });
        break;
      case 'png':
        pipeline = pipeline.png({ quality });
        break;
      case 'webp':
        pipeline = pipeline.webp({ quality });
        break;
      case 'avif':
        pipeline = pipeline.avif({ quality });
        break;
      default:
        pipeline = pipeline.jpeg({ quality });
    }

    await pipeline.toFile(destPath);
  }

  const newStat = await fs.stat(destPath);
  const compressedSize = newStat.size;

  // Auto-delete original
  if (advancedOptions.autoDelete) {
    try {
      // Use shell.trashItem for safe deletion (sends to Trash, not permanent delete)
      await shell.trashItem(filePath);
    } catch (trashErr) {
      // Fallback to unlink if trashItem fails
      await fs.unlink(filePath);
    }
  }

  // Persist to DB
  await new Promise<void>((resolve, reject) => {
    db.run(
      `INSERT INTO activities (filename, originalSize, compressedSize) VALUES (?, ?, ?)`,
      [destFilename, originalSize, compressedSize],
      function (err) {
        if (err) return reject(err);
        if (mainWindow) {
          mainWindow.webContents.send('activity-added');
        }
        resolve();
      }
    );
  });

  // Execute Custom Hook
  if (config.hookEnabled && config.hookCode) {
    try {
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const hookFn = new AsyncFunction('require', 'file', 'config', config.hookCode);
      const fileInfo = {
        name: destFilename,
        path: destPath,
        size: compressedSize,
        originalSize,
        originalPath: filePath
      };
      await hookFn(require, fileInfo, config);
      logger.success('hook', `Hook executed for "${destFilename}"`);
    } catch (hookErr: any) {
      logger.error('hook', `Hook failed for "${destFilename}"`, hookErr?.stack ?? String(hookErr));
      // Do NOT re-throw — hook errors must not interrupt the app
    }
  }

  // Log file processing success
  const savedKb = ((originalSize - compressedSize) / 1024).toFixed(1);
  const ratio = originalSize > 0 ? ((1 - compressedSize / originalSize) * 100).toFixed(1) : '0';
  logger.success(
    'file-processing',
    `Processed "${destFilename}" — saved ${savedKb} KB (${ratio}%)`,
    `Original: ${(originalSize / 1024).toFixed(1)} KB → Output: ${(compressedSize / 1024).toFixed(1)} KB`
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function setMainWindow(win: any) {
  mainWindow = win;
}

export async function startWatcher(config: any) {
  if (watcher) return;
  const { sourceFolder, destFolder } = config;

  if (!sourceFolder || !destFolder) throw new Error('Source or Destination folder not set');

  await fs.mkdir(destFolder, { recursive: true }).catch(() => {});

  activeConfig = config;
  activeSourceFolder = path.resolve(sourceFolder);

  watcher = watch(sourceFolder, {
    ignored: /(^|[\/\\])\../,  // ignore hidden files
    persistent: true,
    ignoreInitial: true,
    // Wait for the file to finish writing before emitting the event.
    // Polls every 200ms; triggers once file size has been stable for 500ms.
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 200,
    },
  });

  watcher.on('add', (filePath: string) => {
    enqueue(async () => {
      try {
        const latestConfig = await getLatestConfig();
        await processFile(filePath, latestConfig ?? activeConfig ?? config);
      } catch (err: any) {
        const name = path.basename(filePath);
        logger.error(
          'file-processing',
          `Failed to process "${name}"`,
          err?.stack ?? String(err)
        );
        console.error('[watcher] Error processing file:', filePath, err);
      }
    });
  });
}

export async function stopWatcher() {
  if (watcher) {
    await watcher.close();
    watcher = null;
  }
  activeConfig = null;
  activeSourceFolder = null;
}

export function getWatcherStatus() {
  return watcher !== null;
}

export async function applyWatcherConfig(config: any) {
  watcherTransition = watcherTransition.then(async () => {
    const isRunning = watcher !== null;
    activeConfig = config;

    if (config?.destFolder) {
      await fs.mkdir(config.destFolder, { recursive: true }).catch(() => {});
    }

    if (!isRunning) return;

    const nextSourceFolder = config?.sourceFolder ? path.resolve(config.sourceFolder) : null;
    if (!nextSourceFolder || !config?.destFolder) {
      await stopWatcher();
      return;
    }

    if (activeSourceFolder !== nextSourceFolder) {
      await stopWatcher();
      await startWatcher(config);
    }
  }).catch((err) => {
    logger.error('watcher', 'Failed to apply updated configuration', err?.stack ?? String(err));
  });

  return watcherTransition;
}

export function getActivities() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM activities ORDER BY createdAt DESC LIMIT 50`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function getStats() {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT SUM(originalSize - compressedSize) as totalSaved, COUNT(*) as totalFiles FROM activities`,
      (err, row: any) => {
        if (err) reject(err);
        else resolve(row || { totalSaved: 0, totalFiles: 0 });
      }
    );
  });
}

export function getActivitiesPaged({
  page = 1,
  pageSize = 10,
  timeFilter = 'all',
}: {
  page?: number;
  pageSize?: number;
  timeFilter?: 'all' | 'today' | 'week' | 'month';
}): Promise<{ rows: any[]; total: number }> {
  const offset = (page - 1) * pageSize;

  const timeCondition: Record<string, string> = {
    all:   '',
    today: `AND date(createdAt) = date('now', 'localtime')`,
    week:  `AND createdAt >= datetime('now', '-7 days', 'localtime')`,
    month: `AND createdAt >= datetime('now', '-30 days', 'localtime')`,
  };

  const where = `WHERE 1=1 ${timeCondition[timeFilter] ?? ''}`;

  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) as total FROM activities ${where}`, (err, countRow: any) => {
      if (err) return reject(err);
      const total = countRow?.total ?? 0;

      db.all(
        `SELECT * FROM activities ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        [pageSize, offset],
        (err2, rows) => {
          if (err2) return reject(err2);
          resolve({ rows: rows ?? [], total });
        }
      );
    });
  });
}


// ---------------------------------------------------------------------------
// Helper: read latest config from disk so queue jobs use up-to-date settings
// ---------------------------------------------------------------------------
import { app as electronApp } from 'electron';

async function getLatestConfig(): Promise<any | null> {
  try {
    const configPath = path.join(electronApp.getPath('userData'), 'config.json');
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function isPathInsideFolder(filePath: string, folderPath: string): boolean {
  const relative = path.relative(path.resolve(folderPath), path.resolve(filePath));
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}
