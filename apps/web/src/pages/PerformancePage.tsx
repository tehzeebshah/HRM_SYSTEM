import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Target, Plus, Trash2, Loader2, TrendingUp, ClipboardList, CheckCircle2, Play } from 'lucide-react';
import { performanceApi, type Goal } from '@/lib/performance-api';
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
import { cn } from '@/lib/utils';

export function PerformancePage() {
  const { tenant } = useAuth();
  const isAdmin = tenant?.role && ['admin', 'hr'].includes(tenant.role);
  const [tab, setTab] = useState<'goals' | 'reviews' | 'admin'>(isAdmin ? 'goals' : 'goals');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Performance</h1>
        <p className="text-sm text-muted-foreground">Goals, reviews and feedback.</p>
      </div>

      <div className="flex flex-wrap gap-1 border-b">
        <Tab active={tab === 'goals'} onClick={() => setTab('goals')}><Target className="h-4 w-4" /> My goals</Tab>
        <Tab active={tab === 'reviews'} onClick={() => setTab('reviews')}><ClipboardList className="h-4 w-4" /> My reviews</Tab>
        {isAdmin && (
          <Tab active={tab === 'admin'} onClick={() => setTab('admin')}><TrendingUp className="h-4 w-4" /> Cycles & reviews</Tab>
        )}
      </div>

      {tab === 'goals' && <MyGoals />}
      {tab === 'reviews' && <MyReviews />}
      {tab === 'admin' && isAdmin && <AdminTab />}
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
//  My goals
// ==================================================================

function MyGoals() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['perf', 'my-goals'], queryFn: performanceApi.myGoals });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [weight, setWeight] = useState('1');

  const create = useMutation({
    mutationFn: () =>
      performanceApi.createGoal({ title, description: description || undefined, weight: Number(weight) }),
    onSuccess: () => {
      toast.success('Goal created.');
      setOpen(false);
      setTitle('');
      setDescription('');
      setWeight('1');
      queryClient.invalidateQueries({ queryKey: ['perf', 'my-goals'] });
    },
    onError: (e) => toast.error(extractApiMessage(e, 'Could not create goal.')),
  });

  const updateProgress = useMutation({
    mutationFn: ({ id, progress }: { id: string; progress: number }) =>
      performanceApi.updateGoal(id, { progress, status: progress >= 100 ? 'completed' : 'active' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['perf', 'my-goals'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => performanceApi.deleteGoal(id),
    onSuccess: () => {
      toast.success('Goal removed.');
      queryClient.invalidateQueries({ queryKey: ['perf', 'my-goals'] });
    },
  });

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="text-sm text-muted-foreground">Active goals</div>
                <div className="text-2xl font-semibold">{summary.totalGoals}</div>
              </div>
              <Target className="h-8 w-8 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="text-sm text-muted-foreground">Weighted progress</div>
                <div className="text-2xl font-semibold">{summary.overallProgress}%</div>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-500" />
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">My goals</CardTitle>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New goal</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : data && data.goals.length > 0 ? (
            data.goals.map((goal) => <GoalRow key={goal.id} goal={goal} onProgress={(p) => updateProgress.mutate({ id: goal.id, progress: p })} onDelete={() => remove.mutate(goal.id)} />)
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No goals yet. Set your first objective.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} title="New goal">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Ship the Q3 roadmap" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Weight</Label>
            <Input type="number" step="0.1" min="0" max="10" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>Create</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function GoalRow({ goal, onProgress, onDelete }: { goal: Goal; onProgress: (p: number) => void; onDelete: () => void }) {
  return (
    <div className="rounded-md border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{goal.title}</span>
            {goal.status === 'completed' && <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" /> done</Badge>}
          </div>
          {goal.description && <p className="mt-1 text-sm text-muted-foreground">{goal.description}</p>}
        </div>
        <Button variant="ghost" size="icon" aria-label="Delete" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          value={goal.progress}
          onChange={(e) => onProgress(Number(e.target.value))}
          className="flex-1"
        />
        <span className="w-12 text-right text-sm tabular-nums text-muted-foreground">{goal.progress}%</span>
        <span className="text-xs text-muted-foreground">weight {goal.weight}</span>
      </div>
    </div>
  );
}

// ==================================================================
//  My reviews (reviews where I'm the reviewer + reviews about me)
// ==================================================================

function MyReviews() {
  const { data, isLoading } = useQuery({
    queryKey: ['perf', 'my-reviews'],
    queryFn: () => performanceApi.listReviews({ status: 'pending' }),
    // Note: this returns all pending; a reviewer-scoped filter is applied server-side
    // via the submit guard. A future refinement adds ?reviewerId=me.
  });
  const [submitFor, setSubmitFor] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reviews awaiting my input</CardTitle>
        <CardDescription>Submit your assessment for assigned reviews.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cycle</TableHead>
              <TableHead>Reviewee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : data && data.length > 0 ? (
              data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.cycle.name}</TableCell>
                  <TableCell>{r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—'}</TableCell>
                  <TableCell><Badge variant={r.status === 'submitted' ? 'success' : 'warning'}>{r.status}</Badge></TableCell>
                  <TableCell>
                    {r.status === 'pending' && (
                      <Button size="sm" variant="outline" onClick={() => setSubmitFor(r.id)}>Submit</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">No pending reviews.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      {submitFor && <SubmitReviewDialog reviewId={submitFor} onClose={() => setSubmitFor(null)} />}
    </Card>
  );
}

function SubmitReviewDialog({ reviewId, onClose }: { reviewId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [rating, setRating] = useState('3');
  const [comments, setComments] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await performanceApi.submitReview(reviewId, {
        ratings: { overall: Number(rating) },
        comments: comments || undefined,
        overallRating: Number(rating),
      });
      toast.success('Review submitted.');
      queryClient.invalidateQueries({ queryKey: ['perf'] });
      onClose();
    } catch (err) {
      toast.error(extractApiMessage(err, 'Could not submit review.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title="Submit review">
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <Label>Overall rating</Label>
          <Select value={rating} onChange={(e) => setRating(e.target.value)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n} — {['Poor', 'Below', 'Meets', 'Exceeds', 'Outstanding'][n - 1]}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Comments</Label>
          <Textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={4} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Submit</Button>
        </div>
      </form>
    </Dialog>
  );
}

// ==================================================================
//  Admin: cycles + reviews
// ==================================================================

function AdminTab() {
  return (
    <div className="space-y-6">
      <CyclesCard />
      <ReviewsCard />
    </div>
  );
}

function CyclesCard() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['perf', 'cycles'], queryFn: performanceApi.listCycles });
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [form, setForm] = useState({
    name: '',
    period: `${now.getFullYear()}-H1`,
    type: 'annual',
    startDate: '',
    endDate: '',
  });

  const create = useMutation({
    mutationFn: () =>
      performanceApi.createCycle({
        ...form,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
      }),
    onSuccess: () => {
      toast.success('Cycle created.');
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['perf', 'cycles'] });
    },
    onError: (e) => toast.error(extractApiMessage(e, 'Could not create cycle.')),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Review cycles</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New cycle</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reviews</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : data && data.length > 0 ? (
              data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.period}</TableCell>
                  <TableCell>{c.type}</TableCell>
                  <TableCell><Badge variant={c.status === 'open' ? 'success' : 'secondary'}>{c.status}</Badge></TableCell>
                  <TableCell>{c._count?.reviews ?? 0}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No cycles yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onClose={() => setOpen(false)} title="Create review cycle">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Period</Label>
              <Input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="2026-H1" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {['annual', 'quarterly', 'probation', 'project'].map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Start</Label>
              <Input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>End</Label>
              <Input type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
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

function ReviewsCard() {
  const { data, isLoading } = useQuery({ queryKey: ['perf', 'reviews'], queryFn: () => performanceApi.listReviews({}) });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">All reviews</CardTitle>
        <CardDescription>Assign reviews and track completion across the organization.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cycle</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Reviewer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rating</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : data && data.length > 0 ? (
              data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.cycle.name}</TableCell>
                  <TableCell>{r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—'}</TableCell>
                  <TableCell>{r.reviewer ? `${r.reviewer.firstName} ${r.reviewer.lastName}` : '—'}</TableCell>
                  <TableCell><Badge variant={r.status === 'submitted' ? 'success' : 'warning'}>{r.status}</Badge></TableCell>
                  <TableCell className="tabular-nums">{r.overallRating ?? '—'}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No reviews yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
