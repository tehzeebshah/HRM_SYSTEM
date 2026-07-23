import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Plus, Check, X, Loader2, Wallet } from 'lucide-react';
import { leaveApi, type LeaveRequest } from '@/lib/leave-api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/toast';
import { extractApiMessage } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatLabel } from '@/lib/format';

export function LeavePage() {
  const { tenant } = useAuth();
  const isApprover = tenant?.role && ['admin', 'hr', 'manager'].includes(tenant.role);
  const [tab, setTab] = useState<'me' | 'approvals'>('me');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leave</h1>
        <p className="text-sm text-muted-foreground">Request time off and track your balances.</p>
      </div>

      {isApprover && (
        <div className="flex gap-1 border-b">
          <Tab active={tab === 'me'} onClick={() => setTab('me')}>My leave</Tab>
          <Tab active={tab === 'approvals'} onClick={() => setTab('approvals')}>Approvals</Tab>
        </div>
      )}

      {tab === 'me' ? <MyLeave /> : <Approvals />}
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
  if (s === 'approved') return 'success';
  if (s === 'pending') return 'warning';
  if (s === 'rejected') return 'destructive';
  return 'secondary';
}

function MyLeave() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const balances = useQuery({ queryKey: ['leave', 'balances'], queryFn: () => leaveApi.myBalances() });
  const requests = useQuery({ queryKey: ['leave', 'my-requests'], queryFn: leaveApi.myRequests });

  const toast = useToast();

  const cancel = useMutation({
    mutationFn: (id: string) => leaveApi.cancelRequest(id),
    onSuccess: () => {
      toast.success('Request cancelled.');
      queryClient.invalidateQueries({ queryKey: ['leave'] });
    },
    onError: (e) => toast.error(extractApiMessage(e, 'Could not cancel.')),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" /> Balances · {balances.data?.year ?? new Date().getFullYear()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {balances.isLoading ? (
              <div className="col-span-full py-6 text-center text-sm text-muted-foreground">Loading…</div>
            ) : balances.data && balances.data.balances.length > 0 ? (
              balances.data.balances.map((b) => (
                <div key={b.id} className="rounded-md border p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{b.name}</span>
                    {!b.paid && <Badge variant="secondary">unpaid</Badge>}
                  </div>
                  <div className="mt-2 text-2xl font-semibold tabular-nums">{b.remaining}</div>
                  <div className="text-xs text-muted-foreground">
                    {b.allocated + b.carried} allocated · {b.used} used
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-6 text-center text-sm text-muted-foreground">
                No leave balances configured. Ask HR to allocate your leave.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4" /> My requests
          </CardTitle>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Request leave
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.isLoading ? (
                <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              ) : requests.data && requests.data.data.length > 0 ? (
                requests.data.data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.leaveType.name}</TableCell>
                    <TableCell>{new Date(r.fromDate).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(r.toDate).toLocaleDateString()}</TableCell>
                    <TableCell>{r.days}</TableCell>
                    <TableCell><Badge variant={statusVariant(r.status)}>{formatLabel(r.status)}</Badge></TableCell>
                    <TableCell>
                      {r.status === 'pending' && (
                        <Button variant="ghost" size="sm" onClick={() => cancel.mutate(r.id)}>
                          Cancel
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">No leave requests yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RequestLeaveDialog
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['leave'] });
        }}
        onError={(m) => toast.error(m)}
      />
    </div>
  );
}

function RequestLeaveDialog({
  open,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const types = useQuery({ queryKey: ['leave', 'types'], queryFn: leaveApi.listTypes });
  const toast = useToast();
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveTypeId || !fromDate || !toDate) return;
    setBusy(true);
    try {
      await leaveApi.createRequest({
        leaveTypeId,
        fromDate: new Date(fromDate).toISOString(),
        toDate: new Date(toDate).toISOString(),
        reason: reason || undefined,
      });
      toast.success('Leave request submitted.');
      setReason('');
      setLeaveTypeId('');
      setFromDate('');
      setToDate('');
      onSaved();
      onClose();
    } catch (err) {
      onError(extractApiMessage(err, 'Unable to submit request.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Request leave" description="Submit a new leave request for approval.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Leave type *</Label>
          <Select value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)} required>
            <option value="">Select…</option>
            {types.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>From *</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>To *</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} required />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Reason</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit request
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function Approvals() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ['leave', 'approvals'],
    queryFn: () => leaveApi.listRequests({ status: 'pending', pageSize: 50 }),
  });

  const decide = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => leaveApi.decide(id, { status }),
    onSuccess: (_d, vars) => {
      toast.success(vars.status === 'approved' ? 'Leave approved.' : 'Leave rejected.');
      queryClient.invalidateQueries({ queryKey: ['leave'] });
    },
    onError: (e) => toast.error(extractApiMessage(e, 'Action failed.')),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pending approvals</CardTitle>
        <CardDescription>Leave requests awaiting your decision.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : data && data.data.length > 0 ? (
              data.data.map((r: LeaveRequest) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—'}
                    {r.employee?.department && (
                      <span className="ml-2 text-xs text-muted-foreground">{r.employee.department.name}</span>
                    )}
                  </TableCell>
                  <TableCell>{r.leaveType.name}</TableCell>
                  <TableCell>
                    {new Date(r.fromDate).toLocaleDateString()} → {new Date(r.toDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{r.days}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">{r.reason || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ id: r.id, status: 'approved' })}
                      >
                        <Check className="h-4 w-4 text-emerald-500" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ id: r.id, status: 'rejected' })}
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">No pending requests.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
