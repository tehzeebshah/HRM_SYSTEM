import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type { ApiError, Paginated } from '@hrms/shared';
import { DEMO_MODE, demoResolve } from './demo';

const baseURL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';

/** Singleton axios instance. Uses relative `/api` base in dev via Vite proxy. */
export const http: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true, // send refresh cookie
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// --- access token plumbing ---
let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) {
    http.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete http.defaults.headers.common.Authorization;
  }
}

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

// --- typed helpers ---

export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  if (DEMO_MODE) return demoResolve('get', url, undefined) as T;
  const res = await http.get<{ data: T }>(url, config);
  return res.data.data;
}

export async function getList<T>(url: string, config?: AxiosRequestConfig): Promise<Paginated<T>> {
  if (DEMO_MODE) return demoResolve('get', url, undefined) as Paginated<T>;
  const res = await http.get<Paginated<T>>(url, config);
  return res.data;
}

export async function post<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  if (DEMO_MODE) return demoResolve('post', url, body) as T;
  const res = await http.post<{ data: T }>(url, body, config);
  return res.data.data;
}

export async function put<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  if (DEMO_MODE) return demoResolve('put', url, body) as T;
  const res = await http.put<{ data: T }>(url, body, config);
  return res.data.data;
}

export async function patch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  if (DEMO_MODE) return demoResolve('patch', url, body) as T;
  const res = await http.patch<{ data: T }>(url, body, config);
  return res.data.data;
}

export async function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  if (DEMO_MODE) return demoResolve('delete', url, undefined) as T;
  const res = await http.delete<{ data: T }>(url, config);
  return res.data.data;
}

export function isApiError(err: unknown): err is { response?: { data?: ApiError }; message?: string } {
  return axios.isAxiosError(err);
}

export function extractApiMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (isApiError(err)) {
    return err.response?.data?.error?.message ?? err.message ?? fallback;
  }
  return (err as Error)?.message ?? fallback;
}

export { baseURL };
export default http;
