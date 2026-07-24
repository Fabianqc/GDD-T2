import { useTheme } from '../context/ThemeContext';
import { useColorScheme as useNativeColorScheme } from 'react-native';

export function useColorScheme(): 'light' | 'dark' {
  try {
    const { theme } = useTheme();
    return theme;
  } catch {
    const systemScheme = useNativeColorScheme();
    return systemScheme === 'dark' ? 'dark' : 'light';
  }
}

