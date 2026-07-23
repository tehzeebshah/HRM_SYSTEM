/**
 * Local demo mode — fully client-side mock of the API. No backend, no DB.
 * Enable with VITE_DEMO_MODE=true. Lets you click through the entire HRMS UI.
 */

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

export const DEMO_USER = {
  id: 'd1-user',
  email: 'admin@acme.demo',
  firstName: 'Ada',
  lastName: 'Admin',
  avatarUrl: null,
};
export const DEMO_TENANT = { id: 'd1-tenant', name: 'Acme Demo Co.', role: 'admin' };

const DEPARTMENTS = [
  { id: 'd1', name: 'Engineering', code: 'ENG', parentId: null, description: 'Product & platform', parent: null, _count: { employees: 6 } },
  { id: 'd2', name: 'People Ops', code: 'HR', parentId: null, description: null, parent: null, _count: { employees: 2 } },
  { id: 'd3', name: 'Finance', code: 'FIN', parentId: null, description: null, parent: null, _count: { employees: 2 } },
  { id: 'd4', name: 'Sales', code: 'SAL', parentId: null, description: null, parent: null, _count: { employees: 3 } },
];
const DESIGNATIONS = [
  { id: 'g1', name: 'Senior Engineer', grade: 'L4', description: null, _count: { employees: 3 } },
  { id: 'g2', name: 'Engineering Manager', grade: 'M1', description: null, _count: { employees: 1 } },
  { id: 'g3', name: 'HR Business Partner', grade: 'L3', description: null, _count: { employees: 1 } },
  { id: 'g4', name: 'Accountant', grade: 'L3', description: null, _count: { employees: 2 } },
];
const LOCATIONS = [
  { id: 'l1', name: 'HQ — Berlin', address: null, city: 'Berlin', country: 'DE', timezone: 'Europe/Berlin', _count: { employees: 9 } },
  { id: 'l2', name: 'Remote', address: null, city: null, country: null, timezone: null, _count: { employees: 4 } },
];

const FIRST = ['Lena', 'Marco', 'Priya', 'Tom', 'Sara', 'Yuki', 'David', 'Nina', 'Omar', 'Clara', 'Ravi', 'Mia', 'Jonas', 'Eva'];
const LAST = ['Schmidt', 'Rossi', 'Patel', 'Walker', 'Kim', 'Tanaka', 'Cohen', 'Diaz', 'Haddad', 'Novak', 'Reddy', 'Wong'];
const STATUSES = ['active', 'active', 'active', 'active', 'on_leave', 'active'];
const TYPES = ['full_time', 'full_time', 'full_time', 'contract', 'part_time'];

export const EMPLOYEES = Array.from({ length: 13 }).map((_, i) => {
  const fn = FIRST[i % FIRST.length]!;
  const ln = LAST[i % LAST.length]!;
  const dept = DEPARTMENTS[i % DEPARTMENTS.length]!;
  const desig = DESIGNATIONS[i % DESIGNATIONS.length]!;
  return {
    id: `e${i + 1}`,
    employeeNo: `EMP-${String(1001 + i)}`,
    firstName: fn,
    lastName: ln,
    email: `${fn.toLowerCase()}.${ln.toLowerCase()}@acme.demo`,
    phone: '+49 30 555 ' + String(1000 + i),
    avatarUrl: null,
    status: STATUSES[i % STATUSES.length]!,
    employmentType: TYPES[i % TYPES.length]!,
    department: { id: dept.id, name: dept.name },
    designation: { id: desig.id, name: desig.name },
    location: { id: 'l1', name: 'HQ — Berlin' },
    manager: i > 0 ? { id: 'e1', firstName: FIRST[0]!, lastName: LAST[0]! } : null,
    hireDate: new Date(2021, i % 12, (i % 27) + 1).toISOString(),
  };
});

export const ANNOUNCEMENTS = [
  {
    id: 'a1',
    title: 'Welcome to the HRMS demo',
    body: 'This is a fully interactive local preview of your HRMS. All data shown is sample data.\n\nExplore employees, attendance, leave, payroll, performance and more from the sidebar.',
    audience: 'all',
    publishedAt: new Date().toISOString(),
    expiry: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'a2',
    title: 'Quarterly all-hands — Friday',
    body: 'Join us Friday 16:00 CET for the Q3 company update. Link in the calendar invite.',
    audience: 'all',
    publishedAt: new Date(Date.now() - 86400_000).toISOString(),
    expiry: null,
    createdAt: new Date(Date.now() - 86400_000).toISOString(),
  },
];

export const PAY_RUNS = [
  { id: 'pr1', month: new Date().getMonth() + 1, year: new Date().getFullYear(), status: 'completed', totals: { gross: 78400, deductions: 9400, tax: 16800, net: 52200, count: 13 }, runAt: new Date().toISOString(), _count: { payslips: 13 } },
  { id: 'pr2', month: new Date().getMonth() === 0 ? 12 : new Date().getMonth(), year: new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear(), status: 'locked', totals: { gross: 77100, deductions: 9200, tax: 16500, net: 51400, count: 13 }, runAt: new Date(), _count: { payslips: 13 } },
];

export const MY_PAYSLIPS = [
  {
    id: 'ps1', gross: 7800, deductions: 780, tax: 1680, net: 5340, status: 'generated', createdAt: new Date().toISOString(),
    payRun: { month: new Date().getMonth() + 1, year: new Date().getFullYear(), status: 'completed' },
    components: [
      { code: 'basic', name: 'Basic', type: 'earning', amount: 6000 },
      { code: 'hra', name: 'Housing allowance', type: 'earning', amount: 1800 },
      { code: 'pension', name: 'Pension', type: 'deduction', amount: 780 },
      { code: 'tax', name: 'Income Tax', type: 'tax', amount: 1680 },
    ],
  },
];

export const GOALS = [
  { id: 'go1', title: 'Ship onboarding revamp', description: 'New hire flow + self-service portal', weight: 2, progress: 70, status: 'active', dueDate: null, createdAt: new Date().toISOString() },
  { id: 'go2', title: 'Reduce time-to-hire to 21 days', description: null, weight: 1, progress: 40, status: 'active', dueDate: null, createdAt: new Date().toISOString() },
];

/** Resolves a (method, url) to a mock response body (already unwrapped). */
export function demoResolve(method: string, url: string, _body: unknown): unknown {
  const u = url.replace(/^\/+/, '');
  // auth
  if (u === 'auth/login' && method === 'post') return { requiresMfa: false, accessToken: 'demo-token', expiresIn: 900, user: DEMO_USER, tenant: DEMO_TENANT };
  if (u === 'auth/me') return { user: DEMO_USER, tenant: DEMO_TENANT, mfaEnabled: false };
  if (u.startsWith('auth/')) return { ok: true };

  // reports / dashboard
  if (u === 'reports/dashboard') {
    return {
      scope: 'org', headcount: EMPLOYEES.length, onLeaveToday: 1, pendingApprovals: 2, lastPayRun: PAY_RUNS[0],
      departments: DEPARTMENTS.map((d) => ({ name: d.name, count: d._count.employees })),
      gender: [{ label: 'female', count: 6 }, { label: 'male', count: 6 }, { label: 'other', count: 1 }],
      employmentTypes: [{ label: 'full_time', count: 9 }, { label: 'contract', count: 1 }, { label: 'part_time', count: 1 }],
      assets: [{ label: 'available', count: 8 }, { label: 'assigned', count: 14 }],
    };
  }
  if (u === 'reports/headcount') return { total: EMPLOYEES.length, byDepartment: DEPARTMENTS.map((d) => ({ name: d.name, count: d._count.employees })), byStatus: [], byEmploymentType: [], byGender: [] };
  if (u === 'reports/payroll') return { runs: PAY_RUNS.map((r) => ({ period: `${r.year}-${String(r.month).padStart(2, '0')}`, status: r.status, payslips: r._count.payslips, net: r.totals.net })) };
  if (u === 'reports/leave') return { year: new Date().getFullYear(), byType: [{ name: 'Annual', days: 24, count: 6 }, { name: 'Sick', days: 8, count: 4 }], totalDays: 32 };
  if (u === 'reports/assets') return { byStatus: [{ status: 'assigned', count: 14 }, { status: 'available', count: 8 }], totalValue: 42000 };

  // employees
  if (u === 'employees') return { data: EMPLOYEES, meta: { page: 1, pageSize: 25, total: EMPLOYEES.length, totalPages: 1 } };
  if (u === 'employees/reference-data') return { departments: DEPARTMENTS.map(({ id, name }) => ({ id, name })), designations: DESIGNATIONS.map(({ id, name }) => ({ id, name })), locations: LOCATIONS.map(({ id, name }) => ({ id, name })) };
  const empMatch = u.match(/^employees\/([^/]+)$/);
  if (empMatch) {
    const e = EMPLOYEES.find((x) => x.id === empMatch[1]);
    return e ? { ...e, dob: null, gender: 'unspecified', maritalStatus: null, nationality: null, idNumber: null, confirmDate: null, documents: [], _count: { reports: 2, leaveRequests: 1 } } : null;
  }

  // organization
  if (u === 'organization/departments') return DEPARTMENTS;
  if (u === 'organization/designations') return DESIGNATIONS;
  if (u === 'organization/locations') return LOCATIONS;

  // attendance
  if (u === 'attendance/me/today') return null;
  if (u === 'attendance') return { data: [], meta: { page: 1, pageSize: 25, total: 0, totalPages: 1 } };

  // leave
  if (u === 'leave/types') return [{ id: 'lt1', name: 'Annual', code: 'ANN', accrualRate: 2, carryForward: true, paid: true, color: null }];
  if (u === 'leave/me/balances') return { year: new Date().getFullYear(), balances: [{ id: 'b1', leaveTypeId: 'lt1', name: 'Annual', code: 'ANN', paid: true, color: null, allocated: 24, used: 6, carried: 0, remaining: 18 }] };
  if (u === 'leave/me/requests') return { data: [], meta: { page: 1, pageSize: 25, total: 0, totalPages: 1 } };
  if (u === 'leave/requests') return { data: [], meta: { page: 1, pageSize: 25, total: 0, totalPages: 1 } };

  // payroll
  if (u === 'payroll/components') return [
    { id: 'c1', code: 'basic', name: 'Basic', type: 'earning', calcMode: 'fixed', value: 0, taxable: false, isSystem: false },
    { id: 'c2', code: 'hra', name: 'Housing', type: 'earning', calcMode: 'percentage', value: 30, taxable: false, isSystem: false },
    { id: 'c3', code: 'pension', name: 'Pension', type: 'deduction', calcMode: 'percentage', value: 5, taxable: false, isSystem: false },
  ];
  if (u === 'payroll/runs') return PAY_RUNS;
  if (u === 'payroll/me/payslips') return MY_PAYSLIPS;

  // performance
  if (u === 'performance/me/goals') return { goals: GOALS, summary: { totalGoals: GOALS.length, overallProgress: 55 } };
  if (u === 'performance/cycles') return [{ id: 'cy1', name: '2026 H1 Review', period: '2026-H1', type: 'annual', status: 'open', startDate: new Date().toISOString(), endDate: new Date().toISOString(), _count: { reviews: 0 } }];
  if (u === 'performance/reviews') return [];

  // recruitment
  if (u === 'recruitment/openings') return [{ id: 'j1', title: 'Senior Backend Engineer', department: DEPARTMENTS[0], headcount: 1, type: 'full_time', status: 'open', description: null, _count: { applications: 4 } }];
  if (u === 'recruitment/applications') return [
    { id: 'ap1', stage: 'applied', rating: null, rejectedReason: null, updatedAt: new Date().toISOString(), candidate: { id: 'ca1', name: 'Alex Carter', email: 'alex@example.com', phone: null, source: 'Referral' }, jobOpening: { id: 'j1', title: 'Senior Backend Engineer' } },
    { id: 'ap2', stage: 'interview', rating: null, rejectedReason: null, updatedAt: new Date().toISOString(), candidate: { id: 'ca2', name: 'Beth Liu', email: 'beth@example.com', phone: null, source: 'LinkedIn' }, jobOpening: { id: 'j1', title: 'Senior Backend Engineer' } },
  ];

  // assets
  if (u === 'assets') return [
    { id: 'as1', code: 'LAP-001', name: 'MacBook Pro 14"', category: 'Laptop', serial: 'C02XK1', status: 'assigned', value: 2400, notes: null, assignments: [{ id: 'aa1', employee: { id: 'e1', firstName: 'Lena', lastName: 'Schmidt' } }] },
    { id: 'as2', code: 'MON-002', name: 'Dell 27" Monitor', category: 'Monitor', serial: 'DN99', status: 'available', value: 380, notes: null, assignments: [] },
  ];

  // engagement
  if (u === 'engagement/announcements') return ANNOUNCEMENTS;
  if (u === 'engagement/portal') return [{ id: 'pd1', title: 'Employee Handbook', category: 'Policies', mimeType: 'application/pdf', size: 240000, audience: 'all', version: 2, updatedAt: new Date().toISOString() }];
  if (u === 'engagement/notifications') return [];

  // generic fallback
  return [];
}
