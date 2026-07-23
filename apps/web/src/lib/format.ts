import type { EmployeeStatus, EmploymentType } from '@hrms/shared';

export function statusVariant(status: string): 'success' | 'warning' | 'destructive' | 'secondary' {
  switch (status as EmployeeStatus) {
    case 'active':
      return 'success';
    case 'on_leave':
      return 'warning';
    case 'suspended':
    case 'exited':
      return 'destructive';
    default:
      return 'secondary';
  }
}

export function formatLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const EMPLOYMENT_TYPES: EmploymentType[] = ['full_time', 'part_time', 'contract', 'intern', 'probation'];
export const EMPLOYEE_STATUSES: EmployeeStatus[] = ['active', 'on_leave', 'suspended', 'exited'];
