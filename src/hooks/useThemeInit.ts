import { useEffect } from "react";
import { ACCENT_THEMES } from "../lib/themes";

export function useThemeInit() {
  useEffect(() => {
    const initTheme = async () => {
      if ((window as any).ipcRenderer) {
        try {
          const config = await (window as any).ipcRenderer.invoke('get-config');
          const root = window.document.documentElement;
          
          if (config.theme) {
            if (config.theme === 'system') {
              const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
              if (systemTheme === 'dark') {
                root.setAttribute('data-theme', 'dark');
              } else {
                root.removeAttribute('data-theme');
              }
            } else {
              if (config.theme === 'dark') {
                root.setAttribute('data-theme', 'dark');
              } else {
                root.removeAttribute('data-theme');
              }
            }
          }
          
          if (config.accent) {
            const selectedTheme = ACCENT_THEMES.find((t: any) => t.name === config.accent);
            if (selectedTheme) {
              root.style.setProperty('--accent-light', selectedTheme.light);
              root.style.setProperty('--accent-dark', selectedTheme.dark);
              root.style.setProperty('--gradient-from-light', selectedTheme.fromLight);
              root.style.setProperty('--gradient-to-light', selectedTheme.toLight);
              root.style.setProperty('--gradient-from-dark', selectedTheme.fromDark);
              root.style.setProperty('--gradient-to-dark', selectedTheme.toDark);
            }
          }
        } catch (e) {
          console.error("Failed to load initial theme", e);
        }
      }
    };
    initTheme();
  }, []);
}
