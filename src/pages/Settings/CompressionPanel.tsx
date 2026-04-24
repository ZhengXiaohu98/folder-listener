import {
  SquareDashedBottom, SquareDashedTopSolid, SquareDashed,
  SquareDashedMousePointer, ChevronDown,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function SettingsToggle({
  title, description, checked, onChange,
}: { title: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div>
        <h4 className="text-xs font-semibold text-primary">{title}</h4>
        <p className="text-[11px] text-secondary mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ml-4',
          checked ? 'bg-accent' : 'bg-tertiary opacity-50'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}

function FormatCheckbox({
  label, tag, checked, onChange,
}: { label: string; tag: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label
      className="flex items-center justify-between py-2.5 cursor-pointer group"
      onClick={(e) => { e.preventDefault(); onChange(!checked); }}
    >
      <div className="flex items-center gap-2.5">
        <div className={cn(
          'w-4 h-4 rounded border flex items-center justify-center transition-colors',
          checked ? 'bg-accent border-accent' : 'border-bc-100 bg-back-100 group-hover:border-accent/50'
        )}>
          {checked && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <span className="text-xs font-medium text-primary">{label}</span>
      </div>
      <span className="text-[10px] font-bold text-secondary bg-back-200 px-1.5 py-0.5 rounded uppercase tracking-wider">
        {tag}
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Types (exported so Pipeline interface can include them)
// ---------------------------------------------------------------------------
export interface CompressionValues {
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

export const DEFAULT_COMPRESSION: CompressionValues = {
  compressionLevel: 'Medium',
  customOptions: { quality: 80, maxWidth: 1920 },
  supportedFormats: { jpeg: true, png: true, webp: true, gif: true, svg: true, avif: true },
  advancedOptions: {
    autoDelete: false,
    enableCustomSuffix: false,
    customSuffix: '-min',
    enableCustomFileName: false,
    customFileName: 'folder-listener',
  },
  outputFormat: 'Original',
};

// ---------------------------------------------------------------------------
// CompressionPanel — pure / controlled component
// ---------------------------------------------------------------------------
interface CompressionPanelProps {
  values: CompressionValues;
  onChange: (updated: CompressionValues) => void;
}

export function CompressionPanel({ values, onChange }: CompressionPanelProps) {
  const set = (partial: Partial<CompressionValues>) => onChange({ ...values, ...partial });

  const levels = [
    { id: 'Low', icon: SquareDashedBottom, desc: '~20% reduction. Minimal quality loss.' },
    { id: 'Medium', icon: SquareDashedTopSolid, desc: '~50% reduction. Balanced profile.' },
    { id: 'High', icon: SquareDashed, desc: '~80% reduction. Noticeable artifacts.' },
    { id: 'Custom', icon: SquareDashedMousePointer, desc: 'Choose the compression ratio yourself.' },
  ];

  return (
    <div className="space-y-5">
      {/* Compression Level */}
      <div>
        <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-2">Compression Level</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {levels.map((l) => {
            const Icon = l.icon;
            const isActive = values.compressionLevel === l.id;
            return (
              <div
                key={l.id}
                onClick={() => set({ compressionLevel: l.id })}
                className={cn(
                  'p-3 rounded-xl border cursor-pointer transition-all flex flex-col',
                  isActive
                    ? 'border-accent bg-accent/5 ring-1 ring-accent'
                    : 'border-bc-100 bg-back-200 hover:border-bc-100/80'
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className={cn(
                    'w-6 h-6 rounded-md flex items-center justify-center',
                    isActive ? 'bg-accent/10 text-accent' : 'bg-back-300 text-secondary'
                  )}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className={cn(
                    'w-3.5 h-3.5 rounded-full border flex items-center justify-center',
                    isActive ? 'border-accent' : 'border-bc-100'
                  )}>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                  </div>
                </div>
                <h4 className="text-xs font-semibold text-primary mb-0.5">{l.id}</h4>
                <p className="text-[10px] text-secondary leading-relaxed">{l.desc}</p>
              </div>
            );
          })}
        </div>

        {values.compressionLevel === 'Custom' && (
          <div className="mt-3 p-4 rounded-xl border border-accent/30 bg-accent/5 space-y-4 animate-in fade-in slide-in-from-top-1">
            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-xs font-medium text-primary">Quality</label>
                <span className="text-xs text-accent font-medium">{values.customOptions.quality}%</span>
              </div>
              <input
                type="range" min="1" max="100"
                value={values.customOptions.quality}
                onChange={(e) => set({ customOptions: { ...values.customOptions, quality: parseInt(e.target.value) } })}
                className="w-full h-1.5 bg-back-300 rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-primary mb-1.5">Max Width (px)</label>
              <input
                type="number"
                value={values.customOptions.maxWidth}
                onChange={(e) => set({ customOptions: { ...values.customOptions, maxWidth: parseInt(e.target.value) } })}
                className="bg-back-100 border border-bc-100 text-primary text-xs rounded-lg focus:ring-accent focus:border-accent block w-full md:w-1/2 p-2 outline-none"
                placeholder="e.g. 1920"
              />
            </div>
          </div>
        )}
      </div>

      {/* Formats + Advanced side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Supported Formats */}
        <div className="border border-bc-100 rounded-xl p-4 bg-back-200">
          <h4 className="text-xs font-semibold text-primary mb-0.5">Supported Formats</h4>
          <p className="text-[11px] text-secondary mb-3">File types that trigger processing.</p>
          <div className="divide-y divide-bc-100/50">
            <FormatCheckbox label="JPEG / JPG" tag="IMAGE" checked={values.supportedFormats.jpeg} onChange={(v) => set({ supportedFormats: { ...values.supportedFormats, jpeg: v } })} />
            <FormatCheckbox label="PNG" tag="IMAGE" checked={values.supportedFormats.png} onChange={(v) => set({ supportedFormats: { ...values.supportedFormats, png: v } })} />
            <FormatCheckbox label="GIF" tag="IMAGE" checked={values.supportedFormats.gif} onChange={(v) => set({ supportedFormats: { ...values.supportedFormats, gif: v } })} />
            <FormatCheckbox label="SVG" tag="VECTOR" checked={values.supportedFormats.svg} onChange={(v) => set({ supportedFormats: { ...values.supportedFormats, svg: v } })} />
            <FormatCheckbox label="WebP" tag="NEXT-GEN" checked={values.supportedFormats.webp} onChange={(v) => set({ supportedFormats: { ...values.supportedFormats, webp: v } })} />
            <FormatCheckbox label="AVIF" tag="NEXT-GEN" checked={values.supportedFormats.avif} onChange={(v) => set({ supportedFormats: { ...values.supportedFormats, avif: v } })} />
          </div>
        </div>

        {/* Advanced Options */}
        <div className="border border-bc-100 rounded-xl p-4 bg-back-200">
          <h4 className="text-xs font-semibold text-primary mb-0.5">Advanced Options</h4>
          <p className="text-[11px] text-secondary mb-3">Fine-tune file handling post-compression.</p>
          <div className="divide-y divide-bc-100/50">
            <SettingsToggle
              title="Auto-delete original"
              description="Move originals to trash after processing."
              checked={values.advancedOptions.autoDelete}
              onChange={(v) => set({ advancedOptions: { ...values.advancedOptions, autoDelete: v } })}
            />
            <div>
              <SettingsToggle
                title="Custom Suffix"
                description="Append a suffix to the original filename."
                checked={!!values.advancedOptions.enableCustomSuffix}
                onChange={(v) => set({ advancedOptions: { ...values.advancedOptions, enableCustomSuffix: v } })}
              />
              {values.advancedOptions.enableCustomSuffix && (
                <div className="pb-2 animate-in fade-in slide-in-from-top-1">
                  <input
                    type="text"
                    value={values.advancedOptions.customSuffix}
                    onChange={(e) => set({ advancedOptions: { ...values.advancedOptions, customSuffix: e.target.value } })}
                    placeholder="-min"
                    className="bg-back-100 border border-bc-100 text-primary text-xs rounded-lg focus:ring-accent focus:border-accent block w-full p-2 outline-none"
                  />
                </div>
              )}
            </div>
            <div>
              <SettingsToggle
                title="Custom Filename"
                description="Use a custom name when saving processed files."
                checked={!!values.advancedOptions.enableCustomFileName}
                onChange={(v) => set({ advancedOptions: { ...values.advancedOptions, enableCustomFileName: v } })}
              />
              {values.advancedOptions.enableCustomFileName && (
                <div className="pb-2 animate-in fade-in slide-in-from-top-1">
                  <input
                    type="text"
                    value={values.advancedOptions.customFileName}
                    onChange={(e) => set({ advancedOptions: { ...values.advancedOptions, customFileName: e.target.value } })}
                    placeholder="folder-listener"
                    className="bg-back-100 border border-bc-100 text-primary text-xs rounded-lg focus:ring-accent focus:border-accent block w-full p-2 outline-none"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Output Format */}
      <div className="border border-bc-100 rounded-xl p-4 bg-back-200">
        <h4 className="text-xs font-semibold text-primary mb-0.5">Output Format</h4>
        <p className="text-[11px] text-secondary mb-3">Choose the format processed images are saved as.</p>
        <div className="relative w-full md:w-1/2">
          <select
            value={values.outputFormat}
            onChange={(e) => set({ outputFormat: e.target.value })}
            className="appearance-none bg-back-100 border border-bc-100 text-primary text-xs rounded-lg focus:ring-accent focus:border-accent block w-full p-2 pr-8 outline-none cursor-pointer"
          >
            <option value="Original">Keep Original Format</option>
            <option value="JPEG">Convert to JPEG</option>
            <option value="PNG">Convert to PNG</option>
            <option value="WebP">Convert to WebP</option>
            <option value="AVIF">Convert to AVIF</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-secondary">
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
}
