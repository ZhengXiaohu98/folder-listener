import { useEffect, useState } from 'react';
import { ActivityList } from './ActivityList';
import { StatusCard } from './StatusCard';
import { StorageCard } from './StorageCard';
import { FolderOpen, FolderDown } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

export function Dashboard({ onTabChange }: { onTabChange: (tab: any) => void }) {
  const [isActive, setIsActive] = useState(false);
  const [sourceFolder, setSourceFolder] = useState<string>('');
  const [destFolder, setDestFolder] = useState<string>('');

  useEffect(() => {
    (window as any).watcherAPI.status().then(setIsActive);
    (window as any).ipcRenderer.invoke('get-config').then((config: any) => {
      if (config?.sourceFolder) setSourceFolder(config.sourceFolder);
      if (config?.destFolder) setDestFolder(config.destFolder);
    });
  }, []);

  const handleToggle = async () => {
    if (isActive) {
      const status = await (window as any).watcherAPI.stop();
      setIsActive(status);
    } else {
      const status = await (window as any).watcherAPI.start();
      setIsActive(status);
    }
  };

  const openFolder = (folder: string) => {
    if (folder) (window as any).watcherAPI.openFolder(folder);
  };

  const folderName = (p: string) => p ? p.split(/[\\/]/).pop() || p : '—';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex items-end justify-between pb-2">
        <div>
          <h1 className="text-3xl font-bold text-primary tracking-tight transition-colors">Overview</h1>
          <p className="text-secondary mt-1.5 font-medium transition-colors">Your workspace automation at a glance.</p>
        </div>

        <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm transition-colors', isActive ? 'border-success bg-success/10' : 'border-warning bg-warning/20')}>
          <div className={cn('w-2 h-2 rounded-full', isActive ? 'bg-success animate-pulse' : 'bg-tertiary')} />
          <span className={cn('text-xs font-semibold', isActive ? 'text-success' : 'text-tertiary')}>{isActive ? 'Running' : 'Paused'}</span>
        </div>
      </header>

      {/* Top Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatusCard isActive={isActive} onToggle={handleToggle} />
        <StorageCard />
      </div>

      {/* Animation Section */}
      <div className="bg-back-200 rounded-2xl p-8 border border-bc-100 flex items-center justify-center gap-8 relative overflow-hidden">

        {/* Watched Folder */}
        <button
          onClick={() => openFolder(sourceFolder)}
          title={sourceFolder || 'Watched Folder'}
          className="z-10 flex flex-col items-center gap-3 cursor-pointer hover:scale-105 transition-transform"
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center border border-bc-100 shadow-md bg-back-100">
            <FolderOpen className="w-8 h-8 text-secondary" />
          </div>
          <div className="text-center">
            <span className="block text-xs font-semibold text-secondary">Watched Folder</span>
            <span className="block text-[10px] text-secondary/60 max-w-[90px] truncate mt-0.5">{"("}{folderName(sourceFolder)}{")"}</span>
          </div>
        </button>

        {/* Animated path */}
        <div className="flex-1 max-w-[200px] h-[60px] relative flex items-center -translate-y-1/2">
          <svg viewBox="0 0 200 60" className="w-full h-full overflow-visible" preserveAspectRatio="none">
            <motion.path
              d="M 0 40 Q 100 0 200 40"
              fill="none"
              stroke={isActive ? "var(--color-accent)" : "var(--color-tertiary)"}
              strokeWidth={isActive ? 3 : 2}
              strokeDasharray="8 8"
              opacity={isActive ? 1 : 0.3}
              initial={{ strokeDashoffset: 16 }}
              animate={{ strokeDashoffset: isActive ? 0 : 16 }}
              transition={{ duration: isActive ? 0.5 : 0, repeat: isActive ? Infinity : 0, ease: "linear" }}
            />
          </svg>
        </div>

        {/* Magic / Dest Folder */}
        <button
          onClick={() => openFolder(destFolder)}
          title={destFolder || 'Magic Folder'}
          className="z-10 flex flex-col items-center gap-3 cursor-pointer hover:scale-105 transition-transform"
        >
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20 shadow-[0_0_15px_var(--color-accent)]">
            <FolderDown className="w-8 h-8 text-accent" />
          </div>
          <div className="text-center">
            <span className="block text-xs font-semibold text-accent">Magic Folder</span>
            <span className="block text-[10px] text-accent/60 max-w-[90px] truncate mt-0.5">{"("}{folderName(destFolder)}{")"}</span>
          </div>
        </button>
      </div>

      {/* Bottom Section */}
      <div className="pt-2">
        <ActivityList onTabChange={onTabChange} />
      </div>
    </div>
  );
}

