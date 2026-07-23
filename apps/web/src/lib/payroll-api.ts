import { get, post, patch, del } from './api';

export interface PayComponent {
  id: string;
  code: string;
  name: string;
  type: 'earning' | 'deduction' | 'tax';
  calcMode: 'fixed' | 'percentage' | 'formula';
  value: number;
  taxable: boolean;
  isSystem: boolean;
}

export interface StructureComponentInput {
  code: string;
  calcMode: 'fixed' | 'percentage' | 'formula';
  value: number;
}

export interface SalaryStructure {
  id: string;
  name: string;
  components: StructureComponentInput[];
  effectiveFrom: string;
  _count?: { assignments: number };
}

export interface TaxTable {
  id: string;
  name: string;
  country: string;
  year: number;
  brackets: { from: number; to: number | null; rate: number }[];
}

export interface PayslipLine {
  code: string;
  name: string;
  type: 'earning' | 'deduction' | 'tax';
  amount: number;
}

export interface PayRun {
  id: string;
  month: number;
  year: number;
  status: string;
  totals: { gross: number; deductions: number; tax: number; net: number; count: number };
  runAt: string | null;
  _count?: { payslips: number };
  payslips?: Payslip[];
}

export interface Payslip {
  id: string;
  gross: number;
  deductions: number;
  tax: number;
  net: number;
  components: PayslipLine[];
  status: string;
  createdAt: string;
  employee?: { id: string; firstName: string; lastName: string; employeeNo: string };
  payRun?: { month: number; year: number; status: string };
}

export const payrollApi = {
  // components
  listComponents: () => get<PayComponent[]>('/payroll/components'),
  createComponent: (data: Partial<PayComponent>) => post<PayComponent>('/payroll/components', data),
  updateComponent: (id: string, data: Partial<PayComponent>) => patch<PayComponent>(`/payroll/components/${id}`, data),
  deleteComponent: (id: string) => del<void>(`/payroll/components/${id}`),

  // structures
  listStructures: () => get<SalaryStructure[]>('/payroll/structures'),
  createStructure: (data: { name: string; components: StructureComponentInput[] }) =>
    post<SalaryStructure>('/payroll/structures', data),
  deleteStructure: (id: string) => del<void>(`/payroll/structures/${id}`),

  // assignments
  assignStructure: (employeeId: string, salaryStructureId: string) =>
    post<unknown>(`/payroll/employees/${employeeId}/assignment`, { salaryStructureId }),
  getEmployeeStructure: (employeeId: string) =>
    get<{ structure: SalaryStructure } | null>(`/payroll/employees/${employeeId}/assignment`),

  // tax tables
  listTaxTables: () => get<TaxTable[]>('/payroll/tax-tables'),
  createTaxTable: (data: Omit<TaxTable, 'id'>) => post<TaxTable>('/payroll/tax-tables', data),

  // pay runs
  listPayRuns: () => get<PayRun[]>('/payroll/runs'),
  getPayRun: (id: string) => get<PayRun>(`/payroll/runs/${id}`),
  createPayRun: (month: number, year: number) => post<PayRun>('/payroll/runs', { month, year }),
  processPayRun: (id: string) => post<PayRun>(`/payroll/runs/${id}/process`),
  lockPayRun: (id: string) => post<PayRun>(`/payroll/runs/${id}/lock`),

  // payslips
  getPayslip: (id: string) => get<Payslip>(`/payroll/payslips/${id}`),
  myPayslips: () => get<Payslip[]>('/payroll/me/payslips'),
};
