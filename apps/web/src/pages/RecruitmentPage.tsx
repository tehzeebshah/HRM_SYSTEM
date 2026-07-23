import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Plus, Trash2, ChevronRight, Loader2 } from 'lucide-react';
import { recruitmentApi, STAGES, type Application } from '@/lib/recruitment-api';
import { useToast } from '@/components/ui/toast';
import { extractApiMessage } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn, initials } from '@/lib/utils';

const STAGE_LABELS: Record<string, string> = {
  applied: 'Applied', screening: 'Screening', interview: 'Interview', offer: 'Offer', hired: 'Hired', rejected: 'Rejected',
};

export function RecruitmentPage() {
  const [tab, setTab] = useState<'pipeline' | 'openings' | 'candidates'>('pipeline');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Recruitment</h1>
        <p className="text-sm text-muted-foreground">Job openings, candidates and the hiring pipeline.</p>
      </div>
      <div className="flex gap-1 border-b">
        <Tab active={tab === 'pipeline'} onClick={() => setTab('pipeline')}>Pipeline</Tab>
        <Tab active={tab === 'openings'} onClick={() => setTab('openings')}>Openings</Tab>
        <Tab active={tab === 'candidates'} onClick={() => setTab('candidates')}>Candidates</Tab>
      </div>
      {tab === 'pipeline' && <Pipeline />}
      {tab === 'openings' && <Openings />}
      {tab === 'candidates' && <Candidates />}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn('-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors', active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>{children}</button>
  );
}

function Pipeline() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['applications'], queryFn: () => recruitmentApi.listApplications() });

  const move = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => recruitmentApi.moveApplication(id, stage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast.success('Application moved.');
    },
    onError: (e) => toast.error(extractApiMessage(e, 'Could not move.')),
  });

  const grouped: Record<string, Application[]> = {};
  for (const s of STAGES) grouped[s] = [];
  (data ?? []).forEach((a) => { (grouped[a.stage] ??= []).push(a); });

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STAGES.map((stage) => (
        <div key={stage} className="w-72 shrink-0">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-sm font-medium">{STAGE_LABELS[stage]}</span>
            <Badge variant="secondary">{grouped[stage]?.length ?? 0}</Badge>
          </div>
          <div className="space-y-2 rounded-md bg-muted/40 p-2">
            {isLoading ? (
              <div className="py-4 text-center text-xs text-muted-foreground">Loading…</div>
            ) : (grouped[stage]?.length ?? 0) === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">Empty</div>
            ) : (
              (grouped[stage] ?? []).map((app) => (
                <div key={app.id} className="rounded-md border bg-card p-3 text-sm shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">
                      {initials(app.candidate.name.split(' ')[0], app.candidate.name.split(' ')[1])}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{app.candidate.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{app.jobOpening.title}</div>
                    </div>
                  </div>
                  {stage !== 'hired' && stage !== 'rejected' && (() => {
                    const next = STAGES[STAGES.indexOf(stage) + 1];
                    if (!next) return null;
                    return (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2 h-7 w-full justify-between px-2 text-xs"
                        disabled={move.isPending}
                        onClick={() => move.mutate({ id: app.id, stage: next })}
                      >
                        Advance to {STAGE_LABELS[next]}
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    );
                  })()}
                  {stage === 'rejected' && app.rejectedReason && (
                    <p className="mt-1 text-xs text-destructive">{app.rejectedReason}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Openings() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['openings'], queryFn: recruitmentApi.listOpenings });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [headcount, setHeadcount] = useState('1');
  const [type, setType] = useState('full_time');
  const [description, setDescription] = useState('');

  const create = useMutation({
    mutationFn: () => recruitmentApi.createOpening({ title, headcount: Number(headcount), type, description }),
    onSuccess: () => {
      toast.success('Opening created.');
      setOpen(false);
      setTitle(''); setDescription(''); setHeadcount('1');
      queryClient.invalidateQueries({ queryKey: ['openings'] });
    },
    onError: (e) => toast.error(extractApiMessage(e, 'Could not create opening.')),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Job openings</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Headcount</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Applicants</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : data && data.length > 0 ? (
              data.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.title}</TableCell>
                  <TableCell>{o.department?.name ?? '—'}</TableCell>
                  <TableCell>{o.headcount}</TableCell>
                  <TableCell>{o.type}</TableCell>
                  <TableCell><Badge variant={o.status === 'open' ? 'success' : 'secondary'}>{o.status}</Badge></TableCell>
                  <TableCell>{o._count?.applications ?? 0}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">No openings yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onClose={() => setOpen(false)} title="Create job opening">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-3">
          <div className="space-y-1.5"><Label>Title *</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Headcount</Label><Input type="number" min="1" value={headcount} onChange={(e) => setHeadcount(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Type</Label>
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                {['full_time', 'part_time', 'contract', 'intern'].map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create</Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

function Candidates() {
  const { data, isLoading } = useQuery({ queryKey: ['candidates'], queryFn: () => recruitmentApi.listCandidates() });
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Candidates</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Source</TableHead><TableHead>Applications</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : data && data.length > 0 ? (
              data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell>{c.phone ?? '—'}</TableCell>
                  <TableCell>{c.source ?? '—'}</TableCell>
                  <TableCell>{c._count?.applications ?? 0}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No candidates yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
