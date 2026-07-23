import { get, getList, post } from './api';
import type { Paginated } from '@hrms/shared';
import type { AttendanceQuery } from '@hrms/shared';

export interface AttendanceRecord {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  status: string;
  overtimeMins: number;
  source: string;
  notes: string | null;
  employee?: { id: string; firstName: string; lastName: string; employeeNo: string; department: { name: string } | null };
}

export const attendanceApi = {
  clockIn: (note?: string) => post<AttendanceRecord>('/attendance/clock-in', { note }),
  clockOut: (note?: string) => post<AttendanceRecord>('/attendance/clock-out', { note }),
  myToday: () => get<AttendanceRecord | null>('/attendance/me/today'),

  list: (query: Partial<AttendanceQuery>) =>
    getList<AttendanceRecord>('/attendance', { params: stripEmpty(query) }),

  summary: (params: { from?: string; to?: string; employeeId?: string }) =>
    get<Record<string, { count: number; overtimeMins: number }>>('/attendance/summary', { params: stripEmpty(params) }),

  manualEntry: (data: {
    employeeId: string;
    date: string;
    clockIn?: string | null;
    clockOut?: string | null;
    status?: string;
    notes?: string;
  }) => post<AttendanceRecord>('/attendance/manual', data),
};

function stripEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== '' && v !== null) out[k] = v;
  }
  return out as Partial<T>;
}
