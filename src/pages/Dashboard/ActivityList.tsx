import { useEffect, useState } from 'react';
import { Image as ImageIcon, ArrowDown } from 'lucide-react';

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function ActivityList({ onTabChange }: { onTabChange: (tab: string) => void }) {
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    (window as any).watcherAPI.getActivities().then(setActivities);

    const cleanup = (window as any).watcherAPI.onActivityAdded(() => {
      (window as any).watcherAPI.getActivities().then(setActivities);
    });
    return cleanup;
  }, []);

  return (
    <div className="bg-back-200 rounded-2xl border border-bc-100 shadow-(--shadow-soft) overflow-hidden transition-all">
      <div className="px-6 py-4 flex items-center justify-between border-b border-bc-100">
        <h3 className="text-lg font-semibold text-primary">Recent Activity</h3>
        <button
          onClick={() => onTabChange('Logs')}
          className="text-sm font-semibold text-accent hover:opacity-80 transition-opacity cursor-pointer"
        >
          View Logs →
        </button>
      </div>

      <div className="divide-y divide-bc-100">
        {activities.length === 0 && (
          <div className="p-6 text-center text-secondary text-sm">
            No recent activity. Start a pipeline to process files.
          </div>
        )}
        {activities.slice(0, 5).map((item) => {
          const savedSize = item.originalSize - item.compressedSize;
          return (
            <div key={item.id} className="p-4 px-6 flex items-center justify-between hover:bg-back-300 transition-colors group cursor-default gap-2">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-back-300 border border-bc-100">
                  <ImageIcon className="w-5 h-5 text-success" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-medium text-primary group-hover:text-accent transition-colors line-clamp-1">{item.filename}</h4>
                  {item.pipelineName && (
                    <span className="text-[10px] text-secondary/70 font-medium">{item.pipelineName}</span>
                  )}
                </div>
              </div>

              <div className="text-right min-w-20 shrink-0">
                <div className="text-sm font-medium text-primary">{formatBytes(item.compressedSize)}</div>
                <div className="text-xs font-medium text-success mt-0.5 flex items-center justify-end gap-1">
                  <ArrowDown className="w-3 h-3" />
                  {formatBytes(savedSize)} saved
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
