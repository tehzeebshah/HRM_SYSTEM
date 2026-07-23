import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarDays, CalendarCheck, Wallet, Settings, LogOut, UserCircle2, Building2, Target, Briefcase, Package, Megaphone, FileBarChart } from 'lucide-react';
import { cn, initials } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: string[];
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/employees', label: 'Employees', icon: Users, roles: ['admin', 'hr', 'manager'] },
  { to: '/organization', label: 'Organization', icon: Building2, roles: ['admin', 'hr'] },
  { to: '/attendance', label: 'Attendance', icon: CalendarDays },
  { to: '/leave', label: 'Leave', icon: CalendarCheck },
  { to: '/payroll', label: 'Payroll', icon: Wallet },
  { to: '/performance', label: 'Performance', icon: Target },
  { to: '/recruitment', label: 'Recruitment', icon: Briefcase, roles: ['admin', 'hr', 'manager'] },
  { to: '/assets', label: 'Assets', icon: Package, roles: ['admin', 'hr'] },
  { to: '/engagement', label: 'Engagement', icon: Megaphone },
  { to: '/reports', label: 'Reports', icon: FileBarChart, roles: ['admin', 'hr', 'manager'] },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();

  const items = NAV.filter((item) => !item.roles || (tenant && item.roles.includes(tenant.role)));

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-64 shrink-0 border-r bg-card md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
            H
          </div>
          <span className="text-lg font-semibold">HRMS</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-3">
          <div className="mb-2 px-3 text-xs font-medium text-muted-foreground truncate">
            {tenant?.name ?? 'Organization'}
          </div>
          <div className="flex items-center gap-3 rounded-md px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
              {initials(user?.firstName, user?.lastName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="truncate text-xs text-muted-foreground capitalize">{tenant?.role}</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-card px-6">
          <div className="flex items-center gap-2">
            <UserCircle2 className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Welcome back, {user?.firstName}
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
