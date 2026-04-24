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
  // Migration: add pipelineId column if not exists
  db.run(`ALTER TABLE activities ADD COLUMN pipelineId TEXT`, () => {});
  db.run(`ALTER TABLE activities ADD COLUMN pipelineName TEXT`, () => {});
});

// ---------------------------------------------------------------------------
// Pipeline type
// ---------------------------------------------------------------------------
export interface Pipeline {
  id: string;
  name: string;
  enabled: boolean;
  sourceFolder: string;
  destFolder: string;
  hookEnabled?: boolean;
  hookCode?: string;
  // Per-pipeline compression (optional for backward compat)
  compressionLevel?: string;
  customOptions?: { quality: number; maxWidth: number };
  supportedFormats?: { jpeg: boolean; png: boolean; webp: boolean; gif: boolean; svg: boolean; avif: boolean };
  advancedOptions?: {
    autoDelete: boolean;
    enableCustomSuffix: boolean;
    customSuffix: string;
    enableCustomFileName: boolean;
    customFileName: string;
  };
  outputFormat?: string;
}

// ---------------------------------------------------------------------------
// State — one FSWatcher per pipeline id
// ---------------------------------------------------------------------------
let mainWindow: any = null;
const watchers: Map<string, FSWatcher> = new Map();
const activePipelines: Map<string, Pipeline> = new Map();

// ---------------------------------------------------------------------------
// Concurrency Queue (shared across all pipelines)
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
const FORMAT_EXT_MAP: Record<string, string[]> = {
  jpeg: ['.jpg', '.jpeg'],
  png:  ['.png'],
  webp: ['.webp'],
  gif:  ['.gif'],
  svg:  ['.svg'],
  avif: ['.avif'],
};

const CONVERTIBLE_OUTPUT_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif']);

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

function randomSixDigits(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function resolveDestFilename(
  sourceFilename: string,
  sourceExt: string,
  destExt: string,
  advancedOptions: any
): string {
  const { enableCustomFileName, customFileName, enableCustomSuffix, customSuffix } = advancedOptions ?? {};
  const nameWithoutExt = path.basename(sourceFilename, sourceExt);

  if (enableCustomFileName && customFileName) {
    return `${customFileName}-${randomSixDigits()}${destExt}`;
  }

  const suffix = enableCustomSuffix ? (customSuffix ?? '-min') : '';
  return `${nameWithoutExt}${suffix}${destExt}`;
}

function resolveOutputFormat(
  sourceExt: string,
  outputFormatConfig: string
): { destExt: string; sharpFormat: string | null } {
  const srcFmt = sourceExt === '.jpg' ? 'jpeg' : sourceExt.replace('.', '');

  if (!outputFormatConfig || outputFormatConfig === 'Original') {
    if (['gif', 'svg'].includes(srcFmt)) {
      return { destExt: sourceExt, sharpFormat: null };
    }
    return { destExt: sourceExt, sharpFormat: srcFmt };
  }

  const target = outputFormatConfig.toLowerCase();

  if (!CONVERTIBLE_OUTPUT_FORMATS.has(target)) {
    console.warn(`[watcher] Cannot convert to "${outputFormatConfig}", keeping original format.`);
    return { destExt: sourceExt, sharpFormat: srcFmt === 'gif' || srcFmt === 'svg' ? null : srcFmt };
  }

  const extMap: Record<string, string> = { jpeg: '.jpg', png: '.png', webp: '.webp', avif: '.avif' };
  return { destExt: extMap[target], sharpFormat: target };
}

// ---------------------------------------------------------------------------
// Core processing
// ---------------------------------------------------------------------------
async function processFile(filePath: string, config: any, pipeline: Pipeline): Promise<void> {
  // Per-pipeline compression takes priority; fall back to global config for legacy setups
  const compressionLevel  = pipeline.compressionLevel  ?? config.compressionLevel  ?? 'Medium';
  const customOptions     = pipeline.customOptions     ?? config.customOptions     ?? { quality: 80, maxWidth: 1920 };
  const supportedFormats  = pipeline.supportedFormats  ?? config.supportedFormats  ?? {};
  const advancedOptions   = pipeline.advancedOptions   ?? config.advancedOptions   ?? {};
  const outputFormat      = pipeline.outputFormat      ?? config.outputFormat      ?? 'Original';

  const { sourceFolder, destFolder } = pipeline;

  if (sourceFolder && !isPathInsideFolder(filePath, sourceFolder)) return;
  if (!destFolder) return;

  const sourceExt = path.extname(filePath).toLowerCase();
  const allowedExts = buildAllowedExtensions(supportedFormats);

  if (!allowedExts.has(sourceExt)) return;

  const { destExt, sharpFormat } = resolveOutputFormat(sourceExt, outputFormat);
  const sourceFilename = path.basename(filePath);
  const destFilename = resolveDestFilename(sourceFilename, sourceExt, destExt, advancedOptions);
  await fs.mkdir(destFolder, { recursive: true });
  const destPath = path.join(destFolder, destFilename);

  const stat = await fs.stat(filePath);
  const originalSize = stat.size;

  const qualityMap: Record<string, number> = { Low: 90, Medium: 80, High: 50, Custom: customOptions.quality ?? 80 };
  const quality = qualityMap[compressionLevel] ?? 80;
  const maxWidth = compressionLevel === 'Custom' ? (customOptions.maxWidth ?? 1920) : undefined;

  if (sharpFormat === null) {
    await fs.copyFile(filePath, destPath);
  } else {
    let pipeline_sharp = sharp(filePath);

    if (maxWidth) {
      pipeline_sharp = pipeline_sharp.resize({ width: maxWidth, withoutEnlargement: true });
    }

    switch (sharpFormat) {
      case 'jpeg': pipeline_sharp = pipeline_sharp.jpeg({ quality }); break;
      case 'png':  pipeline_sharp = pipeline_sharp.png({ quality }); break;
      case 'webp': pipeline_sharp = pipeline_sharp.webp({ quality }); break;
      case 'avif': pipeline_sharp = pipeline_sharp.avif({ quality }); break;
      default:     pipeline_sharp = pipeline_sharp.jpeg({ quality });
    }

    await pipeline_sharp.toFile(destPath);
  }

  const newStat = await fs.stat(destPath);
  const compressedSize = newStat.size;

  if (advancedOptions.autoDelete) {
    try {
      await shell.trashItem(filePath);
    } catch {
      await fs.unlink(filePath);
    }
  }

  // Persist to DB with pipeline info
  await new Promise<void>((resolve, reject) => {
    db.run(
      `INSERT INTO activities (filename, originalSize, compressedSize, pipelineId, pipelineName) VALUES (?, ?, ?, ?, ?)`,
      [destFilename, originalSize, compressedSize, pipeline.id, pipeline.name],
      function (err) {
        if (err) return reject(err);
        if (mainWindow) {
          mainWindow.webContents.send('activity-added');
        }
        resolve();
      }
    );
  });

  // Execute Custom Hook (per-pipeline)
  if (pipeline.hookEnabled && pipeline.hookCode) {
    try {
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const hookFn = new AsyncFunction('require', 'file', 'config', pipeline.hookCode);
      const fileInfo = {
        name: destFilename,
        path: destPath,
        size: compressedSize,
        originalSize,
        originalPath: filePath
      };
      await hookFn(require, fileInfo, { ...config, ...pipeline });
      logger.success('hook', `[${pipeline.name}] Hook executed for "${destFilename}"`);
    } catch (hookErr: any) {
      logger.error('hook', `[${pipeline.name}] Hook failed for "${destFilename}"`, hookErr?.stack ?? String(hookErr));
    }
  }

  const savedKb = ((originalSize - compressedSize) / 1024).toFixed(1);
  const ratio = originalSize > 0 ? ((1 - compressedSize / originalSize) * 100).toFixed(1) : '0';
  logger.success(
    'file-processing',
    `[${pipeline.name}] Processed "${destFilename}" — saved ${savedKb} KB (${ratio}%)`,
    `Original: ${(originalSize / 1024).toFixed(1)} KB → Output: ${(compressedSize / 1024).toFixed(1)} KB`
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function setMainWindow(win: any) {
  mainWindow = win;
}

/** Start a single pipeline watcher. No-op if already running. */
export async function startPipelineWatcher(pipeline: Pipeline, config: any): Promise<void> {
  if (watchers.has(pipeline.id)) return;
  const { sourceFolder, destFolder } = pipeline;
  if (!sourceFolder || !destFolder) throw new Error(`Pipeline "${pipeline.name}": source or destination folder not set`);

  await fs.mkdir(destFolder, { recursive: true }).catch(() => {});
  activePipelines.set(pipeline.id, pipeline);

  const watcher = watch(sourceFolder, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 200 },
  });

  watcher.on('add', (filePath: string) => {
    enqueue(async () => {
      try {
        const latestConfig = await getLatestConfig();
        const latestPipelines = latestConfig?.pipelines as Pipeline[] | undefined;
        const latestPipeline = latestPipelines?.find(p => p.id === pipeline.id) ?? pipeline;
        await processFile(filePath, latestConfig ?? config, latestPipeline);
      } catch (err: any) {
        const name = path.basename(filePath);
        logger.error('file-processing', `[${pipeline.name}] Failed to process "${name}"`, err?.stack ?? String(err));
        console.error('[watcher] Error processing file:', filePath, err);
      }
    });
  });

  watchers.set(pipeline.id, watcher);
}

/** Stop a single pipeline watcher. */
export async function stopPipelineWatcher(pipelineId: string): Promise<void> {
  const watcher = watchers.get(pipelineId);
  if (watcher) {
    await watcher.close();
    watchers.delete(pipelineId);
  }
  activePipelines.delete(pipelineId);
}

/** Start all enabled pipelines. (Legacy entry-point) */
export async function startWatcher(config: any): Promise<void> {
  const pipelines: Pipeline[] = config.pipelines ?? [];
  for (const pipeline of pipelines) {
    if (pipeline.enabled && !watchers.has(pipeline.id)) {
      await startPipelineWatcher(pipeline, config);
    }
  }
}

/** Stop ALL pipeline watchers. */
export async function stopWatcher(): Promise<void> {
  for (const [id] of watchers) {
    await stopPipelineWatcher(id);
  }
}

/** Returns a map of { pipelineId -> isRunning } */
export function getWatcherStatus(): Record<string, boolean> {
  const status: Record<string, boolean> = {};
  for (const [id] of activePipelines) {
    status[id] = watchers.has(id);
  }
  // Also report pipelines that have watchers but may not be in activePipelines map
  for (const [id] of watchers) {
    status[id] = true;
  }
  return status;
}

/** Returns true if at least one watcher is running (backward compat). */
export function isAnyWatcherRunning(): boolean {
  return watchers.size > 0;
}

/** Apply updated config — reconcile running watchers with enabled pipelines. */
export async function applyWatcherConfig(config: any): Promise<void> {
  const pipelines: Pipeline[] = config.pipelines ?? [];

  // Stop watchers for pipelines that are now disabled or removed
  for (const [id] of watchers) {
    const pipeline = pipelines.find(p => p.id === id);
    if (!pipeline || !pipeline.enabled) {
      await stopPipelineWatcher(id);
    }
  }

  // Start / restart watchers for enabled pipelines
  for (const pipeline of pipelines) {
    if (!pipeline.enabled) continue;

    const existingWatcher = watchers.get(pipeline.id);
    const existingPipeline = activePipelines.get(pipeline.id);

    // If source folder changed, restart
    if (existingWatcher && existingPipeline && existingPipeline.sourceFolder !== pipeline.sourceFolder) {
      await stopPipelineWatcher(pipeline.id);
    }

    if (!watchers.has(pipeline.id)) {
      try {
        await startPipelineWatcher(pipeline, config);
      } catch (err: any) {
        logger.error('watcher', `Failed to start pipeline "${pipeline.name}"`, err?.stack ?? String(err));
      }
    } else {
      // Update in-memory pipeline config (dest folder, hook, etc.)
      activePipelines.set(pipeline.id, pipeline);
    }

    if (pipeline.destFolder) {
      await fs.mkdir(pipeline.destFolder, { recursive: true }).catch(() => {});
    }
  }
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
// Helper: read latest config from disk
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
