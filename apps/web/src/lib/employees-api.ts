import { getList, get, post, patch, del } from './api';
import type { Paginated } from '@hrms/shared';
import type { EmployeeQuery } from '@hrms/shared';

export interface EmployeeListItem {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  status: string;
  employmentType: string;
  department: { id: string; name: string } | null;
  designation: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  manager: { id: string; firstName: string; lastName: string } | null;
  hireDate: string;
}

export interface EmployeeDetail extends EmployeeListItem {
  dob: Date | null;
  gender: string;
  maritalStatus: string | null;
  nationality: string | null;
  idNumber: string | null;
  confirmDate: string | null;
  documents: EmployeeDocument[];
  _count: { reports: number; leaveRequests: number };
}

export interface EmployeeDocument {
  id: string;
  type: string;
  name: string;
  mimeType: string;
  size: number;
  expiry: string | null;
  uploadedAt: string;
}

export interface EmployeeFormData {
  employeeNo: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  gender?: string;
  employmentType?: string;
  status?: string;
  departmentId?: string | null;
  designationId?: string | null;
  locationId?: string | null;
  managerId?: string | null;
  hireDate: string;
  confirmDate?: string;
}

export const employeesApi = {
  list: (query: Partial<EmployeeQuery>) =>
    getList<EmployeeListItem>('/employees', { params: stripEmpty(query) }),

  get: (id: string) => get<EmployeeDetail>(`/employees/${id}`),

  create: (data: EmployeeFormData) => post<EmployeeListItem>('/employees', data),

  update: (id: string, data: Partial<EmployeeFormData>) =>
    patch<EmployeeListItem>(`/employees/${id}`, data),

  remove: (id: string) => del<void>(`/employees/${id}`),

  referenceData: () =>
    get<{
      departments: { id: string; name: string }[];
      designations: { id: string; name: string }[];
      locations: { id: string; name: string }[];
    }>('/employees/reference-data'),

  listDocuments: (employeeId: string) =>
    get<EmployeeDocument[]>(`/employees/${employeeId}/documents`),

  uploadDocument: (employeeId: string, file: File, fields: { type: string; name?: string; expiry?: string }) => {
    const form = new FormData();
    form.append('file', file);
    form.append('type', fields.type);
    if (fields.name) form.append('name', fields.name);
    if (fields.expiry) form.append('expiry', fields.expiry);
    return post<EmployeeDocument>(`/employees/${employeeId}/documents`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  deleteDocument: (employeeId: string, documentId: string) =>
    del<void>(`/employees/${employeeId}/documents/${documentId}`),

  documentDownloadUrl: (employeeId: string, documentId: string) =>
    `${import.meta.env.VITE_API_BASE_URL ?? '/api'}/employees/${employeeId}/documents/${documentId}/download`,
};

function stripEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== '' && v !== null) out[k] = v;
  }
  return out as Partial<T>;
}
