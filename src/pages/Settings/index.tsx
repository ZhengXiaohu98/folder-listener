import { AppearanceSettings } from './AppearanceSettings';
import { CompressionSettings } from './CompressionSettings';

export function Settings() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <header className="pb-2">
        <h1 className="text-3xl font-bold text-primary tracking-tight transition-colors">Settings</h1>
        <p className="text-secondary mt-1.5 font-medium transition-colors">
          Configure how Folder Listener handles image optimization and appearance.
        </p>
      </header>

      <AppearanceSettings />

      <CompressionSettings />

    </div>
  );
}
