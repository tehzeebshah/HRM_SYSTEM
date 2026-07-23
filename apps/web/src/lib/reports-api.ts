import { get } from './api';

export interface OrgDashboard {
  scope: 'org';
  headcount: number;
  onLeaveToday: number;
  pendingApprovals: number;
  lastPayRun: { month: number; year: number; status: string; totals: { gross?: number; net?: number; tax?: number } | null } | null;
  departments: { name: string; count: number }[];
  gender: { label: string; count: number }[];
  employmentTypes: { label: string; count: number }[];
  assets: { label: string; count: number }[];
}

export interface TeamDashboard {
  scope: 'team';
  teamSize: number;
  pendingApprovals: number;
  onLeaveToday: number;
}

export interface PersonalDashboard {
  scope: 'personal';
  leaveRemaining: number;
  leaveBreakdown: { name: string; remaining: number }[];
  lastPayslip: { net: number; month: number; year: number } | null;
  pendingLeave: number;
}

export type DashboardData = OrgDashboard | TeamDashboard | PersonalDashboard | { scope: 'none'; tenant: { headcount: number } };

export const reportsApi = {
  dashboard: () => get<DashboardData>('/reports/dashboard'),
  headcount: () => get<unknown>('/reports/headcount'),
  attendance: () => get<unknown>('/reports/attendance'),
  leave: (year?: number) => get<unknown>('/reports/leave', { params: year ? { year } : undefined }),
  payroll: () => get<unknown>('/reports/payroll'),
  assets: () => get<unknown>('/reports/assets'),

  csvUrl: (report: 'headcount' | 'payroll' | 'employees') =>
    `${import.meta.env.VITE_API_BASE_URL ?? '/api'}/reports/${report}.csv`,
};
