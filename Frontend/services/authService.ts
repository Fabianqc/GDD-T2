import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? (
  Platform.OS === 'web' ? 'http://localhost:8000' : 'http://10.0.2.2:8000'
);

const KEYS = {
  ACCESS_TOKEN: 'gdd_access_token',
  REFRESH_TOKEN: 'gdd_refresh_token',
};

// ── Token storage ─────────────────────────────────────────────────────────────

export async function saveTokens(accessToken: string, refreshToken: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(KEYS.REFRESH_TOKEN, refreshToken);
  } else {
    await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken);
    await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken);
  }
}

export async function getAccessToken(): Promise<string | null> {
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
  } else {
    await SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN);
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

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  withAuth = false,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (withAuth) {
    const token = await getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Error de red' }));
    throw new Error(error.detail ?? 'Error desconocido');
  }

  // 204 No Content
  if (response.status === 204) return undefined as T;

  return response.json();
}

// ── Auth service ──────────────────────────────────────────────────────────────

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

/**
 * Rotate Token: obtiene un nuevo par de tokens usando el refresh token.
 * Si falla (token revocado/expirado) limpia storage y lanza error.
 */
export async function refreshTokens(): Promise<TokenResponse> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new Error('No hay refresh token almacenado');

  try {
    const tokens = await apiFetch<TokenResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    await saveTokens(tokens.access_token, tokens.refresh_token);
    return tokens;
  } catch (err) {
    await clearTokens();
    throw err;
  }
}

/** Logout: revoca el refresh token en el servidor y limpia storage local */
export async function logout(): Promise<void> {
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    await apiFetch('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch(() => {}); // Silencioso si el servidor falla
  }
  await clearTokens();
}

/** Retorna los datos del usuario autenticado */
export async function getMe(): Promise<User> {
  return apiFetch<User>('/auth/me', {}, true);
}
