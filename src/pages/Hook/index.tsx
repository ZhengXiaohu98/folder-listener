import { useState, useEffect, useRef } from 'react';
import { Webhook, Save, Power, PowerOff, Code } from 'lucide-react';
import { cn } from '../../lib/utils';
import Editor from '@monaco-editor/react';

const DEFAULT_HOOK_CODE = `// This function is executed after a file is successfully processed.
// You have access to the 'file' object and Node.js 'require'.
// file = { name, path, size, originalSize, originalPath }

const fs = require('fs');
const path = require('path');

// Example: Upload to CMS
// IMPORTANT: Always pass { type: mimeType } to Blob, otherwise Strapi won't generate previews.
// const extToMime = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif' };
// const mimeType = extToMime[path.extname(file.name).toLowerCase()] || 'application/octet-stream';
// const formData = new FormData();
// formData.append('files', new Blob([fs.readFileSync(file.path)], { type: mimeType }), file.name);
// await fetch('https://your-cms.com/api/upload', { method: 'POST', body: formData });

// TIP: If you catch errors inside your hook, re-throw them so they appear in the Logs page.
// } catch (err) { console.error(err); throw err; }

console.log("File processed:", file.name);
`;

export function HookPage() {
  const [hookEnabled, setHookEnabled] = useState(false);
  const [hookCode, setHookCode] = useState(DEFAULT_HOOK_CODE);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [editorTheme, setEditorTheme] = useState('light');

  useEffect(() => {
    // Detect app theme for Monaco Editor
    const checkTheme = () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      setEditorTheme(isDark ? 'vs-dark' : 'light');
    };

    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        if ((window as any).ipcRenderer) {
          const config = await (window as any).ipcRenderer.invoke('get-config');
          if (config.hookEnabled !== undefined) setHookEnabled(config.hookEnabled);
          if (config.hookCode) setHookCode(config.hookCode);
        }
      } catch (err) {
        console.error('Failed to load hook config', err);
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  const handleCodeChange = (value: string | undefined) => {
    const newCode = value || '';
    setHookCode(newCode);

    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        if ((window as any).ipcRenderer) {
          await (window as any).ipcRenderer.invoke('set-config', { hookCode: newCode });
        }
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err) {
        console.error('Failed to auto-save hook config', err);
        setSaveStatus('idle');
      }
    }, 1000);
  };

  const toggleHook = () => {
    const newVal = !hookEnabled;
    setHookEnabled(newVal);
    // Auto save on toggle
    if ((window as any).ipcRenderer) {
      (window as any).ipcRenderer.invoke('set-config', { hookEnabled: newVal });
    }
  };

  if (loading) return <div className="h-full flex items-center justify-center animate-pulse text-secondary">Loading...</div>;

  return (
    <div className="space-y-8 pb-10 h-full flex flex-col">
      <header className="pb-2 flex md:flex-row flex-col md:items-center justify-between gap-4 md:gap-10">
        <div>
          <h1 className="text-3xl font-bold text-primary tracking-tight transition-colors">Post-Process Hook</h1>
          <p className="text-secondary mt-1.5 font-medium transition-colors">
            Execute custom JavaScript after each file is processed. Connect to your CMS or custom APIs.
          </p>
        </div>

        <button
          onClick={toggleHook}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all shadow-sm cursor-pointer shrink-0 text-sm w-fit",
            hookEnabled
              ? "bg-accent text-white shadow-(--shadow-soft) hover:shadow-md hover:bg-accent/90"
              : "bg-back-200 text-secondary border border-bc-100 hover:bg-back-300"
          )}
        >
          {hookEnabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
          {hookEnabled ? 'Hook Enabled' : 'Hook Disabled'}
        </button>
      </header>

      {hookEnabled && (
        <div className="flex-1 flex flex-col bg-back-200 border border-bc-100 rounded-2xl overflow-hidden shadow-sm animate-in slide-in-from-bottom-4 duration-300 min-h-[500px]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-bc-100 bg-back-100">
            <div className="flex items-center gap-2 text-sm font-medium text-secondary">
              <Code className="w-4 h-4 text-accent" />
              <span>Hook Function Body (async)</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium h-7">
              {saveStatus === 'saving' && <span className="text-tertiary animate-pulse">Saving...</span>}
              {saveStatus === 'saved' && <span className="text-accent flex items-center gap-1"><Save className="w-3.5 h-3.5" /> Auto-saved</span>}
            </div>
          </div>

          <div className="flex-1 relative group">
            <div className="absolute inset-0">
              <Editor
                height="100%"
                defaultLanguage="javascript"
                theme={editorTheme}
                value={hookCode}
                onChange={handleCodeChange}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', Courier, monospace",
                  wordWrap: 'on',
                  formatOnPaste: true,
                  padding: { top: 16, bottom: 16 },
                  scrollBeyondLastLine: false,
                  lineNumbers: 'on',
                  tabSize: 2,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {!hookEnabled && (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-back-200/50 border border-bc-100 border-dashed rounded-2xl min-h-[400px]">
          <div className="w-16 h-16 rounded-full bg-back-100 border border-bc-100 flex items-center justify-center mb-4 shadow-sm">
            <Webhook className="w-8 h-8 text-tertiary" />
          </div>
          <h3 className="text-lg font-medium text-primary mb-2">Enable Hooks to write custom logic</h3>
          <p className="text-secondary max-w-md">
            Click the button above to expose an editable JavaScript function that runs every time a file finishes processing.
          </p>
        </div>
      )}
    </div>
  );
}
