import { useQuery } from '@tanstack/react-query';
import { FileBarChart, Download } from 'lucide-react';
import { reportsApi } from '@/lib/reports-api';
import { http } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">Workforce analytics and exports.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <HeadcountReport />
        <PayrollReport />
        <LeaveReport />
        <AssetReport />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><FileBarChart className="h-4 w-4" /> Raw data exports</CardTitle>
          <CardDescription>Download CSV files for offline processing or accounting import.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Export report="employees" label="All employees" />
          <Export report="headcount" label="Headcount by department" />
          <Export report="payroll" label="Payroll history" />
        </CardContent>
      </Card>
    </div>
  );
}

function Export({ report, label }: { report: 'employees' | 'headcount' | 'payroll'; label: string }) {
  return (
    <Button
      variant="outline"
      onClick={async () => {
        const res = await http.get(`/reports/${report}.csv`, { responseType: 'blob' });
        const url = URL.createObjectURL(res.data as Blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${report}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }}
    >
      <Download className="h-4 w-4" /> {label}
    </Button>
  );
}

function HeadcountReport() {
  const { data, isLoading } = useQuery({ queryKey: ['report', 'headcount'], queryFn: reportsApi.headcount });
  const report = data as { total?: number; byDepartment?: { name: string; count: number }[]; byStatus?: { label: string; count: number }[] } | undefined;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Headcount</CardTitle>
        <CardDescription>{report?.total ?? '—'} active employees in total.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Department</TableHead><TableHead className="text-right">People</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={2} className="py-4 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : report?.byDepartment && report.byDepartment.length > 0 ? (
              report.byDepartment.map((d) => (
                <TableRow key={d.name}><TableCell>{d.name}</TableCell><TableCell className="text-right tabular-nums">{d.count}</TableCell></TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={2} className="py-4 text-center text-muted-foreground">No data.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PayrollReport() {
  const { data, isLoading } = useQuery({ queryKey: ['report', 'payroll'], queryFn: reportsApi.payroll });
  const report = data as { runs?: { period: string; status: string; payslips: number; net?: number; gross?: number }[] } | undefined;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payroll history</CardTitle>
        <CardDescription>Recent completed pay runs.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Payslips</TableHead><TableHead>Net</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="py-4 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : report?.runs && report.runs.length > 0 ? (
              report.runs.map((r) => {
                const [y, m] = r.period.split('-');
                return (
                  <TableRow key={r.period}>
                    <TableCell>{MONTHS[Number(m) - 1] ?? ''} {y}</TableCell>
                    <TableCell>{r.payslips}</TableCell>
                    <TableCell className="tabular-nums">{r.net ? r.net.toLocaleString() : '—'}</TableCell>
                    <TableCell><Badge variant={r.status === 'locked' ? 'success' : 'secondary'}>{r.status}</Badge></TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow><TableCell colSpan={4} className="py-4 text-center text-muted-foreground">No pay runs yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function LeaveReport() {
  const { data, isLoading } = useQuery({ queryKey: ['report', 'leave'], queryFn: () => reportsApi.leave() });
  const report = data as { year?: number; byType?: { name: string; days: number; count: number }[]; totalDays?: number } | undefined;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Leave utilization · {report?.year ?? new Date().getFullYear()}</CardTitle>
        <CardDescription>{report?.totalDays ?? 0} approved days total.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Leave type</TableHead><TableHead>Requests</TableHead><TableHead className="text-right">Days</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={3} className="py-4 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : report?.byType && report.byType.length > 0 ? (
              report.byType.map((t) => (
                <TableRow key={t.name}><TableCell>{t.name}</TableCell><TableCell>{t.count}</TableCell><TableCell className="text-right tabular-nums">{t.days}</TableCell></TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={3} className="py-4 text-center text-muted-foreground">No approved leave yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AssetReport() {
  const { data, isLoading } = useQuery({ queryKey: ['report', 'assets'], queryFn: reportsApi.assets });
  const report = data as { byStatus?: { status: string; count: number }[]; totalValue?: number } | undefined;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Asset utilization</CardTitle>
        <CardDescription>Total value: {(report?.totalValue ?? 0).toLocaleString()}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Status</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={2} className="py-4 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : report?.byStatus && report.byStatus.length > 0 ? (
              report.byStatus.map((s) => (
                <TableRow key={s.status}><TableCell className="capitalize">{s.status.replace('_', ' ')}</TableCell><TableCell className="text-right tabular-nums">{s.count}</TableCell></TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={2} className="py-4 text-center text-muted-foreground">No assets yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
