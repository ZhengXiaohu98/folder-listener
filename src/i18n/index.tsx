import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import en from './locales/en';
import zhCN from './locales/zhCN';
import zhTW from './locales/zhTW';
import ja from './locales/ja';
import ko from './locales/ko';
import de from './locales/de';
import fr from './locales/fr';
import ru from './locales/ru';
import es from './locales/es';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type Locale = 'en' | 'zhCN' | 'zhTW' | 'ja' | 'ko' | 'de' | 'fr' | 'ru' | 'es';
export type TranslationKey = keyof typeof en;
type Messages = Record<string, string>;

// ---------------------------------------------------------------------------
// All locales
// ---------------------------------------------------------------------------
const messages: Record<Locale, Messages> = { en, zhCN, zhTW, ja, ko, de, fr, ru, es };

export const LOCALE_LIST: { code: Locale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'zhCN', label: '简体中文' },
  { code: 'zhTW', label: '繁體中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'ru', label: 'Русский' },
  { code: 'es', label: 'Español' },
];

// ---------------------------------------------------------------------------
// Helper: interpolate `{key}` placeholders
// ---------------------------------------------------------------------------
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [loaded, setLoaded] = useState(false);

  // Load saved locale from config on mount
  useEffect(() => {
    const load = async () => {
      try {
        if ((window as any).ipcRenderer) {
          const config = await (window as any).ipcRenderer.invoke('get-config');
          if (config?.locale && messages[config.locale as Locale]) {
            setLocaleState(config.locale as Locale);
          }
        }
      } catch {
        // ignore – default to 'en'
      } finally {
        setLoaded(true);
      }
    };
    load();
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    // Persist to config
    try {
      if ((window as any).ipcRenderer) {
        (window as any).ipcRenderer.invoke('set-config', { locale: newLocale });
      }
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>): string => {
      const msg = messages[locale]?.[key] ?? messages.en[key] ?? key;
      return interpolate(msg, vars);
    },
    [locale],
  );

  // Avoid rendering children before locale is loaded to prevent flash
  if (!loaded) return null;

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within <I18nProvider>');
  return ctx;
}
