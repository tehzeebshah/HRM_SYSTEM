import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from 'recharts';
import { Users, CalendarDays, Clock, Wallet, TrendingUp, Download } from 'lucide-react';
import { reportsApi, type OrgDashboard, type TeamDashboard, type PersonalDashboard } from '@/lib/reports-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { http } from '@/lib/api';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PIE_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

export function DashboardPage() {
  const { user, tenant } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: reportsApi.dashboard });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back, {user?.firstName}. {tenant?.name} · <span className="capitalize">{tenant?.role}</span>
        </p>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-muted-foreground">Loading your dashboard…</div>
      ) : data ? (
        <>
          {data.scope === 'org' && <OrgView data={data} />}
          {data.scope === 'team' && <TeamView data={data} />}
          {data.scope === 'personal' && <PersonalView data={data} />}
          {data.scope === 'none' && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Your account isn't linked to an employee record. Contact HR if you need access.
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function OrgView({ data }: { data: OrgDashboard }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile icon={Users} label="Active employees" value={data.headcount} />
        <KpiTile icon={CalendarDays} label="On leave today" value={data.onLeaveToday} />
        <KpiTile icon={Clock} label="Pending approvals" value={data.pendingApprovals} />
        <KpiTile
          icon={Wallet}
          label="Last pay run"
          value={data.lastPayRun ? `${MONTHS[data.lastPayRun.month - 1] ?? ''} ${data.lastPayRun.year}` : '—'}
          hint={data.lastPayRun?.totals?.net ? `Net ${(data.lastPayRun.totals.net as number).toLocaleString()}` : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" /> Headcount by department</CardTitle>
          </CardHeader>
          <CardContent>
            {data.departments.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.departments} margin={{ left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={60} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip />
                  <Bar dataKey="count" name="Employees" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workforce diversity</CardTitle>
            <CardDescription>Gender distribution across active employees.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.gender.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={data.gender} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={90} label>
                    {data.gender.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Exports</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <ExportButton report="employees" label="Employees CSV" />
          <ExportButton report="headcount" label="Headcount CSV" />
          <ExportButton report="payroll" label="Payroll CSV" />
        </CardContent>
      </Card>
    </div>
  );
}

function TeamView({ data }: { data: TeamDashboard }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <KpiTile icon={Users} label="Team size" value={data.teamSize} />
      <KpiTile icon={CalendarDays} label="On leave today" value={data.onLeaveToday} />
      <KpiTile icon={Clock} label="Pending approvals" value={data.pendingApprovals} />
    </div>
  );
}

function PersonalView({ data }: { data: PersonalDashboard }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiTile icon={CalendarDays} label="Leave remaining" value={data.leaveRemaining} hint="days" />
        <KpiTile icon={Wallet} label="Last net pay" value={data.lastPayslip ? data.lastPayslip.net.toLocaleString() : '—'} hint={data.lastPayslip ? `${MONTHS[data.lastPayslip.month - 1] ?? ''} ${data.lastPayslip.year}` : undefined} />
        <KpiTile icon={Clock} label="Pending requests" value={data.pendingLeave} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your leave balances</CardTitle>
        </CardHeader>
        <CardContent>
          {data.leaveBreakdown.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No leave balances allocated yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.leaveBreakdown} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={90} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Bar dataKey="remaining" name="Days left" fill="#16a34a" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ExportButton({ report, label }: { report: 'employees' | 'headcount' | 'payroll'; label: string }) {
  return (
    <button
      onClick={async () => {
        const res = await http.get(`/reports/${report}.csv`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${report}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }}
      className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent"
    >
      <Download className="h-4 w-4" /> {label}
    </button>
  );
}

function EmptyChart() {
  return <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No data yet.</div>;
}
