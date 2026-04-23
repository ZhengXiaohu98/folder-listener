import { useEffect, useState } from 'react';

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function StorageCard() {
  const [stats, setStats] = useState({ totalSaved: 0, totalFiles: 0 });

  useEffect(() => {
    (window as any).watcherAPI.getStats().then(setStats);

    // Listen for new activities to update stats
    const cleanup = (window as any).watcherAPI.onActivityAdded(() => {
      (window as any).watcherAPI.getStats().then(setStats);
    });
    return cleanup;
  }, []);

  const savedSize = formatBytes(stats.totalSaved || 0);
  const sizeValue = savedSize.split(' ')[0];
  const sizeUnit = savedSize.split(' ')[1] || 'B';

  return (
    <div className="bg-back-200 rounded-2xl p-6 border border-bc-100 shadow-(--shadow-soft) flex flex-col transition-all">
      <h3 className="text-lg font-semibold text-primary mb-6">Storage Saved</h3>

      <div className="flex items-baseline justify-center gap-2 mb-8 text-center text-accent">
        <span className="text-5xl font-bold tracking-tight">{sizeValue}</span>
        <span className="text-xl font-semibold">{sizeUnit}</span>
      </div>

      <div className="mt-auto">
        <div className="flex items-center text-sm font-semibold gap-2">
          <span className="text-secondary">Processed Files: </span>
          <span className="text-secondary">{stats.totalFiles}</span>
        </div>
      </div>
    </div>
  );
}
