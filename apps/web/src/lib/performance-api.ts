import { get, post, patch, del } from './api';

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  weight: number;
  progress: number;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  dueDate: string | null;
  createdAt: string;
}

export interface GoalSummary {
  totalGoals: number;
  overallProgress: number;
}

export interface ReviewCycle {
  id: string;
  name: string;
  period: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  _count?: { reviews: number };
}

export interface Review {
  id: string;
  status: string;
  dueDate: string | null;
  submittedAt: string | null;
  overallRating: number | null;
  createdAt: string;
  cycle: { id: string; name: string; period: string; status: string };
  employee: { id: string; firstName: string; lastName: string; department: { name: string } | null } | null;
  reviewer: { id: string; firstName: string; lastName: string } | null;
  feedback?: { id: string; ratings: Record<string, number>; comments: string | null; reviewer: { id: string; firstName: string; lastName: string } }[];
}

export interface RatingScale {
  id: string;
  name: string;
  levels: { value: number; label: string; color?: string }[];
}

export const performanceApi = {
  // goals
  myGoals: () => get<{ goals: Goal[]; summary: GoalSummary }>('/performance/me/goals'),
  createGoal: (data: { title: string; description?: string; weight?: number; dueDate?: string }) =>
    post<Goal>('/performance/me/goals', data),
  updateGoal: (id: string, data: Partial<Goal>) => patch<Goal>(`/performance/goals/${id}`, data),
  deleteGoal: (id: string) => del<void>(`/performance/goals/${id}`),

  // cycles
  listCycles: () => get<ReviewCycle[]>('/performance/cycles'),
  createCycle: (data: { name: string; period: string; type: string; startDate: string; endDate: string }) =>
    post<ReviewCycle>('/performance/cycles', data),
  updateCycle: (id: string, data: Partial<ReviewCycle>) => patch<ReviewCycle>(`/performance/cycles/${id}`, data),

  // reviews
  listReviews: (params: { cycleId?: string; status?: string; reviewerId?: string; employeeId?: string }) =>
    get<Review[]>('/performance/reviews', { params }),
  getReview: (id: string) => get<Review>(`/performance/reviews/${id}`),
  createReview: (data: { cycleId: string; employeeId: string; reviewerId: string; dueDate?: string }) =>
    post<Review>('/performance/reviews', data),
  submitReview: (id: string, data: { ratings: Record<string, number>; comments?: string; overallRating?: number }) =>
    post<Review>(`/performance/reviews/${id}/submit`, data),

  // rating scales
  listRatingScales: () => get<RatingScale[]>('/performance/rating-scales'),
};
