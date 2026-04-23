import { useState, useEffect, useRef, useCallback } from 'react';
import { ScrollText, Trash2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

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

const CATEGORY_LABELS: Record<string, string> = {
  'file-processing': 'File',
  hook: 'Hook',
  app: 'App',
  watcher: 'Watcher',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = LEVEL_CONFIG[entry.level];

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
            ? (expanded ? <ChevronDown className="w-4 h-4 text-tertiary" /> : <ChevronRight className="w-4 h-4 text-tertiary" />)
            : <span className="w-4" />
          }
        </div>

        {/* Dot */}
        <span className={cn('mt-1.5 w-2 h-2 rounded-full shrink-0', cfg.dot)} />

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-xs font-semibold uppercase tracking-wide', cfg.text)}>
              {CATEGORY_LABELS[entry.category] ?? entry.category}
            </span>
            <span className="text-sm text-primary font-medium leading-snug">{entry.message}</span>
          </div>
        </div>

        {/* Timestamp */}
        <span className="text-xs text-tertiary shrink-0 mt-0.5">{formatTime(entry.createdAt)}</span>
      </button>

      {/* Detail / Stack trace */}
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

const FILTER_OPTIONS: { label: string; value: LogLevel | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Errors', value: 'error' },
  { label: 'Warnings', value: 'warn' },
  { label: 'Success', value: 'success' },
  { label: 'Info', value: 'info' },
];

export function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const listRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async (p = 1, f = filter) => {
    setLoading(true);
    try {
      if ((window as any).ipcRenderer) {
        const result = await (window as any).ipcRenderer.invoke('logs:get', {
          page: p,
          pageSize: PAGE_SIZE,
          level: f,
        });
        setLogs(result.rows);
        setTotal(result.total);
        setPage(p);
      }
    } catch (err) {
      console.error('Failed to fetch logs', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchLogs(1, filter);
  }, [filter]);

  // Live push: listen for new log entries from the main process
  useEffect(() => {
    const handler = (_: any, entry: LogEntry) => {
      if (filter === 'all' || entry.level === filter) {
        setLogs(prev => [entry, ...prev]);
        setTotal(prev => prev + 1);
      }
    };

    if ((window as any).ipcRenderer) {
      (window as any).ipcRenderer.on('log-added', handler);
      return () => (window as any).ipcRenderer.off('log-added', handler);
    }
  }, [filter]);

  const handleClear = async () => {
    if (!confirm('Clear all logs? This cannot be undone.')) return;
    try {
      if ((window as any).ipcRenderer) {
        await (window as any).ipcRenderer.invoke('logs:clear');
        setLogs([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('Failed to clear logs', err);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 pb-10 h-full flex flex-col">
      {/* Header */}
      <header className="w-full flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <h1 className="text-3xl font-bold text-primary tracking-tight transition-colors">Logs</h1>
          <p className="text-secondary mt-1.5 font-medium transition-colors">
            Real-time activity from file processing, hooks, and the application.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLogs(page, filter)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-secondary border border-bc-100 rounded-xl hover:bg-back-300 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-500 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>
      </header>

      {/* Filter tabs */}
      <div className="flex gap-1 md:gap-1.5 bg-back-200 p-1 rounded-xl border border-bc-100 w-fit">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => { setFilter(opt.value); }}
            className={cn(
              'px-2 md:px-3 py-1 md:py-1.5 text-sm font-medium rounded-lg transition-all cursor-pointer',
              filter === opt.value
                ? 'bg-accent text-white shadow-sm'
                : 'text-secondary hover:text-primary hover:bg-back-300'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

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
            <h3 className="text-lg font-medium text-primary mb-1">No logs yet</h3>
            <p className="text-secondary text-sm">Activity will appear here as files are processed.</p>
          </div>
        ) : (
          <div ref={listRef} className="flex flex-col gap-2 overflow-y-auto pr-1">
            {logs.map(entry => <LogRow key={entry.id} entry={entry} />)}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-secondary">{total} entries total</span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => fetchLogs(page - 1, filter)}
              className="px-3 py-1.5 text-sm rounded-lg border border-bc-100 text-secondary hover:bg-back-300 disabled:opacity-40 transition-colors cursor-pointer"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 text-sm text-secondary">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => fetchLogs(page + 1, filter)}
              className="px-3 py-1.5 text-sm rounded-lg border border-bc-100 text-secondary hover:bg-back-300 disabled:opacity-40 transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
