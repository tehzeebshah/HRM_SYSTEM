import { get, post, patch, del } from './api';

export interface Department {
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
  description: string | null;
  parent?: { id: string; name: string } | null;
  _count?: { employees: number };
}

export interface Designation {
  id: string;
  name: string;
  grade: string | null;
  description: string | null;
  _count?: { employees: number };
}

export interface Location {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  timezone: string | null;
  _count?: { employees: number };
}

export const organizationApi = {
  listDepartments: () => get<Department[]>('/organization/departments'),
  createDepartment: (data: Partial<Department>) => post<Department>('/organization/departments', data),
  updateDepartment: (id: string, data: Partial<Department>) =>
    patch<Department>(`/organization/departments/${id}`, data),
  deleteDepartment: (id: string) => del<void>(`/organization/departments/${id}`),

  listDesignations: () => get<Designation[]>('/organization/designations'),
  createDesignation: (data: Partial<Designation>) => post<Designation>('/organization/designations', data),
  updateDesignation: (id: string, data: Partial<Designation>) =>
    patch<Designation>(`/organization/designations/${id}`, data),
  deleteDesignation: (id: string) => del<void>(`/organization/designations/${id}`),

  listLocations: () => get<Location[]>('/organization/locations'),
  createLocation: (data: Partial<Location>) => post<Location>('/organization/locations', data),
  updateLocation: (id: string, data: Partial<Location>) =>
    patch<Location>(`/organization/locations/${id}`, data),
  deleteLocation: (id: string) => del<void>(`/organization/locations/${id}`),
};
