import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  refreshTokens,
  getMe,
  getAccessToken,
  saveCachedUser,
  getCachedUser,
  clearTokens,
  RegisterData,
} from '../services/authService';
import {
  registerForPushNotifications,
  unregisterPushNotifications,
} from '../services/pushNotificationService';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Al montar, recupera la sesión persistente del usuario:
   * 1. Carga usuario en caché para respuesta instantánea (evita saltos a login).
   * 2. Valida access token en segundo plano.
   * 3. Si expiró, renueva silenciosamente con refreshTokens().
   * 4. Si la red falla, MANTIENE la sesión abierta con el usuario en caché.
   * 5. Solo cierra sesión si el refresh token fue explícitamente revocado/inválido.
   */
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const cached = await getCachedUser();
        if (cached) {
          setUser(cached);
        }

        const token = await getAccessToken();
        if (!token) {
          if (!cached) setUser(null);
          setIsLoading(false);
          return;
        }

        try {
          const me = await getMe();
          setUser(me);
          await saveCachedUser(me);
          void registerForPushNotifications(me.role);
        } catch (authErr: any) {
          // Si falló por token expirado, intentar rotate
          try {
            await refreshTokens();
            const me = await getMe();
            setUser(me);
            await saveCachedUser(me);
            void registerForPushNotifications(me.role);
          } catch (refreshErr: any) {
            const msg = String(refreshErr?.message || '').toLowerCase();
            const isInvalidToken = msg.includes('inválido') || msg.includes('revocado') || msg.includes('expirado') || msg.includes('401') || msg.includes('403') || msg.includes('no hay refresh');
            if (isInvalidToken) {
              await clearTokens();
              setUser(null);
            } else {
              // Error de red temporal u offline: conservar el usuario local
              console.log('Restauración de sesión offline/red: conservando sesión local');
            }
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await apiLogin(email, password);
    const me = await getMe();
    setUser(me);
    await saveCachedUser(me);
    void registerForPushNotifications(me.role);
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    await apiRegister(data);
    await apiLogin(data.email, data.password);
    const me = await getMe();
    setUser(me);
    await saveCachedUser(me);
    void registerForPushNotifications(me.role);
  }, []);

  const logout = useCallback(async () => {
    await unregisterPushNotifications();
    await apiLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un <AuthProvider>');
  }
  return context;
}
