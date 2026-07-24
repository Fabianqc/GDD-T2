import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { ThemeContextProvider, useTheme } from '../context/ThemeContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { setupNotificationChannels } from '../services/pushNotificationService';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Configura canales / handler de notificaciones en arranque (nativo).
if (Platform.OS !== 'web') {
  void setupNotificationChannels();
}

/**
 * Componente interno que maneja la redirección basada en el estado de autenticación.
 * Se separa del RootLayout para poder usar el hook useAuth dentro del AuthProvider.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, isLoading]);

  return <>{children}</>;
}

function MainNavigation() {
  const { isDark } = useTheme();

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <AuthGate>
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
      </AuthGate>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeContextProvider>
      <AuthProvider>
        <MainNavigation />
      </AuthProvider>
    </ThemeContextProvider>
  );
}
