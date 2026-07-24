import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { getAccessToken } from './authService';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? (
  Platform.OS === 'web' ? 'http://localhost:8000' : 'http://10.0.2.2:8000'
);

const PUSH_TOKEN_KEY = 'gdd_expo_push_token';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

async function storeLocalToken(token: string | null) {
  if (Platform.OS === 'web') {
    if (token) localStorage.setItem(PUSH_TOKEN_KEY, token);
    else localStorage.removeItem(PUSH_TOKEN_KEY);
    return;
  }
  const SecureStore = await import('expo-secure-store');
  if (token) await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
}

async function getLocalToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(PUSH_TOKEN_KEY);
  }
  const SecureStore = await import('expo-secure-store');
  return SecureStore.getItemAsync(PUSH_TOKEN_KEY);
}

async function apiPost(path: string, body: Record<string, unknown>) {
  const token = await getAccessToken();
  if (!token) return;

  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Error de red' }));
    throw new Error(err.detail ?? 'Error al registrar dispositivo push');
  }
}

async function apiDelete(path: string, body: Record<string, unknown>) {
  const token = await getAccessToken();
  if (!token) return;

  const res = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Error de red' }));
    throw new Error(err.detail ?? 'Error al desregistrar dispositivo push');
  }
}

/**
 * Configura canal Android para recordatorios de comida.
 */
export async function setupNotificationChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('meal-reminders', {
    name: 'Recordatorios de comidas',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0A7EA4',
    sound: 'default',
  });
}

/**
 * Solicita permisos, obtiene ExpoPushToken y lo registra en el backend.
 * Solo para pacientes en dispositivos nativos. No bloquea el login si falla.
 */
export async function registerForPushNotifications(userRole?: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return null;
    }
    if (userRole && userRole !== 'PACIENTE') {
      return null;
    }
    if (!Device.isDevice) {
      console.log('[Push] Se requiere un dispositivo físico para notificaciones push.');
      return null;
    }

    await setupNotificationChannels();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('[Push] Permiso de notificaciones denegado.');
      return null;
    }

    const projectId = getProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const expoPushToken = tokenResponse.data;
    if (!expoPushToken) return null;

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Caracas';

    await apiPost('/notifications/patient/device', {
      expo_push_token: expoPushToken,
      platform: Platform.OS,
      device_name: Device.modelName ?? Device.deviceName ?? undefined,
      timezone,
    });

    await storeLocalToken(expoPushToken);
    console.log('[Push] Dispositivo registrado:', expoPushToken);
    return expoPushToken;
  } catch (err) {
    console.log('[Push] No se pudo registrar el dispositivo:', err);
    return null;
  }
}

/**
 * Desactiva el token en el backend (logout). No lanza errores al usuario.
 */
export async function unregisterPushNotifications(): Promise<void> {
  try {
    if (Platform.OS === 'web') return;
    const expoPushToken = await getLocalToken();
    if (!expoPushToken) return;

    await apiDelete('/notifications/patient/device', {
      expo_push_token: expoPushToken,
    });
    await storeLocalToken(null);
  } catch (err) {
    console.log('[Push] No se pudo desregistrar el dispositivo:', err);
  }
}
