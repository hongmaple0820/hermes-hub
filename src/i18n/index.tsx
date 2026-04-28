'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';

export type Locale = 'en' | 'zh' | 'ja' | 'ko';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  locales: { code: Locale; label: string }[];
}

const AVAILABLE_LOCALES: { code: Locale; label: string }[] = [
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
];

// Cache loaded messages
const messagesCache: Record<Locale, Record<string, any>> = {} as any;

async function loadMessages(locale: Locale): Promise<Record<string, any>> {
  if (messagesCache[locale]) return messagesCache[locale];
  const mod = await import(`./locales/${locale}.json`);
  messagesCache[locale] = mod.default || mod;
  return messagesCache[locale];
}

const I18nContext = createContext<I18nContextType | null>(null);

function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'zh';
  const saved = localStorage.getItem('hermes_locale') as Locale | null;
  if (saved && AVAILABLE_LOCALES.some((l) => l.code === saved)) return saved;
  return 'zh';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);
  const [messages, setMessages] = useState<Record<string, any>>({});
  const [loaded, setLoaded] = useState(false);

  // Load messages when locale changes
  useEffect(() => {
    let cancelled = false;
    loadMessages(locale).then((msgs) => {
      if (!cancelled) {
        setMessages(msgs);
        setLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('hermes_locale', newLocale);
    document.documentElement.lang = newLocale;
  }, []);

  // Translation function
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    if (!loaded) return key;
    const keys = key.split('.');
    let value: any = messages;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // fallback to key if not found
      }
    }
    if (typeof value !== 'string') return key;

    // Replace params like {count}, {name}, etc.
    if (params) {
      return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
        return params[paramKey] !== undefined ? String(params[paramKey]) : `{${paramKey}}`;
      });
    }

    return value;
  }, [messages, loaded]);

  const contextValue = useMemo(() => ({
    locale,
    setLocale,
    t,
    locales: AVAILABLE_LOCALES,
  }), [locale, setLocale, t]);

  if (!loaded) {
    return null; // or a loading spinner
  }

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
