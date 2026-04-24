import { useEffect, useState, useCallback } from 'react';
import { ActivityList } from './ActivityList';
import { StorageCard } from './StorageCard';
import { FolderOpen, FolderDown, Play, Pause, Radio } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { useI18n } from '../../i18n';

interface Pipeline {
  id: string;
  name: string;
  enabled: boolean;
  sourceFolder: string;
  destFolder: string;
}

export function Dashboard({ onTabChange }: { onTabChange: (tab: any) => void }) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, boolean>>({});
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const { t } = useI18n();

  const folderName = (p: string) => p ? p.split(/[\\/]/).pop() || p : '—';

  const loadData = useCallback(async () => {
    const [config, status] = await Promise.all([
      (window as any).ipcRenderer.invoke('get-config'),
      (window as any).watcherAPI.status(),
    ]);
    setPipelines(config?.pipelines ?? []);
    setStatusMap(status ?? {});
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggle = async (pipeline: Pipeline) => {
    const isRunning = statusMap[pipeline.id] ?? false;
    setTogglingId(pipeline.id);
    try {
      let newStatus: Record<string, boolean>;
      if (isRunning) {
        newStatus = await (window as any).watcherAPI.stopPipeline(pipeline.id);
      } else {
        newStatus = await (window as any).watcherAPI.startPipeline(pipeline.id);
      }
      setStatusMap(newStatus ?? {});
      // Reload pipelines to get latest enabled state
      const config = await (window as any).ipcRenderer.invoke('get-config');
      setPipelines(config?.pipelines ?? []);
    } finally {
      setTogglingId(null);
    }
  };

  const openFolder = (folder: string) => {
    if (folder) (window as any).watcherAPI.openFolder(folder);
  };

  const anyRunning = Object.values(statusMap).some(Boolean);
  const runningCount = Object.values(statusMap).filter(Boolean).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex items-end justify-between pb-2">
        <div>
          <h1 className="text-3xl font-bold text-primary tracking-tight transition-colors">{t('dashboard.title')}</h1>
          <p className="text-secondary mt-1.5 font-medium transition-colors">{t('dashboard.subtitle')}</p>
        </div>

        <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm transition-colors', anyRunning ? 'border-success bg-success/10' : 'border-warning bg-warning/20')}>
          <div className={cn('w-2 h-2 rounded-full', anyRunning ? 'bg-success animate-pulse' : 'bg-tertiary')} />
          <span className={cn('text-xs font-semibold', anyRunning ? 'text-success' : 'text-tertiary')}>
            {anyRunning ? t('dashboard.running', { count: runningCount }) : t('dashboard.paused')}
          </span>
        </div>
      </header>

      {/* Top Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Control — multi-pipeline */}
        <div className="bg-back-200 rounded-2xl p-6 border shadow-(--shadow-soft) transition-all flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <Radio className="w-4 h-4 text-accent" />
            <h3 className="text-lg font-semibold text-primary">{t('dashboard.systemControl')}</h3>
          </div>
          <p className="text-sm text-secondary leading-relaxed mb-5">
            {t('dashboard.systemControlDesc')}
          </p>

          {pipelines.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
              <p className="text-sm text-secondary">{t('dashboard.noPipelines')}</p>
              <button
                onClick={() => onTabChange('Settings')}
                className="mt-3 text-sm font-medium text-accent hover:opacity-80 transition-opacity cursor-pointer"
              >
                {t('dashboard.goToSettings')}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pipelines.map((pipeline) => {
                const isRunning = statusMap[pipeline.id] ?? false;
                const isToggling = togglingId === pipeline.id;
                return (
                  <div
                    key={pipeline.id}
                    className={cn(
                      'flex items-center justify-between px-4 py-3 rounded-xl border transition-all',
                      isRunning
                        ? 'border-success/30 bg-success/5'
                        : 'border-bc-100 bg-back-100'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn('w-2 h-2 rounded-full shrink-0', isRunning ? 'bg-success animate-pulse' : 'bg-tertiary/50')} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-primary truncate">{pipeline.name}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggle(pipeline)}
                      disabled={isToggling}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ml-3',
                        isRunning
                          ? 'bg-danger/10 text-danger hover:bg-danger/20 border border-danger/20'
                          : 'bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20',
                        isToggling && 'opacity-50 pointer-events-none'
                      )}
                    >
                      {isRunning
                        ? <><Pause className="w-3.5 h-3.5" /> {t('dashboard.pause')}</>
                        : <><Play className="w-3.5 h-3.5" /> {t('dashboard.start')}</>
                      }
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <StorageCard />
      </div>

      {/* Pipeline Flow Visualization */}
      {pipelines.length > 0 && (
        <div className="bg-back-200 rounded-2xl border border-bc-100 overflow-hidden">
          {/* Section header */}
          <div className="px-6 py-4 border-b border-bc-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary">{t('dashboard.pipelineFlows')}</h3>
            <span className="text-xs text-secondary">
              {t('dashboard.pipelineCount', { count: pipelines.length }).split('|')[pipelines.length !== 1 ? 1 : 0]?.trim() ?? `${pipelines.length}`}
            </span>
          </div>

          <div className="divide-y divide-bc-100">
            {pipelines.map((pipeline) => {
              const isRunning = statusMap[pipeline.id] ?? false;
              return (
                <div
                  key={pipeline.id}
                  className={cn(
                    'px-6 py-5 flex items-center gap-4 transition-colors',
                    isRunning ? 'bg-success/5' : 'bg-back-100/50'
                  )}
                >
                  {/* Pipeline label */}
                  <div className="w-28 shrink-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <div className={cn(
                        'w-1.5 h-1.5 rounded-full shrink-0',
                        isRunning ? 'bg-success animate-pulse' : 'bg-tertiary/40'
                      )} />
                      <span className="text-xs font-semibold text-primary truncate">{pipeline.name}</span>
                    </div>
                    <span className={cn(
                      'text-[10px] font-medium',
                      isRunning ? 'text-success' : 'text-tertiary'
                    )}>
                      {isRunning ? t('dashboard.statusRunning') : t('dashboard.statusPaused')}
                    </span>
                  </div>

                  {/* Source folder */}
                  <button
                    onClick={() => openFolder(pipeline.sourceFolder)}
                    title={pipeline.sourceFolder || t('pipeline.sourceFolder')}
                    disabled={!pipeline.sourceFolder}
                    className="flex flex-col items-center gap-1.5 cursor-pointer hover:scale-105 transition-transform disabled:opacity-40 disabled:pointer-events-none shrink-0"
                  >
                    <div className={cn(
                      'w-11 h-11 rounded-xl flex items-center justify-center border shadow-sm transition-all',
                      isRunning
                        ? 'border-accent/20 bg-accent/5'
                        : 'border-bc-100 bg-back-200'
                    )}>
                      <FolderOpen className={cn('w-5 h-5', isRunning ? 'text-accent' : 'text-secondary')} />
                    </div>
                    <span className="text-[9px] text-secondary/70 max-w-[64px] truncate font-mono leading-none">
                      {folderName(pipeline.sourceFolder) || '—'}
                    </span>
                  </button>

                  {/* Animated arrow */}
                  <div className="flex-1 h-10 relative flex items-center min-w-0">
                    <svg
                      viewBox="0 0 160 30"
                      className="w-full h-full overflow-visible -translate-y-1/5"
                      preserveAspectRatio="none"
                    >
                      <motion.path
                        d="M 0 15 Q 80 0 160 15"
                        fill="none"
                        stroke={isRunning ? 'var(--color-accent)' : 'var(--color-tertiary)'}
                        strokeWidth={1.5}
                        strokeDasharray="6 5"
                        opacity={isRunning ? 1 : 0.25}
                        initial={{ strokeDashoffset: 11 }}
                        animate={{ strokeDashoffset: isRunning ? 0 : 11 }}
                        transition={{
                          duration: isRunning ? 0.5 : 0,
                          repeat: isRunning ? Infinity : 0,
                          ease: 'linear',
                        }}
                      />
                    </svg>
                  </div>

                  {/* Dest folder */}
                  <button
                    onClick={() => openFolder(pipeline.destFolder)}
                    title={pipeline.destFolder || t('pipeline.destFolder')}
                    disabled={!pipeline.destFolder}
                    className="flex flex-col items-center gap-1.5 cursor-pointer hover:scale-105 transition-transform disabled:opacity-40 disabled:pointer-events-none shrink-0"
                  >
                    <div className={cn(
                      'w-11 h-11 rounded-xl flex items-center justify-center border transition-all',
                      isRunning
                        ? 'bg-accent/10 border-accent/30 shadow-[0_0_12px_var(--color-accent)]'
                        : 'border-bc-100 bg-back-200'
                    )}>
                      <FolderDown className={cn('w-5 h-5', isRunning ? 'text-accent' : 'text-secondary')} />
                    </div>
                    <span className="text-[9px] text-secondary/70 max-w-[64px] truncate font-mono leading-none">
                      {folderName(pipeline.destFolder) || '—'}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Section */}
      <div className="pt-2">
        <ActivityList onTabChange={onTabChange} />
      </div>
    </div>
  );
}
