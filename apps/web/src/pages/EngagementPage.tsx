import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Plus, FileText, Trash2, Download, Loader2 } from 'lucide-react';
import { engagementApi } from '@/lib/engagement-api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/toast';
import { extractApiMessage } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/lib/utils';

export function EngagementPage() {
  const { tenant } = useAuth();
  const isAdmin = tenant?.role && ['admin', 'hr'].includes(tenant.role);
  const [tab, setTab] = useState<'news' | 'docs'>('news');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Engagement</h1>
        <p className="text-sm text-muted-foreground">Company announcements and documents.</p>
      </div>
      <div className="flex gap-1 border-b">
        <Tab active={tab === 'news'} onClick={() => setTab('news')}><Megaphone className="h-4 w-4" /> Announcements</Tab>
        <Tab active={tab === 'docs'} onClick={() => setTab('docs')}><FileText className="h-4 w-4" /> Documents</Tab>
      </div>
      {tab === 'news' && <Announcements isAdmin={!!isAdmin} />}
      {tab === 'docs' && <Documents isAdmin={!!isAdmin} />}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{children}</button>
  );
}

function Announcements({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['announcements'], queryFn: engagementApi.listAnnouncements });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const create = useMutation({
    mutationFn: () => engagementApi.createAnnouncement({ title, body }),
    onSuccess: () => {
      toast.success('Announcement published.');
      setOpen(false);
      setTitle(''); setBody('');
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
    onError: (e) => toast.error(extractApiMessage(e, 'Could not publish.')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => engagementApi.deleteAnnouncement(id),
    onSuccess: () => {
      toast.success('Announcement removed.');
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Announcements</CardTitle>
        {isAdmin && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New</Button>}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : data && data.length > 0 ? (
          data.map((a) => (
            <div key={a.id} className="rounded-md border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">{a.title}</h3>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(a.publishedAt)}</p>
                </div>
                {isAdmin && (
                  <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => remove.mutate(a.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">No announcements yet.</p>
        )}
      </CardContent>

      {isAdmin && (
        <Dialog open={open} onClose={() => setOpen(false)} title="New announcement">
          <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-3">
            <div className="space-y-1.5"><Label>Title *</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Message *</Label><Textarea required value={body} onChange={(e) => setBody(e.target.value)} rows={5} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>{create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Publish</Button>
            </div>
          </form>
        </Dialog>
      )}
    </Card>
  );
}

function Documents({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['portal-docs'], queryFn: engagementApi.listPortalDocs });
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title) return;
    setBusy(true);
    try {
      await engagementApi.uploadPortalDoc(file, { title, category: category || undefined });
      toast.success('Document uploaded.');
      setFile(null); setTitle(''); setCategory('');
      queryClient.invalidateQueries({ queryKey: ['portal-docs'] });
    } catch (err) {
      toast.error(extractApiMessage(err, 'Upload failed.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = useMutation({
    mutationFn: (id: string) => engagementApi.deletePortalDoc(id),
    onSuccess: () => {
      toast.success('Document removed.');
      queryClient.invalidateQueries({ queryKey: ['portal-docs'] });
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Document portal</CardTitle><CardDescription>Company policies, handbooks and shared resources.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {isAdmin && (
          <form onSubmit={upload} className="grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-[1fr_160px_auto_auto]">
            <Input placeholder="Document title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <Input placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Button type="submit" disabled={busy || !file}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Upload</Button>
          </form>
        )}

        <Table>
          <TableHeader>
            <TableRow><TableHead>Title</TableHead><TableHead>Category</TableHead><TableHead>Size</TableHead><TableHead>Updated</TableHead><TableHead></TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : data && data.length > 0 ? (
              data.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.title}</TableCell>
                  <TableCell>{d.category ? <Badge variant="secondary">{d.category}</Badge> : '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{Math.round(d.size / 1024)} KB</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(d.updatedAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <a href={engagementApi.portalDocUrl(d.id)} target="_blank" rel="noreferrer">
                        <Button variant="ghost" size="icon" aria-label="Download"><Download className="h-4 w-4" /></Button>
                      </a>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => remove.mutate(d.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No documents yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
