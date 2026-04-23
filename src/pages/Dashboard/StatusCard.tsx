import { Play, Pause } from 'lucide-react';
import { cn } from '../../lib/utils';

export function StatusCard({ isActive, onToggle }: { isActive: boolean, onToggle: () => void }) {
  return (
    <div className="bg-back-200 rounded-2xl p-6 border shadow-(--shadow-soft) transition-all flex flex-col justify-between">
      <h3 className="text-lg font-semibold text-primary mb-2">System Control</h3>
      <p className="text-sm text-secondary leading-relaxed mb-6">
        {isActive ? 'The system is actively listening for new files.' : 'System is paused. Click start to resume processing.'}
      </p>

      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all cursor-pointer",
          isActive
            ? "bg-danger/10 text-danger hover:bg-danger/20 border border-danger/20"
            : "bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20",
        )}
      >
        {isActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        {isActive ? 'Pause' : 'Start Watching'}
      </button>
    </div>
  );
}
