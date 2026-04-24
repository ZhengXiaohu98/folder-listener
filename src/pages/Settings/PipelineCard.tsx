import { useState, useRef } from 'react';
import {
  FolderOpen, MessageCircleWarning, Webhook, Save,
  Power, PowerOff, Code, ChevronDown, ChevronUp, Trash2, Pencil, Check, X, Settings2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import Editor from '@monaco-editor/react';
import { CompressionPanel, type CompressionValues } from './CompressionPanel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface Pipeline {
  id: string;
  name: string;
  enabled: boolean;
  sourceFolder: string;
  destFolder: string;
  hookEnabled?: boolean;
  hookCode?: string;
  // Per-pipeline compression
  compressionLevel: string;
  customOptions: { quality: number; maxWidth: number };
  supportedFormats: { jpeg: boolean; png: boolean; webp: boolean; gif: boolean; svg: boolean; avif: boolean };
  advancedOptions: {
    autoDelete: boolean;
    enableCustomSuffix: boolean;
    customSuffix: string;
    enableCustomFileName: boolean;
    customFileName: string;
  };
  outputFormat: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isDestInsideSource(src: string, dest: string): boolean {
  if (!src || !dest) return false;
  const normalise = (p: string) => (p.endsWith('/') || p.endsWith('\\') ? p : p + '/');
  return normalise(dest).startsWith(normalise(src));
}

const DEFAULT_HOOK_CODE = `// This function is executed after a file is successfully processed.
// You have access to the 'file' object and Node.js 'require'.
// file = { name, path, size, originalSize, originalPath }

const fs = require('fs');
const path = require('path');

// Example: Upload to CMS
// const formData = new FormData();
// formData.append('files', new Blob([fs.readFileSync(file.path)], { type: 'image/jpeg' }), file.name);
// await fetch('https://your-cms.com/api/upload', { method: 'POST', body: formData });

console.log("File processed:", file.name);
`;

// ---------------------------------------------------------------------------
// FolderInput
// ---------------------------------------------------------------------------
function FolderInput({ value, onChange, onBrowse }: { value: string; onChange: (v: string) => void; onBrowse: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 flex items-center gap-2 px-3 py-2 border border-bc-100 rounded-lg focus-within:ring-1 ring-accent transition-all bg-back-100">
        <FolderOpen className="w-3.5 h-3.5 text-tertiary shrink-0" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none font-mono text-xs placeholder:text-tertiary text-primary"
          placeholder="Select a folder..."
        />
      </div>
      <button
        onClick={onBrowse}
        className="px-3 py-2 border border-bc-100 bg-back-200 hover:bg-back-300 rounded-lg text-xs font-medium text-primary transition-colors cursor-pointer shrink-0"
      >
        Browse
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible Section wrapper
// ---------------------------------------------------------------------------
function CollapsibleSection({
  icon, title, badge, expanded, onToggle, children, headerExtra,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
}) {
  return (
    <section className="border border-bc-100 rounded-xl overflow-hidden">
      <div
        className={cn(
          'flex items-center justify-between px-4 py-3 cursor-pointer transition-colors select-none',
          expanded ? 'bg-back-300' : 'bg-back-200 hover:bg-back-300'
        )}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          {icon}
          {title}
          {badge}
        </div>
        <div className="flex items-center gap-2">
          {headerExtra}
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-secondary" /> : <ChevronDown className="w-3.5 h-3.5 text-secondary" />}
        </div>
      </div>
      {expanded && (
        <div className="px-4 py-4 bg-back-100 border-t border-bc-100 animate-in fade-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// PipelineCard
// ---------------------------------------------------------------------------
interface PipelineCardProps {
  pipeline: Pipeline;
  index: number;
  editorTheme: string;
  onUpdate: (updated: Pipeline) => void;
  onDelete: (id: string) => void;
}

export function PipelineCard({ pipeline, index, editorTheme, onUpdate, onDelete }: PipelineCardProps) {
  const [expanded, setExpanded] = useState(index === 0);
  const [foldersExpanded, setFoldersExpanded] = useState(true);
  const [compressionExpanded, setCompressionExpanded] = useState(false);
  const [hookExpanded, setHookExpanded] = useState(false);
  const [destError, setDestError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(pipeline.name);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const update = (partial: Partial<Pipeline>) => {
    onUpdate({ ...pipeline, ...partial });
  };

  // ---- Folder handling ----
  const handleBrowse = async (type: 'source' | 'dest') => {
    const folderPath = await (window as any).ipcRenderer.invoke('select-folder');
    if (!folderPath) return;
    if (type === 'dest') {
      if (isDestInsideSource(pipeline.sourceFolder, folderPath)) {
        setDestError('Destination cannot be inside the source folder — this would cause an infinite loop.');
        return;
      }
      setDestError(null);
      update({ destFolder: folderPath });
    } else {
      if (pipeline.destFolder && isDestInsideSource(folderPath, pipeline.destFolder)) {
        setDestError('Destination cannot be inside the new source folder.');
      } else {
        setDestError(null);
      }
      update({ sourceFolder: folderPath });
    }
  };

  const handleSourceChange = (val: string) => {
    if (pipeline.destFolder && isDestInsideSource(val, pipeline.destFolder)) {
      setDestError('Destination cannot be inside the source folder — this would cause an infinite loop.');
    } else {
      setDestError(null);
    }
    update({ sourceFolder: val });
  };

  const handleDestChange = (val: string) => {
    if (isDestInsideSource(pipeline.sourceFolder, val)) {
      setDestError('Destination cannot be inside the source folder — this would cause an infinite loop.');
      return;
    }
    setDestError(null);
    update({ destFolder: val });
  };

  // ---- Compression handling ----
  const compressionValues: CompressionValues = {
    compressionLevel: pipeline.compressionLevel,
    customOptions: pipeline.customOptions,
    supportedFormats: pipeline.supportedFormats,
    advancedOptions: pipeline.advancedOptions,
    outputFormat: pipeline.outputFormat,
  };

  const handleCompressionChange = (updated: CompressionValues) => {
    update({ ...updated });
  };

  // ---- Hook handling ----
  const handleHookCodeChange = (value: string | undefined) => {
    const newCode = value || '';
    update({ hookCode: newCode });
    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 800);
  };

  // ---- Name editing ----
  const saveName = () => {
    setEditingName(false);
    if (nameInput.trim()) update({ name: nameInput.trim() });
    else setNameInput(pipeline.name);
  };

  return (
    <div className={cn(
      'border rounded-2xl overflow-hidden transition-all duration-200',
      expanded ? 'border-accent/40 shadow-sm' : 'border-bc-100'
    )}>
      {/* ── Card Header ── */}
      <div
        className={cn(
          'flex items-center justify-between px-5 py-4 cursor-pointer transition-colors',
          expanded ? 'bg-accent/5' : 'bg-back-200 hover:bg-back-300'
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0',
            expanded ? 'bg-accent text-white' : 'bg-accent/20 text-secondary'
          )}>
            {index + 1}
          </div>

          {editingName ? (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveName();
                  if (e.key === 'Escape') { setEditingName(false); setNameInput(pipeline.name); }
                }}
                className="bg-back-100 border border-accent rounded-md px-2 py-1 text-sm font-semibold text-primary outline-none w-40"
              />
              <button onClick={saveName} className="text-success cursor-pointer hover:opacity-70">
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setEditingName(false); setNameInput(pipeline.name); }}
                className="text-tertiary cursor-pointer hover:opacity-70"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-primary truncate">{pipeline.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); setEditingName(true); }}
                className="text-tertiary hover:text-primary transition-colors cursor-pointer shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
            pipeline.enabled ? 'bg-success/10 text-success' : 'bg-back-300 text-tertiary'
          )}>
            <div className={cn('w-1.5 h-1.5 rounded-full', pipeline.enabled ? 'bg-success' : 'bg-tertiary')} />
            {pipeline.enabled ? 'Active' : 'Inactive'}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(pipeline.id); }}
            className="p-1.5 text-tertiary hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
            title="Delete pipeline"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-secondary" /> : <ChevronDown className="w-4 h-4 text-secondary" />}
        </div>
      </div>

      {/* ── Card Body ── */}
      {expanded && (
        <div className="px-5 py-5 bg-back-100 space-y-3 border-t border-bc-100">

          {/* Folders */}
          <CollapsibleSection
            icon={<FolderOpen className="w-4 h-4 text-accent" />}
            title="Folders"
            expanded={foldersExpanded}
            onToggle={() => setFoldersExpanded(!foldersExpanded)}
          >
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-primary mb-1">Source Folder</p>
                <p className="text-[11px] text-secondary mb-2">The folder watched for new files.</p>
                <FolderInput value={pipeline.sourceFolder} onChange={handleSourceChange} onBrowse={() => handleBrowse('source')} />
              </div>
              <div>
                <p className="text-xs font-semibold text-primary mb-1">Destination Folder</p>
                <p className="text-[11px] text-secondary mb-2">Where processed files will be saved.</p>
                <FolderInput value={pipeline.destFolder} onChange={handleDestChange} onBrowse={() => handleBrowse('dest')} />
                {destError && (
                  <p className="mt-2 text-xs text-red-500 flex items-center gap-1.5">
                    <MessageCircleWarning className="w-3.5 h-3.5 shrink-0" />
                    {destError}
                  </p>
                )}
              </div>
            </div>
          </CollapsibleSection>

          {/* Compression */}
          <CollapsibleSection
            icon={<Settings2 className="w-4 h-4 text-accent" />}
            title="Compression"
            badge={
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-accent/25 text-secondary ml-1">
                {pipeline.compressionLevel}
              </span>
            }
            expanded={compressionExpanded}
            onToggle={() => setCompressionExpanded(!compressionExpanded)}
          >
            <CompressionPanel values={compressionValues} onChange={handleCompressionChange} />
          </CollapsibleSection>

          {/* Post-Process Hook */}
          <CollapsibleSection
            icon={<Webhook className="w-4 h-4 text-accent" />}
            title="Post-Process Hook"
            expanded={hookExpanded}
            onToggle={() => setHookExpanded(!hookExpanded)}
            headerExtra={
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  update({ hookEnabled: !pipeline.hookEnabled });
                  if (!pipeline.hookEnabled && !hookExpanded) setHookExpanded(true);
                }}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer',
                  pipeline.hookEnabled
                    ? 'bg-accent text-white'
                    : 'bg-back-300 text-secondary border border-bc-100'
                )}
              >
                {pipeline.hookEnabled ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                {pipeline.hookEnabled ? 'Enabled' : 'Disabled'}
              </button>
            }
          >
            <div className="rounded-xl border border-bc-100 overflow-hidden" style={{ minHeight: 260 }}>
              <div className="flex items-center justify-between px-3 py-2 border-b border-bc-100 bg-back-200">
                <div className="flex items-center gap-2 text-xs font-medium text-secondary">
                  <Code className="w-3.5 h-3.5 text-accent" />
                  <span>Hook Function Body (async)</span>
                </div>
                <div className="text-xs font-medium h-6 flex items-center">
                  {saveStatus === 'saving' && <span className="text-tertiary animate-pulse">Saving…</span>}
                  {saveStatus === 'saved' && (
                    <span className="text-accent flex items-center gap-1">
                      <Save className="w-3 h-3" /> Saved
                    </span>
                  )}
                </div>
              </div>
              <div style={{ height: 260 }}>
                <Editor
                  height="100%"
                  defaultLanguage="javascript"
                  theme={editorTheme}
                  value={pipeline.hookCode || DEFAULT_HOOK_CODE}
                  onChange={handleHookCodeChange}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    wordWrap: 'on',
                    padding: { top: 12, bottom: 12 },
                    scrollBeyondLastLine: false,
                    lineNumbers: 'on',
                    tabSize: 2,
                  }}
                />
              </div>
            </div>
          </CollapsibleSection>

        </div>
      )}
    </div>
  );
}
