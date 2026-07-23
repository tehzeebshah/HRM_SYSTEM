import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthResponse } from '@hrms/shared';
import { get, post, setAccessToken, setUnauthorizedHandler } from './api';
import { installRefreshInterceptor } from './refresh';

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface SessionTenant {
  id: string;
  name: string;
  role: string;
}

interface AuthState {
  user: SessionUser | null;
  tenant: SessionTenant | null;
  mfaEnabled: boolean;
  status: 'loading' | 'authenticated' | 'unauthenticated';
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<{ requiresMfa: boolean; challengeToken?: string }>;
  verifyMfa: (challengeToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'hrms.access_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    tenant: null,
    mfaEnabled: false,
    status: 'loading',
  });

  const applySession = useCallback((session: AuthResponse) => {
    setAccessToken(session.accessToken);
    localStorage.setItem(STORAGE_KEY, session.accessToken);
    setState({
      user: session.user,
      tenant: session.tenant,
      mfaEnabled: false,
      status: 'authenticated',
    });
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    localStorage.removeItem(STORAGE_KEY);
    setState((s) => ({ user: null, tenant: null, mfaEnabled: false, status: 'unauthenticated' }));
  }, []);

  // Wire up the unauthorized handler + install refresh interceptor once.
  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    installRefreshInterceptor(clearSession);
  }, [clearSession]);

  // On mount: try to restore session via /auth/me (refresh cookie rotates access token).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) setAccessToken(cached);
      try {
        const me = await get<{
          user: AuthResponse['user'];
          tenant: AuthResponse['tenant'];
          mfaEnabled: boolean;
        }>('/auth/me');
        if (!cancelled) {
          setState({
            user: me.user,
            tenant: me.tenant,
            mfaEnabled: me.mfaEnabled,
            status: 'authenticated',
          });
        }
      } catch {
        if (!cancelled) clearSession();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login: async (email, password) => {
        const result = await post<{ requiresMfa: boolean; challengeToken?: string; accessToken?: string; user?: AuthResponse['user']; tenant?: AuthResponse['tenant'] }>(
          '/auth/login',
          { email, password },
        );
        if (result.requiresMfa) {
          return { requiresMfa: true, challengeToken: result.challengeToken };
        }
        // Full session returned inline (MFA not enabled).
        applySession({
          accessToken: result.accessToken!,
          expiresIn: 900,
          user: result.user!,
          tenant: result.tenant!,
        });
        return { requiresMfa: false };
      },
      verifyMfa: async (challengeToken, code) => {
        const session = await post<AuthResponse>('/auth/mfa/verify', { challengeToken, code });
        applySession(session);
      },
      logout: async () => {
        try {
          await post('/auth/logout', {});
        } catch {
          // ignore network errors on logout
        }
        clearSession();
      },
    }),
    [state, applySession, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
