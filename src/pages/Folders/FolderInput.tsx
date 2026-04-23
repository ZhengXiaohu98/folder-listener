import { Link, Search } from 'lucide-react';

interface FolderInputProps {
  value: string;
  onChange: (val: string) => void;
  onBrowse: () => void;
}

export function FolderInput({ value, onChange, onBrowse }: FolderInputProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 flex items-center gap-3 px-4 py-2.5 border rounded-lg text-primary text-sm transition duration-300 focus-within:ring-1 ring-offset-1 focus-within:ring-accent">
        <Link className="w-4 h-4 text-tertiary shrink-0" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none font-mono text-sm placeholder:text-tertiary"
        />
      </div>
      <button
        onClick={onBrowse}
        className="flex items-center gap-1.5 md:gap-2 px-4 py-2.5 border border-bc-100 bg-back-200 hover:bg-back-300 rounded-lg text-sm font-medium text-primary transition-colors cursor-pointer">
        <Search className="w-4 h-4 text-secondary" />
        <span className='md:block hidden'>Browse</span>

      </button>
    </div>
  );
}
