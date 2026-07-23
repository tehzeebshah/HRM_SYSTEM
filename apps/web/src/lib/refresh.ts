import http, { setAccessToken } from './api';
import type { AuthResponse } from '@hrms/shared';

let refreshing: Promise<string | null> | null = null;
let refreshEndpoint = '/auth/refresh';

export function setRefreshEndpoint(endpoint: string) {
  refreshEndpoint = endpoint;
}

/**
 * Requests a new access token using the httpOnly refresh cookie.
 * Concurrent callers share a single in-flight promise.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const res = await http.post<{ data: AuthResponse }>(refreshEndpoint, undefined, {
        // Avoid recursive interception on the refresh call itself.
        _skipAuthRetry: true,
      });
      const token = res.data.data.accessToken;
      setAccessToken(token);
      return token;
    } catch {
      setAccessToken(null);
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

declare module 'axios' {
  interface AxiosRequestConfig {
    _skipAuthRetry?: boolean;
    _retry?: boolean;
  }
}

/** Install the 401 → refresh → retry interceptor on the shared instance. */
export function installRefreshInterceptor(onSessionLost: () => void) {
  http.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error?.config;
      if (
        error?.response?.status === 401 &&
        original &&
        !original._skipAuthRetry &&
        !original._retry &&
        !original.url?.includes('/auth/')
      ) {
        original._retry = true;
        const newToken = await refreshAccessToken();
        if (newToken) {
          original.headers = original.headers ?? {};
          (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
          return http(original);
        }
        onSessionLost();
      }
      return Promise.reject(error);
    },
  );
}
