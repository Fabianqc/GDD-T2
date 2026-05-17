import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  refreshTokens,
  getMe,
  getAccessToken,
  RegisterData,
} from '../services/authService';

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
   * Al montar, intenta recuperar la sesión:
   * 1. Comprueba si hay access token en SecureStore
   * 2. Llama a /auth/me para validarlo
   * 3. Si falla, intenta rotar tokens con refreshTokens()
   * 4. Si sigue fallando, limpia sesión
   */
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          setIsLoading(false);
          return;
        }

        // Intentar con access token actual
        try {
          const me = await getMe();
          setUser(me);
        } catch {
          // Access token expirado → intentar rotate
          try {
            await refreshTokens();
            const me = await getMe();
            setUser(me);
          } catch {
            // Refresh también expirado → sesión terminada
            setUser(null);
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
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    await apiRegister(data);
    // Después del registro, hacer login automático
    await apiLogin(data.email, data.password);
    const me = await getMe();
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
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
