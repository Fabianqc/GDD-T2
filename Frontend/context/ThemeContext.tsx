import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useColorScheme as useSystemColorScheme, Platform, LayoutAnimation, UIManager } from 'react-native';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const THEME_STORE_KEY = 'user_theme_preference';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const getStoredTheme = async (): Promise<ThemeMode | null> => {
  try {
    let saved: string | null = null;
    if (Platform.OS === 'web') {
      saved = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_STORE_KEY) : null;
    } else {
      saved = await SecureStore.getItemAsync(THEME_STORE_KEY);
    }
    return (saved === 'light' || saved === 'dark') ? (saved as ThemeMode) : null;
  } catch {
    return null;
  }
};

const saveStoredTheme = async (mode: ThemeMode): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(THEME_STORE_KEY, mode);
    } else {
      await SecureStore.setItemAsync(THEME_STORE_KEY, mode);
    }
  } catch (e) {
    console.warn('Error saving theme:', e);
  }
};

export function ThemeContextProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [theme, setThemeState] = useState<ThemeMode>('dark');

  // Inject smooth 350ms CSS transition on Web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'theme-smooth-transition-style';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
          *, *::before, *::after {
            transition: background-color 350ms ease-in-out, color 350ms ease-in-out, border-color 350ms ease-in-out, box-shadow 350ms ease-in-out !important;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadTheme = async () => {
      const savedTheme = await getStoredTheme();
      if (!isMounted) return;
      if (savedTheme) {
        setThemeState(savedTheme);
      } else if (systemScheme === 'light' || systemScheme === 'dark') {
        setThemeState(systemScheme);
      }
    };
    loadTheme();
    return () => { isMounted = false; };
  }, [systemScheme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setThemeState(mode);
    saveStoredTheme(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setThemeState((current) => {
      const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
      saveStoredTheme(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe usarse dentro de un <ThemeContextProvider>');
  }
  return context;
}
