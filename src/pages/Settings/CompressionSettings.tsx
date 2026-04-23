import { useState, useEffect } from 'react';
import { Settings2, SquareDashedBottom, SquareDashed, SquareDashedTopSolid, SquareDashedMousePointer, ChevronDown } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function SettingsToggle({ title, description, checked, onChange }: { title: string, description: string, checked: boolean, onChange: (val: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <h4 className="text-sm font-semibold text-primary">{title}</h4>
        <p className="text-xs text-secondary mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
          checked ? 'bg-accent' : 'bg-tertiary opacity-50'
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}

function FormatCheckbox({ label, tag, checked, onChange }: { label: string, tag: string, checked: boolean, onChange: (val: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-3 cursor-pointer group" onClick={(e) => { e.preventDefault(); onChange(!checked); }}>
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-5 h-5 rounded border flex items-center justify-center transition-colors",
          checked ? "bg-accent border-accent" : "border-bc-100 bg-back-100 group-hover:border-accent/50"
        )}>
          {checked && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
        </div>
        <span className="text-sm font-medium text-primary">{label}</span>
      </div>
      <span className="text-[10px] font-bold text-secondary bg-back-100 px-2 py-0.5 rounded uppercase tracking-wider">
        {tag}
      </span>
    </label>
  );
}

export function CompressionSettings() {
  const [level, setLevel] = useState('Medium');
  const [customOptions, setCustomOptions] = useState({ quality: 80, maxWidth: 1920 });
  const [formats, setFormats] = useState({ jpeg: true, png: true, webp: true, gif: true, svg: true, avif: true });
  const [advanced, setAdvanced] = useState({ autoDelete: true, enableCustomSuffix: false, customSuffix: '-min', enableCustomFileName: false, customFileName: 'folder-listener' } as any);
  const [outputFormat, setOutputFormat] = useState('Original');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        if ((window as any).ipcRenderer) {
          const config = await (window as any).ipcRenderer.invoke('get-config');
          if (config.compressionLevel) setLevel(config.compressionLevel);
          if (config.customOptions) setCustomOptions(config.customOptions);
          if (config.supportedFormats) setFormats(config.supportedFormats);
          if (config.advancedOptions) setAdvanced(config.advancedOptions);
          if (config.outputFormat) setOutputFormat(config.outputFormat);
        }
      } catch (err) {
        console.error('Failed to load config', err);
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  const updateConfig = (updates: any) => {
    if ((window as any).ipcRenderer) {
      (window as any).ipcRenderer.invoke('set-config', updates);
    }
  };

  const handleLevelChange = (newLevel: string) => {
    setLevel(newLevel);
    updateConfig({ compressionLevel: newLevel });
  };

  const handleFormatChange = (key: keyof typeof formats, val: boolean) => {
    const nextFormats = { ...formats, [key]: val };
    setFormats(nextFormats);
    updateConfig({ supportedFormats: nextFormats });
  };

  const handleAdvancedChange = (key: keyof typeof advanced, val: boolean | string) => {
    const nextAdv = { ...advanced, [key]: val };
    setAdvanced(nextAdv);
    updateConfig({ advancedOptions: nextAdv });
  };

  const handleCustomOptionChange = (key: keyof typeof customOptions, val: number) => {
    const nextOpts = { ...customOptions, [key]: val };
    setCustomOptions(nextOpts);
    updateConfig({ customOptions: nextOpts });
  };

  const levels = [
    { id: 'Low', icon: SquareDashedBottom, desc: '~20% reduction. Minimal quality loss.' },
    { id: 'Medium', icon: SquareDashedTopSolid, desc: '~50% reduction. Balanced profile.' },
    { id: 'High', icon: SquareDashed, desc: '~80% reduction. Noticeable artifacts.' },
    { id: 'Custom', icon: SquareDashedMousePointer, desc: 'Choose the compression ratio yourself' },
  ];

  if (loading) return <div className="h-64 animate-pulse bg-back-200 border border-bc-100 rounded-2xl mb-8" />;

  return (
    <div className="bg-back-200 border border-bc-100 rounded-2xl p-8">
      <h3 className="text-primary font-semibold text-lg mb-6 flex items-center gap-2">
        <Settings2 className="w-5 h-5 text-accent" />
        Compression Level
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {levels.map((l) => {
          const Icon = l.icon;
          const isActive = level === l.id;
          return (
            <div
              key={l.id}
              onClick={() => handleLevelChange(l.id)}
              className={cn(
                "p-4 rounded-xl border cursor-pointer transition-all flex flex-col h-full",
                isActive ? "border-accent bg-accent/5 ring-1 ring-accent" : "border-bc-100 bg-back-100 hover:border-bc-100/80"
              )}
            >
              <div className="flex justify-between items-start mb-3">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", isActive ? "bg-accent/10 text-accent" : "bg-back-300 text-secondary")}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", isActive ? "border-accent" : "border-bc-100")}>
                  {isActive && <div className="w-2 h-2 rounded-full bg-accent" />}
                </div>
              </div>
              <h4 className="text-sm font-semibold text-primary mb-1">{l.id}</h4>
              <p className="text-xs text-secondary leading-relaxed">{l.desc}</p>
            </div>
          );
        })}
      </div>

      {level === 'Custom' && (
        <div className="mb-8 p-5 rounded-xl border border-accent/30 bg-accent/5 animate-in fade-in slide-in-from-top-2">
          <h4 className="text-sm font-semibold text-primary mb-4">Custom Configuration</h4>

          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-primary">Quality Level</label>
                <span className="text-sm text-accent font-medium">{customOptions.quality}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={customOptions.quality}
                onChange={(e) => handleCustomOptionChange('quality', parseInt(e.target.value))}
                className="w-full h-2 bg-back-300 rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-2">Max Width (px)</label>
              <input
                type="number"
                value={customOptions.maxWidth}
                onChange={(e) => handleCustomOptionChange('maxWidth', parseInt(e.target.value))}
                className="bg-back-100 border border-bc-100 text-primary text-sm rounded-lg focus:ring-accent focus:border-accent block w-full md:w-1/2 p-2.5"
                placeholder="e.g. 1920"
              />
              <p className="text-xs text-secondary mt-1.5">Images wider than this will be downscaled.</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-bc-100 rounded-xl p-5 bg-back-100">
          <h4 className="text-sm font-semibold text-primary mb-1">Supported Formats</h4>
          <p className="text-xs text-secondary mb-4">Select which file types trigger automation.</p>

          <div className="divide-y divide-bc-100/50">
            <FormatCheckbox label="JPEG / JPG" tag="IMAGE" checked={formats.jpeg} onChange={(v) => handleFormatChange('jpeg', v)} />
            <FormatCheckbox label="PNG" tag="IMAGE" checked={formats.png} onChange={(v) => handleFormatChange('png', v)} />
            <FormatCheckbox label="GIF" tag="IMAGE" checked={formats.gif} onChange={(v) => handleFormatChange('gif', v)} />
            <FormatCheckbox label="SVG" tag="VECTOR" checked={formats.svg} onChange={(v) => handleFormatChange('svg', v)} />
            <FormatCheckbox label="WebP" tag="NEXT-GEN" checked={formats.webp} onChange={(v) => handleFormatChange('webp', v)} />
            <FormatCheckbox label="AVIF" tag="NEXT-GEN" checked={formats.avif} onChange={(v) => handleFormatChange('avif', v)} />
          </div>
        </div>

        <div className="border border-bc-100 rounded-xl p-5 bg-back-100">
          <h4 className="text-sm font-semibold text-primary mb-1">Advanced Options</h4>
          <p className="text-xs text-secondary mb-4">Fine-tune file handling post-compression.</p>

          <div className="divide-y divide-bc-100/50">
            <SettingsToggle
              title="Auto-delete original"
              description="Move original files to trash."
              checked={advanced.autoDelete}
              onChange={(v) => handleAdvancedChange('autoDelete', v)}
            />
            <div className="py-2">
              <SettingsToggle
                title="Custom Suffix"
                description="Appended to the original filename."
                checked={!!advanced.enableCustomSuffix}
                onChange={(v) => handleAdvancedChange('enableCustomSuffix', v)}
              />
              {advanced.enableCustomSuffix && (
                <div className="pb-3 animate-in fade-in slide-in-from-top-1">
                  <input
                    type="text"
                    value={advanced.customSuffix !== undefined ? advanced.customSuffix : '-min'}
                    onChange={(e) => handleAdvancedChange('customSuffix', e.target.value)}
                    placeholder="e.g. -min"
                    className="bg-back-200 border border-bc-100 text-primary text-sm rounded-lg focus:ring-accent focus:border-accent block w-full p-2.5 outline-none transition-all"
                  />
                </div>
              )}
            </div>

            <div className="py-2">
              <SettingsToggle
                title="Custom Filename"
                description="Custom filename when new file added."
                checked={!!advanced.enableCustomFileName}
                onChange={(v) => handleAdvancedChange('enableCustomFileName', v)}
              />
              {advanced.enableCustomFileName && (
                <div className="pb-3 animate-in fade-in slide-in-from-top-1">
                  <input
                    type="text"
                    value={advanced.customFileName !== undefined ? advanced.customFileName : 'folder-listener'}
                    onChange={(e) => handleAdvancedChange('customFileName', e.target.value)}
                    placeholder="e.g. folder-listener"
                    className="bg-back-200 border border-bc-100 text-primary text-sm rounded-lg focus:ring-accent focus:border-accent block w-full p-2.5 outline-none transition-all"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border border-bc-100 rounded-xl p-5 bg-back-100 md:col-span-2">
          <h4 className="text-sm font-semibold text-primary mb-1">Output Format</h4>
          <p className="text-xs text-secondary mb-4">Choose the format your images will be converted to.</p>

          <div className="relative w-full md:w-1/2">
            <select
              value={outputFormat}
              onChange={(e) => { setOutputFormat(e.target.value); updateConfig({ outputFormat: e.target.value }); }}
              className="appearance-none bg-back-200 border border-bc-100 text-primary text-sm rounded-lg focus:ring-accent focus:border-accent block w-full p-2.5 pr-10 outline-none transition-all cursor-pointer"
            >
              <option value="Original">Keep Original Format</option>
              <option value="JPEG">Convert to JPEG</option>
              <option value="PNG">Convert to PNG</option>
              <option value="WebP">Convert to WebP</option>
              <option value="AVIF">Convert to AVIF</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-secondary">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
