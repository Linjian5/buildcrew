import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { api } from '../lib/api-client';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (token: string, user: AuthUser, refreshToken?: string) => void;
  logout: () => void;
}

const AUTH_TOKEN_KEY = 'buildcrew_token';
const AUTH_USER_KEY = 'buildcrew_user';
const AUTH_REFRESH_KEY = 'buildcrew_refresh_token';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3100/api/v1';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // On mount: restore session from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
    const storedUser = localStorage.getItem(AUTH_USER_KEY);
    const storedRefresh = localStorage.getItem(AUTH_REFRESH_KEY);

    if (!storedToken || !storedUser) {
      setState({ token: null, user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    let user: AuthUser;
    try {
      user = JSON.parse(storedUser) as AuthUser;
    } catch {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
      localStorage.removeItem(AUTH_REFRESH_KEY);
      setState({ token: null, user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    // Set token immediately so API calls work during validation
    api.setToken(storedToken);

    // Validate token
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/users/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });

        if (res.ok) {
          // Token valid
          setState({ token: storedToken, user, isAuthenticated: true, isLoading: false });
          return;
        }

        // Token expired — try refresh
        if (res.status === 401 && storedRefresh) {
          try {
            const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken: storedRefresh }),
            });

            if (refreshRes.ok) {
              const body = await refreshRes.json();
              const newToken = body.data?.accessToken;
              if (newToken) {
                localStorage.setItem(AUTH_TOKEN_KEY, newToken);
                api.setToken(newToken);
                setState({ token: newToken, user, isAuthenticated: true, isLoading: false });
                return;
              }
            }
          } catch {
            // Refresh failed — fall through to logout
          }
        }

        // All attempts failed → logout
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
        localStorage.removeItem(AUTH_REFRESH_KEY);
        api.setToken(null);
        setState({ token: null, user: null, isAuthenticated: false, isLoading: false });
      } catch {
        // Network error → trust local token (offline mode)
        setState({ token: storedToken, user, isAuthenticated: true, isLoading: false });
      }
    })();
  }, []);

  const login = useCallback((token: string, user: AuthUser, refreshToken?: string) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    if (refreshToken) {
      localStorage.setItem(AUTH_REFRESH_KEY, refreshToken);
    }
    api.setToken(token);
    setState({ token, user, isAuthenticated: true, isLoading: false });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_REFRESH_KEY);
    api.setToken(null);
    setState({ token: null, user: null, isAuthenticated: false, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
