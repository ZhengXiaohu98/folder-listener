import { useState, useEffect } from 'react';
import { FolderOpen, FolderDown } from 'lucide-react';
import { FolderInput } from './FolderInput';

export function Folders() {
  const [sourcePath, setSourcePath] = useState('');
  const [destPath, setDestPath] = useState('');
  const [loading, setLoading] = useState(true);

  // Load configuration from file
  useEffect(() => {
    const loadConfig = async () => {
      try {
        if ((window as any).ipcRenderer) {
          const config = await (window as any).ipcRenderer.invoke('get-config');
          setSourcePath(config.sourceFolder);
          setDestPath(config.destFolder);
        }
      } catch (err) {
        console.error('Failed to load config', err);
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  const handleBrowseSource = async () => {
    if ((window as any).ipcRenderer) {
      const path = await (window as any).ipcRenderer.invoke('select-folder');
      if (path) {
        setSourcePath(path);
        await (window as any).ipcRenderer.invoke('set-config', { sourceFolder: path });
      }
    }
  };

  const handleBrowseDest = async () => {
    if ((window as any).ipcRenderer) {
      const path = await (window as any).ipcRenderer.invoke('select-folder');
      if (path) {
        setDestPath(path);
        await (window as any).ipcRenderer.invoke('set-config', { destFolder: path });
      }
    }
  };

  const handleSourceChange = (val: string) => {
    setSourcePath(val);
    if ((window as any).ipcRenderer) {
      (window as any).ipcRenderer.invoke('set-config', { sourceFolder: val });
    }
  };

  const handleDestChange = (val: string) => {
    setDestPath(val);
    if ((window as any).ipcRenderer) {
      (window as any).ipcRenderer.invoke('set-config', { destFolder: val });
    }
  };

  if (loading) {
    return <div className="p-8 text-secondary animate-pulse">Loading configuration...</div>;
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <header className="pb-2">
        <h1 className="text-3xl font-bold text-primary tracking-tight transition-colors">Folder Configuration</h1>
        <p className="text-secondary mt-1.5 font-medium transition-colors">
          Set up the source and destination paths for your automated file management.
        </p>
      </header>

      {/* Main Container */}
      <div className="bg-back-200 border border-bc-100 rounded-2xl p-8 shadow-(--shadow-soft) transition-all">

        {/* Source Folder Section */}
        <section className="mb-8">
          <div className="flex items-center gap-2 text-primary font-semibold text-lg mb-2">
            <FolderOpen className="w-5 h-5 text-accent" />
            Source Folder
          </div>
          <p className="text-sm text-secondary mb-4">The folder Magic Folder will watch for new files.</p>
          <FolderInput
            value={sourcePath}
            onChange={handleSourceChange}
            onBrowse={handleBrowseSource}
          />
        </section>

        <div className="h-px bg-bc-100 w-full my-8" />

        {/* Destination Folder Section */}
        <section>
          <div className="flex items-center gap-2 text-primary font-semibold text-lg mb-2">
            <FolderDown className="w-5 h-5 text-accent" />
            Destination Folder
          </div>
          <p className="text-sm text-secondary mb-4">Where processed files will be automatically organized.</p>
          <FolderInput
            value={destPath}
            onChange={handleDestChange}
            onBrowse={handleBrowseDest}
          />
        </section>
      </div>
    </div>
  );
}
