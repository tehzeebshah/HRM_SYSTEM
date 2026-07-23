import { get, post, patch, del } from './api';

export interface Asset {
  id: string;
  code: string;
  name: string;
  category: string | null;
  serial: string | null;
  status: string;
  value: number | null;
  notes: string | null;
  assignments: { id: string; employee: { id: string; firstName: string; lastName: string } }[];
}

export const assetApi = {
  list: (params?: { q?: string; status?: string }) => get<Asset[]>('/assets', { params }),
  create: (data: Record<string, unknown>) => post<Asset>('/assets', data),
  update: (id: string, data: Record<string, unknown>) => patch<Asset>(`/assets/${id}`, data),
  remove: (id: string) => del<void>(`/assets/${id}`),
  assign: (id: string, employeeId: string, condition?: string) =>
    post(`/assets/${id}/assign`, { employeeId, condition }),
  return: (id: string, condition?: string) => post(`/assets/${id}/return`, { condition }),
  history: (id: string) => get<unknown[]>(`/assets/${id}/history`),
};
