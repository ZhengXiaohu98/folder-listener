import { useState, useEffect } from 'react';
import { Monitor, Moon, Sun, Palette } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ACCENT_THEMES } from '../../lib/themes';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ThemeMode = 'light' | 'dark' | 'system';

export function AppearanceSettings() {
  const [theme, setTheme] = useState<ThemeMode>('system');
  const [accent, setAccent] = useState(ACCENT_THEMES[0].name);
  const [loading, setLoading] = useState(true);

  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        if ((window as any).ipcRenderer) {
          const config = await (window as any).ipcRenderer.invoke('get-config');
          if (config.theme) setTheme(config.theme);
          if (config.accent) setAccent(config.accent);
        }
      } catch (err) {
        console.error('Failed to load config', err);
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  // Update theme visually and save to config
  useEffect(() => {
    if (loading) return; // Prevent saving defaults before loading
    
    const root = window.document.documentElement;
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      if (systemTheme === 'dark') {
        root.setAttribute('data-theme', 'dark');
      } else {
        root.removeAttribute('data-theme');
      }
    } else {
      if (theme === 'dark') {
        root.setAttribute('data-theme', 'dark');
      } else {
        root.removeAttribute('data-theme');
      }
    }
    
    if ((window as any).ipcRenderer) {
      (window as any).ipcRenderer.invoke('set-config', { theme });
    }
  }, [theme, loading]);

  // Update accent visually and save to config
  useEffect(() => {
    if (loading) return;

    const root = window.document.documentElement;
    const selectedTheme = ACCENT_THEMES.find(t => t.name === accent);

    if (selectedTheme) {
      root.style.setProperty('--accent-light', selectedTheme.light);
      root.style.setProperty('--accent-dark', selectedTheme.dark);
      root.style.setProperty('--gradient-from-light', selectedTheme.fromLight);
      root.style.setProperty('--gradient-to-light', selectedTheme.toLight);
      root.style.setProperty('--gradient-from-dark', selectedTheme.fromDark);
      root.style.setProperty('--gradient-to-dark', selectedTheme.toDark);
    }
    
    if ((window as any).ipcRenderer) {
      (window as any).ipcRenderer.invoke('set-config', { accent });
    }
  }, [accent, loading]);

  const themes = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Monitor },
  ];

  if (loading) return <div className="h-32 animate-pulse bg-back-200 border border-bc-100 rounded-2xl mb-8" />;

  return (
    <div className="bg-back-200 border border-bc-100 rounded-2xl p-8 mb-8">
      <h3 className="text-primary font-semibold text-lg mb-6 flex items-center gap-2">
        <Palette className="w-5 h-5 text-accent" />
        Appearance
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Theme Radio */}
        <div>
          <p className="text-sm text-secondary font-medium mb-4">Theme Preference</p>
          <div className="flex gap-4">
            {themes.map((t) => {
              const Icon = t.icon;
              const isActive = theme === t.id;
              return (
                <label
                  key={t.id}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-xl border cursor-pointer transition-all",
                    isActive
                      ? "border-accent bg-accent/5"
                      : "border-bc-100 bg-back-100 hover:border-bc-100/80"
                  )}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={t.id}
                    checked={isActive}
                    onChange={() => setTheme(t.id as ThemeMode)}
                    className="sr-only"
                  />
                  <Icon className={cn("w-6 h-6", isActive ? "text-accent" : "text-tertiary")} />
                  <span className={cn("text-sm font-medium", isActive ? "text-accent" : "text-secondary")}>
                    {t.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Accent Colors */}
        <div>
          <p className="text-sm text-secondary font-medium mb-4">Accent Color</p>
          <div className="flex flex-wrap gap-2.5">
            {ACCENT_THEMES.map((themeOption) => {
              const isActive = accent === themeOption.name;
              return (
                <button
                  key={themeOption.name}
                  onClick={() => setAccent(themeOption.name)}
                  title={themeOption.name}
                  style={{ backgroundColor: themeOption.light }}
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center transition-all cursor-pointer",
                    isActive ? "ring-1 ring-offset-2 ring-offset-back-200 ring-accent shadow-md" : "hover:scale-110 opacity-90 hover:opacity-100"
                  )}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
