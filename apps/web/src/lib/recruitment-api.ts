import { get, post, patch } from './api';

export interface JobOpening {
  id: string;
  title: string;
  department: { id: string; name: string } | null;
  headcount: number;
  type: string;
  status: string;
  description: string | null;
  _count?: { applications: number };
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  source: string | null;
  _count?: { applications: number };
}

export interface Application {
  id: string;
  stage: string;
  rating: number | null;
  rejectedReason: string | null;
  updatedAt: string;
  candidate: { id: string; name: string; email: string; phone: string | null; source: string | null };
  jobOpening: { id: string; title: string };
}

export const STAGES = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'] as const;

export const recruitmentApi = {
  listOpenings: () => get<JobOpening[]>('/recruitment/openings'),
  createOpening: (data: Partial<JobOpening> & { title: string }) => post<JobOpening>('/recruitment/openings', data),
  updateOpening: (id: string, data: Partial<JobOpening>) => patch<JobOpening>(`/recruitment/openings/${id}`, data),

  listCandidates: (q?: string) => get<Candidate[]>('/recruitment/candidates', { params: q ? { q } : undefined }),
  createCandidate: (data: Partial<Candidate> & { name: string; email: string }) =>
    post<Candidate>('/recruitment/candidates', data),

  listApplications: (params?: { jobOpeningId?: string; stage?: string }) =>
    get<Application[]>('/recruitment/applications', { params }),
  createApplication: (jobOpeningId: string, candidateId: string) =>
    post<Application>('/recruitment/applications', { jobOpeningId, candidateId }),
  moveApplication: (id: string, stage: string, rejectedReason?: string) =>
    post<Application>(`/recruitment/applications/${id}/move`, { stage, rejectedReason }),
};
