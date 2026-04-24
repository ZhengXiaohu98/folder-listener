import { useState, useEffect, useRef, useCallback } from 'react';
import { ScrollText, Trash2, RefreshCw, ChevronDown, ChevronRight, ArrowUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useI18n, type TranslationKey } from '../../i18n';

type LogLevel = 'success' | 'error' | 'warn' | 'info';

interface LogEntry {
  id: number;
  level: LogLevel;
  category: string;
  message: string;
  detail?: string;
  createdAt: string;
}

const LEVEL_CONFIG: Record<LogLevel, { label: string; dot: string; text: string; bg: string }> = {
  success: { label: 'Success', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/8 border-emerald-500/20' },
  error: { label: 'Error', dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/8 border-red-500/20' },
  warn: { label: 'Warning', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/8 border-amber-500/20' },
  info: { label: 'Info', dot: 'bg-sky-500', text: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500/8 border-sky-500/20' },
};

const CATEGORY_KEY_MAP: Record<string, TranslationKey> = {
  'file-processing': 'logCategory.file',
  hook: 'logCategory.hook',
  app: 'logCategory.app',
  watcher: 'logCategory.watcher',
};

/**
 * Extract pipeline name from "[PipelineName] message" pattern.
 */
function extractPipeline(message: string): { pipelineName: string | null; cleanMessage: string } {
  const match = message.match(/^\[([^\]]+)\]\s+(.+)$/);
  if (match) return { pipelineName: match[1], cleanMessage: match[2] };
  return { pipelineName: null, cleanMessage: message };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// LogRow — memoised to avoid re-render when sibling rows update
// ---------------------------------------------------------------------------
function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = LEVEL_CONFIG[entry.level];
  const { pipelineName, cleanMessage } = extractPipeline(entry.message);
  const { t } = useI18n();

  const categoryKey = CATEGORY_KEY_MAP[entry.category];
  const categoryLabel = categoryKey ? t(categoryKey) : entry.category;

  return (
    <div className={cn('border rounded-xl overflow-hidden transition-all', cfg.bg)}>
      <button
        onClick={() => entry.detail && setExpanded(!expanded)}
        className={cn(
          'w-full flex items-start gap-3 px-4 py-3 text-left',
          entry.detail ? 'cursor-pointer' : 'cursor-default'
        )}
      >
        {/* Expand icon */}
        <div className="mt-0.5 shrink-0 w-4">
          {entry.detail
            ? (expanded
              ? <ChevronDown className="w-4 h-4 text-tertiary" />
              : <ChevronRight className="w-4 h-4 text-tertiary" />)
            : <span className="w-4" />
          }
        </div>

        {/* Dot */}
        <span className={cn('mt-1.5 w-2 h-2 rounded-full shrink-0', cfg.dot)} />

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-xs font-semibold uppercase tracking-wide', cfg.text)}>
              {categoryLabel}
            </span>
            {pipelineName && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-accent/10 text-accent border border-accent/20">
                {pipelineName}
              </span>
            )}
            <span className="text-sm text-primary font-medium leading-snug">{cleanMessage}</span>
          </div>
        </div>

        {/* Timestamp */}
        <span className="text-xs text-tertiary shrink-0 mt-0.5">{formatTime(entry.createdAt)}</span>
      </button>

      {expanded && entry.detail && (
        <div className="px-4 pb-3 pt-0">
          <pre className="text-xs text-secondary font-mono whitespace-pre-wrap bg-back-100 rounded-lg p-3 border border-bc-100 leading-relaxed overflow-auto max-h-48">
            {entry.detail}
          </pre>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LogsPage
// ---------------------------------------------------------------------------
const PAGE_SIZE = 50;

export function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const [page, setPage] = useState(1);
  // Count of new entries that arrived while the user is NOT on page 1
  const [newCount, setNewCount] = useState(0);
  const { t } = useI18n();

  // Keep a ref so the live-push handler can read the current page without
  // being in its own dependency array (avoids re-registering the listener on
  // every page change).
  const pageRef = useRef(page);
  const filterRef = useRef(filter);
  pageRef.current = page;
  filterRef.current = filter;

  const listRef = useRef<HTMLDivElement>(null);

  const FILTER_OPTIONS: { labelKey: TranslationKey; value: LogLevel | 'all' }[] = [
    { labelKey: 'logs.filterAll', value: 'all' },
    { labelKey: 'logs.filterErrors', value: 'error' },
    { labelKey: 'logs.filterWarnings', value: 'warn' },
    { labelKey: 'logs.filterSuccess', value: 'success' },
    { labelKey: 'logs.filterInfo', value: 'info' },
  ];

  // ── Fetch a specific page ──────────────────────────────────────────────
  const fetchLogs = useCallback(async (p: number, f: LogLevel | 'all') => {
    setLoading(true);
    try {
      if ((window as any).ipcRenderer) {
        const result = await (window as any).ipcRenderer.invoke('logs:get', {
          page: p,
          pageSize: PAGE_SIZE,
          level: f,
        });
        setLogs(result.rows ?? []);
        setTotal(result.total ?? 0);
        setPage(p);
        setNewCount(0);
        // Scroll list back to top on page change
        listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Failed to fetch logs', err);
    } finally {
      setLoading(false);
    }
  }, []); // stable — no external deps

  // Re-fetch from page 1 whenever the filter changes
  useEffect(() => {
    fetchLogs(1, filter);
  }, [filter, fetchLogs]);

  // ── Live push ─────────────────────────────────────────────────────────
  // Only mutates the visible list when the user is on page 1.
  // Caps the array at PAGE_SIZE so memory stays bounded.
  // When the user is on a later page, increments a badge counter instead.
  useEffect(() => {
    const handler = (_: any, entry: LogEntry) => {
      const f = filterRef.current;
      if (f !== 'all' && entry.level !== f) return; // not matching current filter

      setTotal(prev => prev + 1);

      if (pageRef.current === 1) {
        setLogs(prev => {
          const next = [entry, ...prev];
          // Hard cap: drop oldest entries beyond PAGE_SIZE to prevent memory growth
          return next.length > PAGE_SIZE ? next.slice(0, PAGE_SIZE) : next;
        });
      } else {
        // User is browsing history — don't disturb the list, just badge
        setNewCount(prev => prev + 1);
      }
    };

    const ipc = (window as any).ipcRenderer;
    if (!ipc) return;
    ipc.on('log-added', handler);
    return () => ipc.off('log-added', handler);
  }, []); // intentionally empty — reads filter/page via refs

  // ── Actions ───────────────────────────────────────────────────────────
  const handleClear = async () => {
    if (!confirm(t('logs.clearConfirm'))) return;
    try {
      if ((window as any).ipcRenderer) {
        await (window as any).ipcRenderer.invoke('logs:clear');
        setLogs([]);
        setTotal(0);
        setNewCount(0);
        setPage(1);
      }
    } catch (err) {
      console.error('Failed to clear logs', err);
    }
  };

  const handleJumpToLatest = () => {
    setNewCount(0);
    fetchLogs(1, filterRef.current);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-4 h-full flex flex-col">
      {/* Header */}
      <header className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary tracking-tight transition-colors">{t('logs.title')}</h1>
          <p className="text-secondary mt-1.5 font-medium transition-colors">
            {t('logs.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => fetchLogs(page, filter)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-secondary border border-bc-100 rounded-xl hover:bg-back-300 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            {t('logs.refresh')}
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-500 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            {t('logs.clear')}
          </button>
        </div>
      </header>

      {/* Filter tabs */}
      <div className="flex gap-1 md:gap-1.5 bg-back-200 p-1 rounded-xl border border-bc-100 w-fit">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={cn(
              'px-2 md:px-3 py-1 md:py-1.5 text-sm font-medium rounded-lg transition-all cursor-pointer',
              filter === opt.value
                ? 'bg-accent text-white shadow-sm'
                : 'text-secondary hover:text-primary hover:bg-back-300'
            )}
          >
            {t(opt.labelKey)}
          </button>
        ))}
      </div>

      {/* "New entries" banner — shown when the user is on page > 1 and live logs arrived */}
      {newCount > 0 && (
        <button
          onClick={handleJumpToLatest}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-accent/10 border border-accent/30 text-accent text-sm font-semibold hover:bg-accent/20 transition-colors cursor-pointer animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <ArrowUp className="w-4 h-4" />
          {t('logs.newEntries', { count: newCount }).split('|')[newCount !== 1 ? 1 : 0]?.trim() ?? `${newCount}`}
        </button>
      )}

      {/* Log list */}
      <div className="flex-1 flex flex-col min-h-0">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center bg-back-200/50 border border-bc-100 border-dashed rounded-2xl p-12">
            <div className="w-16 h-16 rounded-full bg-back-100 border border-bc-100 flex items-center justify-center mb-4">
              <ScrollText className="w-7 h-7 text-tertiary" />
            </div>
            <h3 className="text-lg font-medium text-primary mb-1">{t('logs.noLogs')}</h3>
            <p className="text-secondary text-sm">{t('logs.noLogsDesc')}</p>
          </div>
        ) : (
          <div ref={listRef} className="flex flex-col gap-2 overflow-y-auto pr-1">
            {logs.map(entry => <LogRow key={entry.id} entry={entry} />)}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm text-secondary">
            {t('logs.entriesTotal', { count: total.toLocaleString() })}
            {page > 1 && newCount > 0 && (
              <span className="ml-2 text-accent text-xs font-medium">{t('logs.newBadge', { count: newCount })}</span>
            )}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => fetchLogs(page - 1, filter)}
              className="px-3 py-1.5 text-sm rounded-lg border border-bc-100 text-secondary hover:bg-back-300 disabled:opacity-40 transition-colors cursor-pointer"
            >
              {t('logs.previous')}
            </button>
            <span className="px-3 py-1.5 text-sm text-secondary tabular-nums">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => fetchLogs(page + 1, filter)}
              className="px-3 py-1.5 text-sm rounded-lg border border-bc-100 text-secondary hover:bg-back-300 disabled:opacity-40 transition-colors cursor-pointer"
            >
              {t('logs.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
