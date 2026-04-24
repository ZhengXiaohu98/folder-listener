import { useState, useEffect, useCallback } from 'react';
import { Plus, Layers } from 'lucide-react';
import { AppearanceSettings } from './AppearanceSettings';
import { PipelineCard, type Pipeline } from './PipelineCard';
import { DEFAULT_COMPRESSION } from './CompressionPanel';
import { useI18n } from '../../i18n';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateId() {
  return `pipeline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function createNewPipeline(index: number): Pipeline {
  return {
    id: generateId(),
    name: `Pipeline ${index}`,
    enabled: false,
    sourceFolder: '',
    destFolder: '',
    hookEnabled: false,
    hookCode: '',
    ...DEFAULT_COMPRESSION,
  };
}

// ---------------------------------------------------------------------------
// Settings Page
// ---------------------------------------------------------------------------
export function Settings() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorTheme, setEditorTheme] = useState('light');
  const { t } = useI18n();

  // Detect app theme for Monaco Editor
  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      setEditorTheme(isDark ? 'vs-dark' : 'light');
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Load pipelines from config
  const load = useCallback(async () => {
    try {
      if ((window as any).ipcRenderer) {
        const config = await (window as any).ipcRenderer.invoke('get-config');
        // Hydrate any old pipelines missing compression fields
        const hydrated = (config?.pipelines ?? []).map((p: any) => ({
          ...DEFAULT_COMPRESSION,
          ...p,
        }));
        setPipelines(hydrated);
      }
    } catch (err) {
      console.error('Failed to load config', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if ((window as any).watcherAPI?.onStatusUpdated) {
      return (window as any).watcherAPI.onStatusUpdated(() => {
        load();
      });
    }
  }, [load]);

  // Persist pipelines whenever they change
  const savePipelines = useCallback(async (updated: Pipeline[]) => {
    try {
      if ((window as any).ipcRenderer) {
        await (window as any).ipcRenderer.invoke('set-config', { pipelines: updated });
      }
    } catch (err) {
      console.error('Failed to save pipelines', err);
    }
  }, []);

  const handleUpdate = useCallback((updated: Pipeline) => {
    setPipelines(prev => {
      const next = prev.map(p => p.id === updated.id ? updated : p);
      savePipelines(next);
      return next;
    });
  }, [savePipelines]);

  const handleDelete = useCallback((id: string) => {
    if (!confirm(t('settings.deletePipelineConfirm'))) return;
    setPipelines(prev => {
      const next = prev.filter(p => p.id !== id);
      savePipelines(next);
      return next;
    });
  }, [savePipelines, t]);

  const handleAdd = useCallback(() => {
    setPipelines(prev => {
      const next = [...prev, createNewPipeline(prev.length + 1)];
      savePipelines(next);
      return next;
    });
  }, [savePipelines]);

  return (
    <div className="space-y-10 pb-4">
      {/* Header */}
      <header className="pb-2">
        <h1 className="text-3xl font-bold text-primary tracking-tight transition-colors">{t('settings.title')}</h1>
        <p className="text-secondary mt-1.5 font-medium transition-colors">
          {t('settings.subtitle')}
        </p>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Pipeline Configuration                                              */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-bold text-primary">{t('settings.pipelines')}</h2>
            <span className="text-sm font-semibold px-3 py-1 rounded-full bg-accent/10 text-accent border border-accent/20 ml-1">
              {pipelines.length}
            </span>
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent/90 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t('settings.newPipeline')}
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-16 rounded-2xl bg-back-200 border border-bc-100 animate-pulse" />
            ))}
          </div>
        ) : pipelines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-bc-100 border-dashed rounded-2xl bg-back-200/50">
            <div className="w-16 h-16 rounded-full bg-back-100 border border-bc-100 flex items-center justify-center mb-4">
              <Layers className="w-7 h-7 text-tertiary" />
            </div>
            <h3 className="text-lg font-semibold text-primary mb-1">{t('settings.noPipelinesTitle')}</h3>
            <p className="text-secondary text-sm mb-5 max-w-xs">
              {t('settings.noPipelinesDesc')}
            </p>
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent/90 transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {t('settings.createFirst')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {pipelines.map((pipeline, index) => (
              <PipelineCard
                key={pipeline.id}
                pipeline={pipeline}
                index={index}
                editorTheme={editorTheme}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}

            <button
              onClick={handleAdd}
              className="w-full py-3.5 rounded-2xl border border-bc-100 border-dashed text-sm font-medium text-secondary hover:text-accent hover:border-accent/40 hover:bg-accent/5 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('settings.addAnother')}
            </button>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Appearance Settings                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="flex items-center gap-2 mb-5">
          <h2 className="text-xl font-bold text-primary">{t('settings.appearance')}</h2>
        </div>
        <AppearanceSettings />
      </section>
    </div>
  );
}
