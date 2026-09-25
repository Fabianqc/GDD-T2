import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? (
  Platform.OS === 'web' ? 'http://localhost:8000' : 'http://10.0.2.2:8000'
);

const KEYS = {
  ACCESS_TOKEN: 'gdd_access_token',
  REFRESH_TOKEN: 'gdd_refresh_token',
  USER_DATA: 'gdd_user_data',
};

// ── Token & User Storage ──────────────────────────────────────────────────────

export async function saveTokens(accessToken: string, refreshToken: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(KEYS.REFRESH_TOKEN, refreshToken);
  } else {
    await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken);
    await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken);
  }
}

export async function saveCachedUser(user: User) {
  try {
    const raw = JSON.stringify(user);
    if (Platform.OS === 'web') {
      localStorage.setItem(KEYS.USER_DATA, raw);
    } else {
      await SecureStore.setItemAsync(KEYS.USER_DATA, raw);
    }
  } catch {}
}

export async function getCachedUser(): Promise<User | null> {
  try {
    const raw = Platform.OS === 'web'
      ? localStorage.getItem(KEYS.USER_DATA)
      : await SecureStore.getItemAsync(KEYS.USER_DATA);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function getStoredAccessToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(KEYS.ACCESS_TOKEN);
  }
  return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
}

export async function getRefreshToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(KEYS.REFRESH_TOKEN);
  }
  return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
}

export async function clearTokens() {
  if (Platform.OS === 'web') {
    localStorage.removeItem(KEYS.ACCESS_TOKEN);
    localStorage.removeItem(KEYS.REFRESH_TOKEN);
    localStorage.removeItem(KEYS.USER_DATA);
  } else {
    try {
      await SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN);
    } catch {}
    try {
      await SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN);
    } catch {}
    try {
      await SecureStore.deleteItemAsync(KEYS.USER_DATA);
    } catch {}
  }
}

// ── JWT Payload Parser ───────────────────────────────────────────────────────

function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    // Cross-platform base64 decode
    let decoded = '';
    if (typeof atob === 'function') {
      decoded = atob(base64);
    } else {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      let str = base64.replace(/=+$/, '');
      for (let bc = 0, bs = 0, buffer, idx = 0; buffer = str.charAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? decoded += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
        buffer = chars.indexOf(buffer);
      }
    }
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// ── Token Refresh Mutex (Evita race conditions al renovar) ───────────────────

let refreshPromise: Promise<TokenResponse> | null = null;

export async function refreshTokens(): Promise<TokenResponse> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const currentRefresh = await getRefreshToken();
      if (!currentRefresh) {
        throw new Error('No hay refresh token almacenado');
      }

      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: currentRefresh }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: 'Error en respuesta del servidor' }));
        const errMsg = String(errData?.detail || 'Error al renovar sesión');
        
        // CRÍTICO: Solo si el servidor rechaza explícitamente el token (401 o 403) limpiamos credenciales.
        // Nunca por desconexión de red o error 500 temporal del backend.
        if (res.status === 401 || res.status === 403) {
          await clearTokens();
        }
        throw new Error(errMsg);
      }

      const newTokens: TokenResponse = await res.json();
      await saveTokens(newTokens.access_token, newTokens.refresh_token);
      return newTokens;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Obtiene el access token garantizando que esté vigente.
 * Si está vencido o a punto de vencer (menos de 2 minutos), intenta refrescarlo proactivamente.
 */
export async function getAccessToken(): Promise<string | null> {
  let token = await getStoredAccessToken();
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  // Si tiene expiración y expira en menos de 2 minutos (o ya expiró)
  if (payload?.exp) {
    const expiresAtMs = payload.exp * 1000;
    const nowMs = Date.now();
    if (expiresAtMs - nowMs < 120000) {
      try {
        const fresh = await refreshTokens();
        return fresh.access_token;
      } catch (e) {
        // Si falló por falta de red, retornar el actual como intento desesperado
        return token;
      }
    }
  }

  return token;
}

// ── API helpers ───────────────────────────────────────────────────────────────

/**
 * Wrapper de fetch autenticado que inyecta el Bearer token,
 * detecta 401, renueva token con refreshTokens() y reintenta la petición.
 */
export async function authenticatedFetch(
  pathOrUrl: string,
  options: RequestInit = {}
): Promise<Response> {
  const fullUrl = pathOrUrl.startsWith('http') ? pathOrUrl : `${API_URL}${pathOrUrl}`;
  const token = await getAccessToken();

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    reqHeaders['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(fullUrl, {
    ...options,
    headers: reqHeaders,
  });

  // Si recibimos 401 (token expiró en pleno vuelo)
  if (response.status === 401) {
    try {
      const refreshed = await refreshTokens();
      reqHeaders['Authorization'] = `Bearer ${refreshed.access_token}`;
      response = await fetch(fullUrl, {
        ...options,
        headers: reqHeaders,
      });
    } catch {
      // Si el refresh también falló con 401, el usuario necesita iniciar sesión
    }
  }

  return response;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  withAuth = false,
): Promise<T> {
  let response: Response;

  if (withAuth) {
    response = await authenticatedFetch(path, options);
  } else {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Error de red' }));
    throw new Error(error.detail ?? 'Error desconocido');
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

// ── Auth Service ──────────────────────────────────────────────────────────────

export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

/** Registra un nuevo paciente */
export async function register(data: RegisterData): Promise<User> {
  return apiFetch<User>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Login: guarda tokens en SecureStore y retorna el par de tokens */
export async function login(email: string, password: string): Promise<TokenResponse> {
  const tokens = await apiFetch<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  await saveTokens(tokens.access_token, tokens.refresh_token);
  return tokens;
}

/** Logout: revoca el refresh token en el servidor y limpia storage local */
export async function logout(): Promise<void> {
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {}
  }
  await clearTokens();
}

/** Retorna los datos del usuario autenticado */
export async function getMe(): Promise<User> {
  return apiFetch<User>('/auth/me', {}, true);
}
