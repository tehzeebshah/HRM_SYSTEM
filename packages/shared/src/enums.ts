/**
 * System-wide role codes assigned to a user within a tenant.
 * Stored on TenantMembership.role. RBAC guard maps these to fine-grained
 * permissions via the RolePermission table (configurable per tenant later).
 */
export const RoleCode = {
  ADMIN: 'admin',
  HR: 'hr',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
} as const;

export type RoleCode = (typeof RoleCode)[keyof typeof RoleCode];

export const ALL_ROLES: RoleCode[] = [
  RoleCode.ADMIN,
  RoleCode.HR,
  RoleCode.MANAGER,
  RoleCode.EMPLOYEE,
];

/**
 * Fine-grained permission strings: "<module>.<action>[.<scope>]".
 * The default role -> permission matrix is seeded into the DB; tenants may
 * extend it. Used by the @Permissions() guard on the API and route guards
 * on the Web.
 */
export const Permission = {
  // employees
  EMPLOYEE_VIEW: 'employee.view',
  EMPLOYEE_CREATE: 'employee.create',
  EMPLOYEE_UPDATE: 'employee.update',
  EMPLOYEE_DELETE: 'employee.delete',
  // organization
  ORG_MANAGE: 'org.manage',
  // attendance
  ATTENDANCE_VIEW: 'attendance.view',
  ATTENDANCE_MANAGE: 'attendance.manage',
  ATTENDANCE_CLOCK: 'attendance.clock',
  // leave
  LEAVE_REQUEST: 'leave.request',
  LEAVE_APPROVE: 'leave.approve',
  LEAVE_MANAGE: 'leave.manage',
  // payroll
  PAYROLL_VIEW_OWN: 'payroll.view_own',
  PAYROLL_VIEW_ALL: 'payroll.view_all',
  PAYROLL_RUN: 'payroll.run',
  PAYROLL_MANAGE: 'payroll.manage',
  // performance
  PERFORMANCE_VIEW: 'performance.view',
  PERFORMANCE_MANAGE: 'performance.manage',
  // recruitment
  RECRUIT_VIEW: 'recruit.view',
  RECRUIT_MANAGE: 'recruit.manage',
  // assets
  ASSET_VIEW: 'asset.view',
  ASSET_MANAGE: 'asset.manage',
  // engagement
  ENGAGEMENT_MANAGE: 'engagement.manage',
  // reports
  REPORT_VIEW: 'report.view',
  REPORT_MANAGE: 'report.manage',
  // system
  TENANT_MANAGE: 'tenant.manage',
  USER_MANAGE: 'user.manage',
  ROLE_MANAGE: 'role.manage',
  AUDIT_VIEW: 'audit.view',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

/**
 * Default role -> permission matrix (seeded). Tenants can override later.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  [RoleCode.ADMIN]: Object.values(Permission),
  [RoleCode.HR]: [
    Permission.EMPLOYEE_VIEW,
    Permission.EMPLOYEE_CREATE,
    Permission.EMPLOYEE_UPDATE,
    Permission.ORG_MANAGE,
    Permission.ATTENDANCE_VIEW,
    Permission.ATTENDANCE_MANAGE,
    Permission.LEAVE_APPROVE,
    Permission.LEAVE_MANAGE,
    Permission.PAYROLL_VIEW_ALL,
    Permission.PAYROLL_RUN,
    Permission.PAYROLL_MANAGE,
    Permission.PERFORMANCE_VIEW,
    Permission.PERFORMANCE_MANAGE,
    Permission.RECRUIT_VIEW,
    Permission.RECRUIT_MANAGE,
    Permission.ASSET_VIEW,
    Permission.ASSET_MANAGE,
    Permission.ENGAGEMENT_MANAGE,
    Permission.REPORT_VIEW,
    Permission.REPORT_MANAGE,
    Permission.USER_MANAGE,
    Permission.AUDIT_VIEW,
  ],
  [RoleCode.MANAGER]: [
    Permission.EMPLOYEE_VIEW,
    Permission.ATTENDANCE_VIEW,
    Permission.LEAVE_APPROVE,
    Permission.PERFORMANCE_VIEW,
    Permission.PERFORMANCE_MANAGE,
    Permission.RECRUIT_VIEW,
    Permission.ASSET_VIEW,
    Permission.REPORT_VIEW,
  ],
  [RoleCode.EMPLOYEE]: [
    Permission.ATTENDANCE_VIEW,
    Permission.ATTENDANCE_CLOCK,
    Permission.LEAVE_REQUEST,
    Permission.PAYROLL_VIEW_OWN,
    Permission.PERFORMANCE_VIEW,
    Permission.ASSET_VIEW,
  ],
};

export const EmploymentType = {
  FULL_TIME: 'full_time',
  PART_TIME: 'part_time',
  CONTRACT: 'contract',
  INTERN: 'intern',
  PROBATION: 'probation',
} as const;
export type EmploymentType = (typeof EmploymentType)[keyof typeof EmploymentType];

export const EmployeeStatus = {
  ACTIVE: 'active',
  ON_LEAVE: 'on_leave',
  SUSPENDED: 'suspended',
  EXITED: 'exited',
} as const;
export type EmployeeStatus = (typeof EmployeeStatus)[keyof typeof EmployeeStatus];

export const Gender = {
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other',
  UNSPECIFIED: 'unspecified',
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const LeaveRequestStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
} as const;
export type LeaveRequestStatus = (typeof LeaveRequestStatus)[keyof typeof LeaveRequestStatus];

export const PayRunStatus = {
  DRAFT: 'draft',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  LOCKED: 'locked',
  FAILED: 'failed',
} as const;
export type PayRunStatus = (typeof PayRunStatus)[keyof typeof PayRunStatus];

export const ApplicationStage = {
  APPLIED: 'applied',
  SCREENING: 'screening',
  INTERVIEW: 'interview',
  OFFER: 'offer',
  HIRED: 'hired',
  REJECTED: 'rejected',
} as const;
export type ApplicationStage = (typeof ApplicationStage)[keyof typeof ApplicationStage];

export const AssetStatus = {
  AVAILABLE: 'available',
  ASSIGNED: 'assigned',
  IN_REPAIR: 'in_repair',
  RETIRED: 'retired',
} as const;
export type AssetStatus = (typeof AssetStatus)[keyof typeof AssetStatus];

export const MembershipStatus = {
  ACTIVE: 'active',
  INVITED: 'invited',
  SUSPENDED: 'suspended',
  REVOKED: 'revoked',
} as const;
export type MembershipStatus = (typeof MembershipStatus)[keyof typeof MembershipStatus];
