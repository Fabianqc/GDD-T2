import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { getAccessToken } from './authService';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? (
  Platform.OS === 'web' ? 'http://localhost:8000' : 'http://10.0.2.2:8000'
);

const PUSH_TOKEN_KEY = 'gdd_expo_push_token';

// Configura el comportamiento cuando la notificación llega con la app abierta
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
    Constants.easConfig?.projectId ??
    'c48e8b6c-037d-4d4c-808b-9db285e3d8ac'
  );
}

const MEAL_LABELS: Record<string, string> = {
  DESAYUNO: 'Desayuno',
  ALMUERZO: 'Almuerzo',
  MERIENDA: 'Merienda',
  CENA: 'Cena',
};

export interface MealScheduleData {
  patient_id: string;
  timezone: string;
  advance_minutes: number;
  enabled: boolean;
  slots: { meal_type: string; meal_time: string; enabled: boolean }[];
}

/**
 * Configura canal Android para recordatorios de comida (con sonido, vibración y alta prioridad).
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
 * Sincroniza las notificaciones locales del teléfono con los horarios guardados en la BD del VPS.
 * Se ejecuta automáticamente cada vez que el paciente abre o entra a la app.
 *
 * @param showAlert Si es true, muestra una alerta visual con los horarios programados.
 */
export async function syncLocalMealReminders(showAlert = false): Promise<boolean> {
  try {
    if (Platform.OS === 'web') return false;

    // 1. Canal de notificaciones
    await setupNotificationChannels();

    // 2. Verificar o pedir permisos
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('[LocalNotifications] Permisos de notificación no otorgados.');
      if (showAlert) {
        Alert.alert('Permiso Requerido', 'Debes permitir las notificaciones para recibir tus recordatorios de comidas.');
      }
      return false;
    }

    // 3. Consultar la configuración de comidas en la BD
    const token = await getAccessToken();
    if (!token) {
      console.log('[LocalNotifications] Sin token de sesión.');
      return false;
    }

    const res = await fetch(`${API_URL}/notifications/patient/schedule`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      console.log('[LocalNotifications] Error al obtener horarios de la BD:', res.status);
      return false;
    }

    const schedule: MealScheduleData = await res.json();

    // 4. Cancelar recordatorios anteriores para no duplicar
    const ALL_MEALS = ['DESAYUNO', 'ALMUERZO', 'MERIENDA', 'CENA'];
    for (const m of ALL_MEALS) {
      await Notifications.cancelScheduledNotificationAsync(`meal-reminder-${m}`).catch(() => {});
    }

    if (!schedule.enabled) {
      console.log('[LocalNotifications] Recordatorios desactivados por el doctor.');
      if (showAlert) {
        Alert.alert('Recordatorios Desactivados', 'El doctor ha desactivado los recordatorios de comidas.');
      }
      return true;
    }

    const advance = Math.max(0, Number(schedule.advance_minutes) || 30);
    let scheduledCount = 0;
    const summaryList: string[] = [];

    // 5. Programar cada comida activa directamente en el teléfono
    for (const slot of schedule.slots) {
      if (!slot.enabled || !slot.meal_time) continue;

      const [hStr, mStr] = slot.meal_time.split(':');
      const mealHour = parseInt(hStr, 10);
      const mealMinute = parseInt(mStr, 10);
      if (isNaN(mealHour) || isNaN(mealMinute)) continue;

      // Restar minutos de anticipación respetando las 24 horas del día
      let totalMinutes = mealHour * 60 + mealMinute - advance;
      totalMinutes = ((totalMinutes % 1440) + 1440) % 1440;
      const triggerHour = Math.floor(totalMinutes / 60);
      const triggerMinute = totalMinutes % 60;

      const label = MEAL_LABELS[slot.meal_type] || slot.meal_type;
      const triggerTimeStr = `${String(triggerHour).padStart(2, '0')}:${String(triggerMinute).padStart(2, '0')}`;

      await Notifications.scheduleNotificationAsync({
        identifier: `meal-reminder-${slot.meal_type}`,
        content: {
          title: `Recordatorio de ${label}`,
          body: `En ${advance} min es tu ${label.toLowerCase()} (${slot.meal_time}). ¡Recuerda registrar tu comida!`,
          sound: 'default',
          data: {
            type: 'meal_reminder',
            meal_type: slot.meal_type,
            meal_time: slot.meal_time,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: triggerHour,
          minute: triggerMinute,
          channelId: 'meal-reminders',
        },
      });

      scheduledCount++;
      summaryList.push(`• ${label}: Comida ${slot.meal_time} (Aviso: ${triggerTimeStr})`);
    }

    console.log(`[LocalNotifications] Sincronizados ${scheduledCount} recordatorios locales desde la BD.`);
    if (showAlert) {
      Alert.alert(
        '¡Recordatorios Sincronizados!',
        `Se han programado ${scheduledCount} alarmas diarias sincronizadas con tu médico:\n\n${summaryList.join('\n')}`
      );
    }
    return true;
  } catch (err: any) {
    console.log('[LocalNotifications] Error al sincronizar horarios locales:', err);
    return false;
  }
}

/**
 * Dispara una notificación de prueba inmediata (en 2 segundos) para verificar sonido y visualización.
 */
export async function testLocalNotificationNow(): Promise<void> {
  try {
    await setupNotificationChannels();
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Por favor activa los permisos de notificación.');
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🍽️ Recordatorio de Comida (Prueba)',
        body: '¡Excelente! Tus recordatorios locales están activos y sincronizados con el servidor.',
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
        channelId: 'meal-reminders',
      },
    });

    Alert.alert('Prueba enviada', 'En 2 segundos verás la notificación en la barra superior de tu teléfono.');
  } catch (err: any) {
    Alert.alert('Error', `No se pudo disparar la notificación de prueba: ${err?.message || err}`);
  }
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
    const err = await res.json().catch(() => ({ detail: `Error HTTP ${res.status}` }));
    throw new Error(err.detail ?? 'Error al registrar dispositivo push');
  }
}

async function apiDelete(path: string, body: Record<string, unknown>) {
  const token = await getAccessToken();
  if (!token) return;

  await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  }).catch(() => {});
}

/**
 * Registra push remotos si Firebase estuviera disponible,
 * y siempre asegura la sincronización de las notificaciones locales del paciente.
 */
export async function registerForPushNotifications(userRole?: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return null;

    // Asegurar siempre la sincronización local desde la BD
    if (userRole === 'PACIENTE') {
      void syncLocalMealReminders(false);
    }

    if (userRole && userRole !== 'PACIENTE') return null;
    if (!Device.isDevice) return null;

    await setupNotificationChannels();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    // Intento de token remoto (si Firebase no está configurado, captura silenciosamente)
    try {
      const projectId = getProjectId();
      const tokenResponse = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
      const expoPushToken = tokenResponse.data;
      if (expoPushToken) {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Caracas';
        await apiPost('/notifications/patient/device', {
          expo_push_token: expoPushToken,
          platform: Platform.OS,
          device_name: Device.modelName ?? Device.deviceName ?? undefined,
          timezone,
        });
        await storeLocalToken(expoPushToken);
        console.log('[Push] Dispositivo push remoto registrado:', expoPushToken);
        return expoPushToken;
      }
    } catch (pushErr) {
      // Firebase no configurado en APK -> Las notificaciones locales ya están activas
      console.log('[Push] Push remoto no disponible (se usan notificaciones locales):', pushErr);
    }

    return null;
  } catch (err: any) {
    console.log('[Push] Error en registro:', err);
    return null;
  }
}

/**
 * Desactiva el token en el backend (logout) y cancela alarmas locales.
 */
export async function unregisterPushNotifications(): Promise<void> {
  try {
    if (Platform.OS === 'web') return;
    const expoPushToken = await getLocalToken();
    if (expoPushToken) {
      await apiDelete('/notifications/patient/device', {
        expo_push_token: expoPushToken,
      });
      await storeLocalToken(null);
    }
    // Cancelar alarmas locales de comidas
    const ALL_MEALS = ['DESAYUNO', 'ALMUERZO', 'MERIENDA', 'CENA'];
    for (const m of ALL_MEALS) {
      await Notifications.cancelScheduledNotificationAsync(`meal-reminder-${m}`).catch(() => {});
    }
  } catch (err) {
    console.log('[Push] Error al desregistrar:', err);
  }
}
