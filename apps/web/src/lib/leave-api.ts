import { get, getList, post, patch, del, put } from './api';
import type { Paginated } from '@hrms/shared';
import type { LeaveRequestQuery } from '@hrms/shared';

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  accrualRate: number;
  carryForward: boolean;
  paid: boolean;
  color: string | null;
  _count?: { requests: number };
}

export interface LeaveRequest {
  id: string;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string | null;
  status: string;
  decisionNote: string | null;
  decisionAt: string | null;
  createdAt: string;
  leaveType: { id: string; name: string; code: string; paid: boolean };
  employee?: { id: string; firstName: string; lastName: string; department: { name: string } | null };
  approver?: { id: string; firstName: string; lastName: string } | null;
}

export interface LeaveBalanceView {
  id: string;
  leaveTypeId: string;
  name: string;
  code: string;
  paid: boolean;
  color: string | null;
  allocated: number;
  used: number;
  carried: number;
  remaining: number;
}

export interface LeaveBalancesResponse {
  year: number;
  balances: LeaveBalanceView[];
}

export const leaveApi = {
  // types
  listTypes: () => get<LeaveType[]>('/leave/types'),
  createType: (data: Partial<LeaveType>) => post<LeaveType>('/leave/types', data),
  updateType: (id: string, data: Partial<LeaveType>) => patch<LeaveType>(`/leave/types/${id}`, data),
  deleteType: (id: string) => del<void>(`/leave/types/${id}`),

  // self
  myRequests: () => get<Paginated<LeaveRequest>>('/leave/me/requests').then((r) => r),
  myBalances: (year?: number) =>
    get<LeaveBalancesResponse>('/leave/me/balances', { params: year ? { year } : undefined }),
  createRequest: (data: { leaveTypeId: string; fromDate: string; toDate: string; reason?: string }) =>
    post<LeaveRequest>('/leave/me/requests', data),
  cancelRequest: (id: string) => del<LeaveRequest>(`/leave/me/requests/${id}`),

  // admin / approvals
  listRequests: (query: Partial<LeaveRequestQuery>) =>
    getList<LeaveRequest>('/leave/requests', { params: stripEmpty(query) }),
  decide: (id: string, decision: { status: 'approved' | 'rejected'; decisionNote?: string }) =>
    post<LeaveRequest>(`/leave/requests/${id}/decision`, decision),

  employeeBalances: (employeeId: string) =>
    get<LeaveBalancesResponse>(`/leave/employees/${employeeId}/balances`),
  setAllocation: (employeeId: string, leaveTypeId: string, allocated: number) =>
    put<unknown>(`/leave/employees/${employeeId}/balances/${leaveTypeId}`, { allocated }),
};

function stripEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== '' && v !== null) out[k] = v;
  }
  return out as Partial<T>;
}
