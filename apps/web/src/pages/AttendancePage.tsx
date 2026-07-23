import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, LogIn, LogOut, CalendarClock, AlertCircle, Loader2 } from 'lucide-react';
import { attendanceApi } from '@/lib/attendance-api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/toast';
import { extractApiMessage } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatLabel } from '@/lib/format';

export function AttendancePage() {
  const { tenant } = useAuth();
  const isManager = tenant?.role && ['admin', 'hr', 'manager'].includes(tenant.role);
  const [tab, setTab] = useState<'me' | 'team'>(isManager ? 'me' : 'me');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
        <p className="text-sm text-muted-foreground">Clock in/out and track time.</p>
      </div>

      {isManager && (
        <div className="flex gap-1 border-b">
          <Tab active={tab === 'me'} onClick={() => setTab('me')}>My attendance</Tab>
          <Tab active={tab === 'team'} onClick={() => setTab('team')}>Team timesheet</Tab>
        </div>
      )}

      {tab === 'me' ? <MyAttendance /> : <TeamTimesheet />}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ' +
        (active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')
      }
    >
      {children}
    </button>
  );
}

function statusVariant(s: string): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (s === 'present') return 'success';
  if (s === 'late' || s === 'half_day' || s === 'on_leave') return 'warning';
  if (s === 'absent') return 'destructive';
  return 'secondary';
}

function fmtTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function MyAttendance() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: today } = useQuery({ queryKey: ['attendance', 'today'], queryFn: attendanceApi.myToday });

  const clockIn = useMutation({
    mutationFn: () => attendanceApi.clockIn(),
    onSuccess: () => {
      toast.success('Clocked in. Have a great day!');
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (e) => toast.error(extractApiMessage(e, 'Could not clock in.')),
  });
  const clockOut = useMutation({
    mutationFn: () => attendanceApi.clockOut(),
    onSuccess: () => {
      toast.success('Clocked out.');
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (e) => toast.error(extractApiMessage(e, 'Could not clock out.')),
  });

  const hasClockedIn = !!today?.clockIn;
  const hasClockedOut = !!today?.clockOut;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Clock className="h-10 w-10" />
          </div>
          <div className="text-center">
            <div className="text-3xl font-semibold tabular-nums">
              {new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!hasClockedIn && (
              <Button size="lg" disabled={clockIn.isPending} onClick={() => clockIn.mutate()}>
                {clockIn.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                Clock in
              </Button>
            )}
            {hasClockedIn && !hasClockedOut && (
              <Button size="lg" variant="secondary" disabled={clockOut.isPending} onClick={() => clockOut.mutate()}>
                {clockOut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                Clock out
              </Button>
            )}
            {hasClockedIn && hasClockedOut && (
              <Badge variant="success" className="px-4 py-2 text-sm">Done for today</Badge>
            )}
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <span>Started: <strong className="text-foreground">{fmtTime(today?.clockIn ?? null)}</strong></span>
            <span>Ended: <strong className="text-foreground">{fmtTime(today?.clockOut ?? null)}</strong></span>
            {today?.overtimeMins ? <span>Overtime: <strong className="text-foreground">{today.overtimeMins}m</strong></span> : null}
          </div>
        </CardContent>
      </Card>

      <MyRecentAttendance />
    </div>
  );
}

function MyRecentAttendance() {
  const { data, isLoading } = useQuery({
    queryKey: ['attendance', 'my-recent'],
    queryFn: () => attendanceApi.list({ employeeId: undefined, pageSize: 10 }),
  });
  // Note: this lists all attendance; a self-scoped endpoint is a future refinement.
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4" /> Recent attendance
        </CardTitle>
        <CardDescription>Your latest clock records.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Clock in</TableHead>
              <TableHead>Clock out</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : data && data.data.length > 0 ? (
              data.data.slice(0, 8).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.date).toLocaleDateString()}</TableCell>
                  <TableCell className="tabular-nums">{fmtTime(r.clockIn)}</TableCell>
                  <TableCell className="tabular-nums">{fmtTime(r.clockOut)}</TableCell>
                  <TableCell><Badge variant={statusVariant(r.status)}>{formatLabel(r.status)}</Badge></TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">No records yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function TeamTimesheet() {
  const [days, setDays] = useState('30');
  const from = new Date(Date.now() - Number(days) * 86400_000).toISOString();
  const { data, isLoading } = useQuery({
    queryKey: ['attendance', 'team', days],
    queryFn: () => attendanceApi.list({ from, pageSize: 100 }),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Team timesheet</CardTitle>
        <Select value={days} onChange={(e) => setDays(e.target.value)} className="w-32">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </Select>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>In</TableHead>
              <TableHead>Out</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>OT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : data && data.data.length > 0 ? (
              data.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—'}
                    {r.employee?.department && (
                      <span className="ml-2 text-xs text-muted-foreground">{r.employee.department.name}</span>
                    )}
                  </TableCell>
                  <TableCell>{new Date(r.date).toLocaleDateString()}</TableCell>
                  <TableCell className="tabular-nums">{fmtTime(r.clockIn)}</TableCell>
                  <TableCell className="tabular-nums">{fmtTime(r.clockOut)}</TableCell>
                  <TableCell><Badge variant={statusVariant(r.status)}>{formatLabel(r.status)}</Badge></TableCell>
                  <TableCell>{r.overtimeMins ? `${r.overtimeMins}m` : '—'}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  <AlertCircle className="mx-auto mb-2 h-6 w-6 opacity-40" />
                  No attendance records in this period.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
