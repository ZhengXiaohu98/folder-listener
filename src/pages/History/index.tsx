import { useState, useEffect, useCallback } from 'react';
import { Image as ImageIcon, ChevronLeft, ChevronRight, CalendarDays, LayoutList } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + (dateStr.endsWith('Z') ? '' : 'Z'));
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  return d.toLocaleDateString();
}

function getSavingsPct(original: number, compressed: number) {
  if (!original || original === 0) return 0;
  return Math.round(((original - compressed) / original) * 100);
}

function SavingsBadge({ pct }: { pct: number }) {
  const color =
    pct >= 70 ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
      pct >= 40 ? 'bg-green-500/15 text-green-400 border border-green-500/30' :
        pct >= 15 ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30' :
          'bg-back-300 text-secondary border border-bc-100';
  return (
    <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums', color)}>
      -{pct}%
    </span>
  );
}

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
const TIME_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'Last 30 Days' },
];

export function History() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [loading, setLoading] = useState(true);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await (window as any).watcherAPI.getActivitiesPaged({ page, pageSize, timeFilter });
      setRows(result.rows ?? []);
      setTotal(result.total ?? 0);
    } catch (err) {
      console.error('Failed to fetch activities', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, timeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Live update when new activity added
  useEffect(() => {
    const cleanup = (window as any).watcherAPI.onActivityAdded(() => fetchData());
    return cleanup;
  }, [fetchData]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [pageSize, timeFilter]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-primary">Activity History</h2>
        <p className="text-sm text-secondary mt-1">Review recently processed and optimised files.</p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Time filter pills */}
        <div className="flex items-center gap-1 bg-back-200 border border-bc-100 rounded-xl p-1">
          <CalendarDays className="w-4 h-4 text-secondary mx-2 shrink-0" />
          {TIME_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTimeFilter(opt.value as any)}
              className={cn(
                'px-1.5 py-1 md:px-3 md:py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
                timeFilter === opt.value
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-secondary hover:text-primary hover:bg-back-300'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Page size selector */}
        <div className="flex items-center gap-2 bg-back-200 border border-bc-100 rounded-xl px-3 py-1.5">
          <LayoutList className="w-4 h-4 text-secondary shrink-0" />
          <span className="text-xs text-secondary font-medium">Per page:</span>
          <div className="flex gap-1">
            {PAGE_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                onClick={() => setPageSize(size)}
                className={cn(
                  'px-2 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer',
                  pageSize === size
                    ? 'bg-accent text-white'
                    : 'text-secondary hover:text-primary hover:bg-back-300'
                )}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Result count */}
        <span className="text-xs text-secondary ml-auto">
          {total} {total === 1 ? 'file' : 'files'} total
        </span>
      </div>

      {/* Table */}
      <div className="bg-back-200 border border-bc-100 rounded-2xl overflow-hidden shadow-(--shadow-soft)">
        {/* Table header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-3 border-b border-bc-100 bg-back-100">
          {['Filename', 'Date', 'Original Size', 'Compressed', 'Savings'].map((h) => (
            <div key={h} className="text-[11px] font-bold text-secondary uppercase tracking-widest line-clamp-1">{h}</div>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-bc-100/60">
          {loading && (
            <div className="p-10 text-center text-secondary text-sm animate-pulse">
              Loading…
            </div>
          )}

          {!loading && rows.length === 0 && (
            <div className="p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-back-100 border border-bc-100 mx-auto flex items-center justify-center mb-4">
                <ImageIcon className="w-6 h-6 text-secondary opacity-50" />
              </div>
              <p className="text-secondary text-sm">No activity found for this filter.</p>
            </div>
          )}

          {!loading && rows.map((item) => {
            const saved = item.originalSize - item.compressedSize;
            const pct = getSavingsPct(item.originalSize, item.compressedSize);
            const ext = item.filename?.split('.').pop()?.toUpperCase() ?? 'IMG';

            return (
              <div
                key={item.id}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 md:gap-4 p-4 items-center hover:bg-back-300/50 transition-colors group"
              >
                {/* Filename */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-accent">{ext}</span>
                  </div>
                  <p className="min-w-0 text-sm font-medium text-primary truncate group-hover:text-accent transition-colors">
                    {item.filename}
                  </p>
                </div>

                {/* Date */}
                <div className="text-xs md:text-sm text-secondary">{formatDate(item.createdAt)}</div>

                {/* Original */}
                <div className="text-xs md:text-sm text-primary font-medium tabular-nums">{formatBytes(item.originalSize)}</div>

                {/* Compressed */}
                <div className="text-xs md:text-sm text-primary font-medium tabular-nums">{formatBytes(item.compressedSize)}</div>

                {/* Savings */}
                <div className="flex items-center gap-2">
                  <SavingsBadge pct={pct} />
                  <span className="text-xs text-secondary hidden xl:block">{formatBytes(saved)} saved</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination footer */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-bc-100 bg-back-100">
            <span className="text-xs text-secondary">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className={cn(
                  'p-1.5 rounded-lg transition-all',
                  page === 1
                    ? 'text-secondary/30 cursor-not-allowed'
                    : 'text-secondary hover:text-primary hover:bg-back-300'
                )}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page number pills */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                .reduce<(number | '...')[]>((acc, n, idx, arr) => {
                  if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push('...');
                  acc.push(n);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-1 text-secondary text-xs">…</span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setPage(item as number)}
                      className={cn(
                        'w-7 h-7 text-xs font-semibold rounded-lg transition-all cursor-pointer',
                        page === item
                          ? 'bg-accent text-white'
                          : 'text-secondary hover:text-primary hover:bg-back-300'
                      )}
                    >
                      {item}
                    </button>
                  )
                )}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={cn(
                  'p-1.5 rounded-lg transition-all',
                  page === totalPages
                    ? 'text-secondary/30 cursor-not-allowed'
                    : 'text-secondary hover:text-primary hover:bg-back-300'
                )}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
