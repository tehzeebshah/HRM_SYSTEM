import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet, Plus, Trash2, Loader2, Lock, Play, FileText, ChevronDown, ChevronRight, Settings2 } from 'lucide-react';
import { payrollApi, type PayComponent, type StructureComponentInput, type Payslip } from '@/lib/payroll-api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/toast';
import { extractApiMessage } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const COMPONENT_TYPES: PayComponent['type'][] = ['earning', 'deduction', 'tax'];
const CALC_MODES: PayComponent['calcMode'][] = ['fixed', 'percentage', 'formula'];

function statusVariant(s: string): 'success' | 'warning' | 'secondary' | 'destructive' {
  if (s === 'completed' || s === 'locked') return 'success';
  if (s === 'processing') return 'warning';
  if (s === 'failed') return 'destructive';
  return 'secondary';
}

export function PayrollPage() {
  const { tenant } = useAuth();
  const isAdmin = tenant?.role && ['admin', 'hr'].includes(tenant.role);
  const [tab, setTab] = useState<'runs' | 'setup' | 'structures' | 'mine'>(isAdmin ? 'runs' : 'mine');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? 'Run payroll, manage salary structures and components.' : 'View your payslips.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b">
        {isAdmin && (
          <>
            <Tab active={tab === 'runs'} onClick={() => setTab('runs')}><Wallet className="h-4 w-4" /> Pay runs</Tab>
            <Tab active={tab === 'structures'} onClick={() => setTab('structures')}><Settings2 className="h-4 w-4" /> Structures</Tab>
            <Tab active={tab === 'setup'} onClick={() => setTab('setup')}><Plus className="h-4 w-4" /> Components</Tab>
          </>
        )}
        <Tab active={tab === 'mine'} onClick={() => setTab('mine')}><FileText className="h-4 w-4" /> My payslips</Tab>
      </div>

      {tab === 'runs' && isAdmin && <PayRunsTab />}
      {tab === 'structures' && isAdmin && <StructuresTab />}
      {tab === 'setup' && isAdmin && <ComponentsTab />}
      {tab === 'mine' && <MyPayslipsTab />}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        '-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors',
        active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

// ==================================================================
//  Components (catalog)
// ==================================================================

function ComponentsTab() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['pay-components'], queryFn: payrollApi.listComponents });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    code: string;
    name: string;
    type: PayComponent['type'];
    calcMode: PayComponent['calcMode'];
    value: number;
  }>({ code: '', name: '', type: 'earning', calcMode: 'fixed', value: 0 });

  const create = useMutation({
    mutationFn: () => payrollApi.createComponent(form),
    onSuccess: () => {
      toast.success('Component created.');
      setOpen(false);
      setForm({ code: '', name: '', type: 'earning', calcMode: 'fixed', value: 0 });
      queryClient.invalidateQueries({ queryKey: ['pay-components'] });
    },
    onError: (e) => toast.error(extractApiMessage(e, 'Could not create component.')),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Pay components</CardTitle>
          <CardDescription>The catalog of earnings, deductions and taxes used in structures.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : data && data.length > 0 ? (
              data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.code}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell><Badge variant={c.type === 'earning' ? 'success' : c.type === 'deduction' ? 'warning' : 'destructive'}>{c.type}</Badge></TableCell>
                  <TableCell>{c.calcMode}</TableCell>
                  <TableCell className="tabular-nums">{c.calcMode === 'percentage' ? `${c.value}%` : c.value}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No components yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onClose={() => setOpen(false)} title="Add pay component">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code *"><Input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="basic" /></Field>
            <Field label="Name *"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Basic salary" /></Field>
            <Field label="Type">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PayComponent['type'] })}>
                {COMPONENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Calc mode">
              <Select value={form.calcMode} onChange={(e) => setForm({ ...form, calcMode: e.target.value as PayComponent['calcMode'] })}>
                {CALC_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </Field>
            <Field label={form.calcMode === 'percentage' ? 'Value (%)' : 'Value'}>
              <Input type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>Create</Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

// ==================================================================
//  Structures
// ==================================================================

function StructuresTab() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: components } = useQuery({ queryKey: ['pay-components'], queryFn: payrollApi.listComponents });
  const { data, isLoading } = useQuery({ queryKey: ['pay-structures'], queryFn: payrollApi.listStructures });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [lines, setLines] = useState<StructureComponentInput[]>([{ code: '', calcMode: 'fixed', value: 0 }]);

  const create = useMutation({
    mutationFn: () => payrollApi.createStructure({ name, components: lines.filter((l) => l.code) }),
    onSuccess: () => {
      toast.success('Structure created.');
      setOpen(false);
      setName('');
      setLines([{ code: '', calcMode: 'fixed', value: 0 }]);
      queryClient.invalidateQueries({ queryKey: ['pay-structures'] });
    },
    onError: (e) => toast.error(extractApiMessage(e, 'Could not create structure.')),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Salary structures</CardTitle>
          <CardDescription>Named bundles of components that can be assigned to employees.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Components</TableHead>
              <TableHead>Employees</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : data && data.length > 0 ? (
              data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.components.length} component(s)</TableCell>
                  <TableCell>{s._count?.assignments ?? 0}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">No structures yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onClose={() => setOpen(false)} title="Create salary structure" className="max-w-2xl">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-3">
          <Field label="Structure name *"><Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Standard monthly" /></Field>
          <div className="space-y-2">
            <Label>Components</Label>
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-[1fr_120px_100px_auto] gap-2">
                <Select value={line.code} onChange={(e) => setLines(lines.map((l, j) => j === i ? { ...l, code: e.target.value } : l))}>
                  <option value="">Select…</option>
                  {components?.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                </Select>
                <Select value={line.calcMode} onChange={(e) => setLines(lines.map((l, j) => j === i ? { ...l, calcMode: e.target.value as StructureComponentInput['calcMode'] } : l))}>
                  {CALC_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </Select>
                <Input type="number" step="0.01" value={line.value} onChange={(e) => setLines(lines.map((l, j) => j === i ? { ...l, value: Number(e.target.value) } : l))} />
                <Button type="button" variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setLines([...lines, { code: '', calcMode: 'fixed', value: 0 }])}>
              <Plus className="h-4 w-4" /> Add line
            </Button>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>Create</Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

// ==================================================================
//  Pay runs
// ==================================================================

function PayRunsTab() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['pay-runs'], queryFn: payrollApi.listPayRuns });
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [expanded, setExpanded] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => payrollApi.createPayRun(month, year),
    onSuccess: () => {
      toast.success('Pay run created.');
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['pay-runs'] });
    },
    onError: (e) => toast.error(extractApiMessage(e, 'Could not create pay run.')),
  });

  const process = useMutation({
    mutationFn: (id: string) => payrollApi.processPayRun(id),
    onSuccess: () => {
      toast.success('Pay run processed.');
      queryClient.invalidateQueries({ queryKey: ['pay-runs'] });
    },
    onError: (e) => toast.error(extractApiMessage(e, 'Processing failed.')),
  });

  const lock = useMutation({
    mutationFn: (id: string) => payrollApi.lockPayRun(id),
    onSuccess: () => {
      toast.success('Pay run locked.');
      queryClient.invalidateQueries({ queryKey: ['pay-runs'] });
    },
    onError: (e) => toast.error(extractApiMessage(e, 'Could not lock.')),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Pay runs</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New run</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payslips</TableHead>
              <TableHead>Net total</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : data && data.length > 0 ? (
              data.map((run) => (
                <>
                  <TableRow key={run.id}>
                    <TableCell>
                      {run.status !== 'draft' && (
                        <button onClick={() => setExpanded(expanded === run.id ? null : run.id)} className="text-muted-foreground">
                          {expanded === run.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{MONTHS[run.month - 1]} {run.year}</TableCell>
                    <TableCell><Badge variant={statusVariant(run.status)}>{run.status}</Badge></TableCell>
                    <TableCell>{run._count?.payslips ?? run.totals?.count ?? 0}</TableCell>
                    <TableCell className="tabular-nums">{run.totals ? run.totals.net.toLocaleString() : '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(run.status === 'draft' || run.status === 'completed') && (
                          <Button size="sm" variant="outline" disabled={process.isPending} onClick={() => process.mutate(run.id)}>
                            <Play className="h-4 w-4" /> {run.status === 'draft' ? 'Process' : 'Reprocess'}
                          </Button>
                        )}
                        {run.status === 'completed' && (
                          <Button size="sm" variant="outline" disabled={lock.isPending} onClick={() => lock.mutate(run.id)}>
                            <Lock className="h-4 w-4" /> Lock
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {expanded === run.id && run.payslips && (
                    <TableRow key={`${run.id}-detail`} className="bg-muted/30">
                      <TableCell colSpan={6} className="p-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Employee</TableHead>
                              <TableHead>Gross</TableHead>
                              <TableHead>Deductions</TableHead>
                              <TableHead>Tax</TableHead>
                              <TableHead>Net</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {run.payslips.map((p: Payslip) => (
                              <TableRow key={p.id}>
                                <TableCell>{p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : '—'}</TableCell>
                                <TableCell className="tabular-nums">{p.gross.toLocaleString()}</TableCell>
                                <TableCell className="tabular-nums">{p.deductions.toLocaleString()}</TableCell>
                                <TableCell className="tabular-nums">{p.tax.toLocaleString()}</TableCell>
                                <TableCell className="tabular-nums font-medium">{p.net.toLocaleString()}</TableCell>
                              </TableRow>
                            ))}
                            {run.payslips.length === 0 && (
                              <TableRow><TableCell colSpan={5} className="py-4 text-center text-muted-foreground">No payslips.</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            ) : (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">No pay runs yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onClose={() => setOpen(false)} title="Create pay run">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Month">
              <Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </Select>
            </Field>
            <Field label="Year">
              <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">The run starts as a draft. Process it to compute payslips from each employee's current salary structure.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create draft</Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

// ==================================================================
//  My payslips (self-service)
// ==================================================================

function MyPayslipsTab() {
  const [selected, setSelected] = useState<Payslip | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['my-payslips'], queryFn: payrollApi.myPayslips });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My payslips</CardTitle>
          <CardDescription>Your recent payment history.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Tax</TableHead>
                <TableHead>Net pay</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              ) : data && data.length > 0 ? (
                data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.payRun ? `${MONTHS[p.payRun.month - 1]} ${p.payRun.year}` : '—'}
                    </TableCell>
                    <TableCell className="tabular-nums">{p.gross.toLocaleString()}</TableCell>
                    <TableCell className="tabular-nums">{p.deductions.toLocaleString()}</TableCell>
                    <TableCell className="tabular-nums">{p.tax.toLocaleString()}</TableCell>
                    <TableCell className="tabular-nums font-semibold">{p.net.toLocaleString()}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setSelected(p)}>View</Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">No payslips yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onClose={() => setSelected(null)} title="Payslip" className="max-w-md">
        {selected && <PayslipDetail payslip={selected} />}
      </Dialog>
    </>
  );
}

function PayslipDetail({ payslip }: { payslip: Payslip }) {
  const earnings = payslip.components.filter((c) => c.type === 'earning');
  const deductions = payslip.components.filter((c) => c.type === 'deduction');
  const taxes = payslip.components.filter((c) => c.type === 'tax');
  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-md border bg-muted/30 p-3">
        <div className="text-xs text-muted-foreground">Net pay</div>
        <div className="text-2xl font-semibold tabular-nums">{payslip.net.toLocaleString()}</div>
      </div>
      <ComponentBlock title="Earnings" items={earnings} />
      <ComponentBlock title="Deductions" items={deductions} />
      <ComponentBlock title="Tax" items={taxes} />
      <div className="grid grid-cols-2 gap-2 border-t pt-3 text-xs text-muted-foreground">
        <span>Gross: <strong className="text-foreground">{payslip.gross.toLocaleString()}</strong></span>
        <span>Deductions: <strong className="text-foreground">{payslip.deductions.toLocaleString()}</strong></span>
        <span>Tax: <strong className="text-foreground">{payslip.tax.toLocaleString()}</strong></span>
        <span>Net: <strong className="text-foreground">{payslip.net.toLocaleString()}</strong></span>
      </div>
    </div>
  );
}

function ComponentBlock({ title, items }: { title: string; items: Payslip['components'] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="divide-y rounded-md border">
        {items.map((c) => (
          <div key={c.code} className="flex justify-between py-1.5 px-2">
            <span>{c.name}</span>
            <span className="tabular-nums">{c.amount.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
