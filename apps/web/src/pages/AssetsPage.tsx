import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, ArrowUpRight, ArrowDownLeft, Loader2 } from 'lucide-react';
import { assetApi } from '@/lib/assets-api';
import { employeesApi } from '@/lib/employees-api';
import { useToast } from '@/components/ui/toast';
import { extractApiMessage } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function statusVariant(s: string): 'success' | 'warning' | 'secondary' | 'destructive' {
  if (s === 'available') return 'success';
  if (s === 'assigned') return 'warning';
  if (s === 'in_repair') return 'destructive';
  return 'secondary';
}

export function AssetsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['assets'], queryFn: () => assetApi.list() });
  const employees = useQuery({ queryKey: ['employees', 'all'], queryFn: () => employeesApi.list({ pageSize: 200 }) });

  // create form
  const [form, setForm] = useState({ code: '', name: '', category: '', serial: '', value: '' });
  const create = useMutation({
    mutationFn: () =>
      assetApi.create({
        code: form.code,
        name: form.name,
        category: form.category || undefined,
        serial: form.serial || undefined,
        value: form.value ? Number(form.value) : undefined,
      }),
    onSuccess: () => {
      toast.success('Asset registered.');
      setCreateOpen(false);
      setForm({ code: '', name: '', category: '', serial: '', value: '' });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (e) => toast.error(extractApiMessage(e, 'Could not create asset.')),
  });

  // assign form
  const [employeeId, setEmployeeId] = useState('');
  const assign = useMutation({
    mutationFn: () => assetApi.assign(assignFor!, employeeId),
    onSuccess: () => {
      toast.success('Asset issued.');
      setAssignFor(null);
      setEmployeeId('');
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (e) => toast.error(extractApiMessage(e, 'Could not assign.')),
  });

  const returnIt = useMutation({
    mutationFn: (id: string) => assetApi.return(id),
    onSuccess: () => {
      toast.success('Asset returned.');
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (e) => toast.error(extractApiMessage(e, 'Could not return.')),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assets</h1>
          <p className="text-sm text-muted-foreground">Track equipment issued to employees.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Register asset</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Asset registry</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Held by</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              ) : data && data.length > 0 ? (
                data.map((a) => {
                  const holder = a.assignments[0]?.employee;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs">{a.code}</TableCell>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-muted-foreground">{a.category ?? '—'}</TableCell>
                      <TableCell><Badge variant={statusVariant(a.status)}>{a.status}</Badge></TableCell>
                      <TableCell>{holder ? `${holder.firstName} ${holder.lastName}` : '—'}</TableCell>
                      <TableCell>
                        {a.status === 'assigned' ? (
                          <Button size="sm" variant="outline" onClick={() => returnIt.mutate(a.id)}>
                            <ArrowDownLeft className="h-4 w-4" /> Return
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setAssignFor(a.id)}>
                            <ArrowUpRight className="h-4 w-4" /> Issue
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    <Package className="mx-auto mb-2 h-8 w-8 opacity-40" /> No assets registered.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Register asset">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Code *</Label><Input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="LAP-001" /></div>
            <div className="space-y-1.5"><Label>Name *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="MacBook Pro 14&quot;" /></div>
            <div className="space-y-1.5"><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Laptop" /></div>
            <div className="space-y-1.5"><Label>Serial</Label><Input value={form.serial} onChange={(e) => setForm({ ...form, serial: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Value</Label><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Register</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={!!assignFor} onClose={() => setAssignFor(null)} title="Issue asset">
        <form onSubmit={(e) => { e.preventDefault(); if (employeeId) assign.mutate(); }} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Issue to *</Label>
            <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
              <option value="">Select employee…</option>
              {employees.data?.data.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setAssignFor(null)}>Cancel</Button>
            <Button type="submit" disabled={assign.isPending || !employeeId}>Issue</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
