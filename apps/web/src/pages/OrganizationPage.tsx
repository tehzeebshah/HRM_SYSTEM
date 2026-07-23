import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Trash2, Pencil, Plus, MapPin, Network } from 'lucide-react';
import { organizationApi, type Department, type Designation, type Location } from '@/lib/organization-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { extractApiMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

type TabKey = 'departments' | 'designations' | 'locations';

export function OrganizationPage() {
  const [tab, setTab] = useState<TabKey>('departments');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organization</h1>
        <p className="text-sm text-muted-foreground">Manage departments, designations and work locations.</p>
      </div>

      <div className="flex gap-1 border-b">
        <Tab active={tab === 'departments'} onClick={() => setTab('departments')}>
          <Building2 className="h-4 w-4" /> Departments
        </Tab>
        <Tab active={tab === 'designations'} onClick={() => setTab('designations')}>
          <Network className="h-4 w-4" /> Designations
        </Tab>
        <Tab active={tab === 'locations'} onClick={() => setTab('locations')}>
          <MapPin className="h-4 w-4" /> Locations
        </Tab>
      </div>

      {tab === 'departments' && <DepartmentsTab />}
      {tab === 'designations' && <DesignationsTab />}
      {tab === 'locations' && <LocationsTab />}
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

// -----------------------------------------------------------------
//  Departments
// -----------------------------------------------------------------

function DepartmentsTab() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: organizationApi.listDepartments,
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => organizationApi.deleteDepartment(id),
    onSuccess: () => {
      toast.success('Department deleted.');
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['reference-data'] });
    },
    onError: (e) => toast.error(extractApiMessage(e, 'Cannot delete department.')),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Departments</CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </CardHeader>
      <CardContent className="divide-y">
        {isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : data && data.length > 0 ? (
          data.map((d) => (
            <div key={d.id} className="flex items-center justify-between py-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  {d.name}
                  {d.code && <span className="text-xs text-muted-foreground">({d.code})</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {d.parent?.name ? `under ${d.parent.name} · ` : ''}
                  {d._count?.employees ?? 0} {(d._count?.employees ?? 0) === 1 ? 'person' : 'people'}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Edit"
                  onClick={() => {
                    setEditing(d);
                    setOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => remove.mutate(d.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">No departments yet.</p>
        )}
      </CardContent>

      <DepartmentDialog
        open={open}
        onClose={() => setOpen(false)}
        department={editing}
        all={data ?? []}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['departments'] });
          queryClient.invalidateQueries({ queryKey: ['reference-data'] });
        }}
      />
    </Card>
  );
}

function DepartmentDialog({
  open,
  onClose,
  department,
  all,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  department: Department | null;
  all: Department[];
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [parentId, setParentId] = useState('');
  const [busy, setBusy] = useState(false);

  // Reset when opened
  useState(() => {
    /* noop — init below */
  });

  // re-init when dialog toggles
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setName(department?.name ?? '');
      setCode(department?.code ?? '');
      setParentId(department?.parentId ?? '');
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { name, code: code || null, parentId: parentId || null };
      if (department) {
        await organizationApi.updateDepartment(department.id, payload);
        toast.success('Department updated.');
      } else {
        await organizationApi.createDepartment(payload);
        toast.success('Department created.');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(extractApiMessage(err, 'Unable to save department.'));
    } finally {
      setBusy(false);
    }
  };

  const candidates = all.filter((d) => d.id !== department?.id);

  return (
    <Dialog open={open} onClose={onClose} title={department ? 'Edit department' : 'Add department'}>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Name *</Label>
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Code</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Parent department</Label>
          <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— None (top level)</option>
            {candidates.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {department ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// -----------------------------------------------------------------
//  Designations
// -----------------------------------------------------------------

function DesignationsTab() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['designations'], queryFn: organizationApi.listDesignations });
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');

  const create = useMutation({
    mutationFn: () => organizationApi.createDesignation({ name, grade: grade || null }),
    onSuccess: () => {
      toast.success('Designation added.');
      setName('');
      setGrade('');
      queryClient.invalidateQueries({ queryKey: ['designations'] });
      queryClient.invalidateQueries({ queryKey: ['reference-data'] });
    },
    onError: (e) => toast.error(extractApiMessage(e, 'Cannot add designation.')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => organizationApi.deleteDesignation(id),
    onSuccess: () => {
      toast.success('Designation deleted.');
      queryClient.invalidateQueries({ queryKey: ['designations'] });
      queryClient.invalidateQueries({ queryKey: ['reference-data'] });
    },
    onError: (e) => toast.error(extractApiMessage(e, 'Cannot delete designation.')),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Designations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-[1fr_120px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <Input placeholder="Designation name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input placeholder="Grade" value={grade} onChange={(e) => setGrade(e.target.value)} />
          <Button type="submit" disabled={create.isPending}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </form>

        <div className="divide-y rounded-md border">
          {isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : data && data.length > 0 ? (
            data.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-3 pl-3 pr-2">
                <div className="text-sm">
                  <span className="font-medium">{d.name}</span>
                  {d.grade && <span className="ml-2 text-xs text-muted-foreground">grade {d.grade}</span>}
                  <span className="ml-2 text-xs text-muted-foreground">
                    · {d._count?.employees ?? 0} people
                  </span>
                </div>
                <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => remove.mutate(d.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No designations yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------
//  Locations
// -----------------------------------------------------------------

function LocationsTab() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['locations'], queryFn: organizationApi.listLocations });
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  const create = useMutation({
    mutationFn: () => organizationApi.createLocation({ name, city: city || null, country: country || null }),
    onSuccess: () => {
      toast.success('Location added.');
      setName('');
      setCity('');
      setCountry('');
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      queryClient.invalidateQueries({ queryKey: ['reference-data'] });
    },
    onError: (e) => toast.error(extractApiMessage(e, 'Cannot add location.')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => organizationApi.deleteLocation(id),
    onSuccess: () => {
      toast.success('Location deleted.');
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      queryClient.invalidateQueries({ queryKey: ['reference-data'] });
    },
    onError: (e) => toast.error(extractApiMessage(e, 'Cannot delete location.')),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Work locations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
          <Input placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
          <Button type="submit" disabled={create.isPending}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </form>

        <div className="divide-y rounded-md border">
          {isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : data && data.length > 0 ? (
            data.map((l) => (
              <div key={l.id} className="flex items-center justify-between py-3 pl-3 pr-2">
                <div className="text-sm">
                  <span className="font-medium">{l.name}</span>
                  {(l.city || l.country) && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {[l.city, l.country].filter(Boolean).join(', ')}
                    </span>
                  )}
                  <span className="ml-2 text-xs text-muted-foreground">· {l._count?.employees ?? 0} people</span>
                </div>
                <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => remove.mutate(l.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No locations yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
