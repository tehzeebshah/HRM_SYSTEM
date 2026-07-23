import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Briefcase,
  MapPin,
  FileText,
  Upload,
  Trash2,
  Download,
  Pencil,
} from 'lucide-react';
import { employeesApi, type EmployeeDetail } from '@/lib/employees-api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { initials } from '@/lib/utils';
import { formatLabel, statusVariant } from '@/lib/format';
import { useToast } from '@/components/ui/toast';
import { EmployeeFormDialog } from './EmployeeFormDialog';
import { documentTypeSchema } from '@hrms/shared';

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'info' | 'documents'>('info');
  const [editOpen, setEditOpen] = useState(false);

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeesApi.get(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="py-20 text-center text-muted-foreground">Loading…</div>;
  }
  if (!employee || !id) {
    return <div className="py-20 text-center text-muted-foreground">Employee not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/employees')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Employee profile</h1>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
              {initials(employee.firstName, employee.lastName)}
            </div>
            <div>
              <h2 className="text-xl font-semibold">
                {employee.firstName} {employee.lastName}
              </h2>
              <p className="text-sm text-muted-foreground">
                {employee.designation?.name ?? '—'} · {employee.department?.name ?? '—'}
              </p>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant={statusVariant(employee.status)}>{formatLabel(employee.status)}</Badge>
                <span>· {employee.employeeNo}</span>
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        </CardContent>
      </Card>

      <div className="flex gap-1 border-b">
        <TabButton active={tab === 'info'} onClick={() => setTab('info')}>
          Information
        </TabButton>
        <TabButton active={tab === 'documents'} onClick={() => setTab('documents')}>
          Documents ({employee.documents.length})
        </TabButton>
      </div>

      {tab === 'info' && <InfoTab employee={employee} />}
      {tab === 'documents' && <DocumentsTab employeeId={id} documents={employee.documents} />}

      <EmployeeFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['employee', id] });
          queryClient.invalidateQueries({ queryKey: ['employees'] });
        }}
        employee={employee}
      />
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="w-32 text-sm text-muted-foreground">{label}</div>
      <div className="flex-1 text-sm">{value || '—'}</div>
    </div>
  );
}

interface InfoFields {
  email: string;
  phone: string | null;
  gender: string;
  maritalStatus: string | null;
  nationality: string | null;
  idNumber: string | null;
  dob: string | null;
  hireDate: string;
  confirmDate: string | null;
  employmentType: string;
  location: { name: string } | null;
  manager: { firstName: string; lastName: string } | null;
}

function InfoTab({ employee }: { employee: EmployeeDetail }) {
  const e: InfoFields = {
    email: employee.email,
    phone: employee.phone,
    gender: employee.gender,
    maritalStatus: employee.maritalStatus,
    nationality: employee.nationality,
    idNumber: employee.idNumber,
    dob: employee.dob ? String(employee.dob) : null,
    hireDate: employee.hireDate,
    confirmDate: employee.confirmDate,
    employmentType: employee.employmentType,
    location: employee.location,
    manager: employee.manager,
  };
  const date = (v: string | null) => (v ? new Date(v).toLocaleDateString() : null);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <InfoRow icon={Mail} label="Email" value={e.email} />
          <InfoRow icon={Phone} label="Phone" value={e.phone} />
          <InfoRow icon={Calendar} label="Date of birth" value={date(e.dob)} />
          <InfoRow icon={Briefcase} label="Gender" value={formatLabel(e.gender)} />
          <InfoRow icon={Briefcase} label="Marital status" value={e.maritalStatus} />
          <InfoRow icon={Briefcase} label="Nationality" value={e.nationality} />
          <InfoRow icon={Briefcase} label="ID number" value={e.idNumber} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Employment</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <InfoRow icon={Calendar} label="Hire date" value={date(e.hireDate)} />
          <InfoRow icon={Calendar} label="Confirmed" value={date(e.confirmDate)} />
          <InfoRow icon={Briefcase} label="Type" value={formatLabel(e.employmentType)} />
          <InfoRow icon={MapPin} label="Location" value={e.location?.name} />
          <InfoRow icon={Briefcase} label="Reports to" value={e.manager ? `${e.manager.firstName} ${e.manager.lastName}` : null} />
        </CardContent>
      </Card>
    </div>
  );
}

function DocumentsTab({
  employeeId,
  documents,
}: {
  employeeId: string;
  documents: { id: string; type: string; name: string; mimeType: string; size: number; expiry: string | null; uploadedAt: string }[];
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<string>('other');
  const [docName, setDocName] = useState('');

  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Choose a file first.');
      return employeesApi.uploadDocument(employeeId, file, { type, name: docName || undefined });
    },
    onSuccess: () => {
      setFile(null);
      setDocName('');
      toast.success('Document uploaded.');
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
    },
    onError: (err) => toast.error((err as Error).message ?? 'Upload failed.'),
  });

  const remove = useMutation({
    mutationFn: (documentId: string) => employeesApi.deleteDocument(employeeId, documentId),
    onSuccess: () => {
      toast.success('Document deleted.');
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Documents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-[1fr_180px_auto]">
          <div>
            <Label className="mb-1 block">File</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <Label className="mb-1 block">Type</Label>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {documentTypeSchema.options.map((o) => (
                <option key={o} value={o}>
                  {formatLabel(o)}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <Button disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </div>
        </div>

        {documents.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No documents yet.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{doc.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatLabel(doc.type)} · {Math.round(doc.size / 1024)} KB ·{' '}
                    {new Date(doc.uploadedAt).toLocaleDateString()}
                    {doc.expiry && ` · expires ${new Date(doc.expiry).toLocaleDateString()}`}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <a href={employeesApi.documentDownloadUrl(employeeId, doc.id)} target="_blank" rel="noreferrer">
                    <Button variant="ghost" size="icon" aria-label="Download">
                      <Download className="h-4 w-4" />
                    </Button>
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete"
                    onClick={() => remove.mutate(doc.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
