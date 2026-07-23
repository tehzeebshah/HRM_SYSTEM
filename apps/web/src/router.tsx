import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { PublicOnlyGuard, RequireAuth, RequireRoles } from '@/components/guards';
import { LoginPage } from '@/pages/LoginPage';
import { MfaVerifyPage } from '@/pages/MfaVerifyPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { EmployeesPage } from '@/pages/EmployeesPage';
import { EmployeeDetailPage } from '@/pages/EmployeeDetailPage';
import { OrganizationPage } from '@/pages/OrganizationPage';
import { AttendancePage } from '@/pages/AttendancePage';
import { LeavePage } from '@/pages/LeavePage';
import { PayrollPage } from '@/pages/PayrollPage';
import { PerformancePage } from '@/pages/PerformancePage';
import { RecruitmentPage } from '@/pages/RecruitmentPage';
import { AssetsPage } from '@/pages/AssetsPage';
import { EngagementPage } from '@/pages/EngagementPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* public */}
        <Route element={<PublicOnlyGuard />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify-mfa" element={<MfaVerifyPage />} />
        </Route>

        {/* authenticated app shell */}
        <Route element={<RequireAuth />}>
          <Route
            element={
              <AppShell>
                <Outlet />
              </AppShell>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/leave" element={<LeavePage />} />
            <Route
              path="/employees"
              element={
                <RequireRoles roles={['admin', 'hr', 'manager']}>
                  <EmployeesPage />
                </RequireRoles>
              }
            />
            <Route
              path="/employees/:id"
              element={
                <RequireRoles roles={['admin', 'hr', 'manager']}>
                  <EmployeeDetailPage />
                </RequireRoles>
              }
            />
            <Route
              path="/organization"
              element={
                <RequireRoles roles={['admin', 'hr']}>
                  <OrganizationPage />
                </RequireRoles>
              }
            />
            <Route path="/payroll" element={<PayrollPage />} />
            <Route path="/performance" element={<PerformancePage />} />
            <Route path="/recruitment" element={<RequireRoles roles={['admin', 'hr', 'manager']}><RecruitmentPage /></RequireRoles>} />
            <Route path="/assets" element={<RequireRoles roles={['admin', 'hr']}><AssetsPage /></RequireRoles>} />
            <Route path="/engagement" element={<EngagementPage />} />
            <Route path="/reports" element={<RequireRoles roles={['admin', 'hr', 'manager']}><ReportsPage /></RequireRoles>} />
            <Route
              path="/settings"
              element={
                <RequireRoles roles={['admin']}>
                  <PlaceholderPage title="Settings" description="Tenant configuration, roles and audit log." />
                </RequireRoles>
              }
            />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
