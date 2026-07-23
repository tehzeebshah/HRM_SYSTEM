import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { employeesApi, type EmployeeFormData, type EmployeeListItem } from '@/lib/employees-api';
import { extractApiMessage } from '@/lib/api';
import { EMPLOYMENT_TYPES, EMPLOYEE_STATUSES, formatLabel } from '@/lib/format';
import { useToast } from '@/components/ui/toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  employee?: EmployeeListItem | null;
}

const EMPTY: EmployeeFormData = {
  employeeNo: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  employmentType: 'full_time',
  status: 'active',
  departmentId: '',
  designationId: '',
  locationId: '',
  hireDate: new Date().toISOString().slice(0, 10),
};

export function EmployeeFormDialog({ open, onClose, onSaved, employee }: Props) {
  const isEdit = !!employee;
  const [form, setForm] = useState<EmployeeFormData>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const reference = useQuery({ queryKey: ['reference-data'], queryFn: employeesApi.referenceData });

  useEffect(() => {
    if (open) {
      setError(null);
      setForm(
        employee
          ? {
              employeeNo: employee.employeeNo,
              firstName: employee.firstName,
              lastName: employee.lastName,
              email: employee.email,
              phone: employee.phone ?? '',
              employmentType: employee.employmentType,
              status: employee.status,
              departmentId: employee.department?.id ?? '',
              designationId: employee.designation?.id ?? '',
              locationId: employee.location?.id ?? '',
              hireDate: employee.hireDate ? new Date(employee.hireDate).toISOString().slice(0, 10) : '',
            }
          : EMPTY,
      );
    }
  }, [open, employee]);

  const set = <K extends keyof EmployeeFormData>(key: K, value: EmployeeFormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: EmployeeFormData = {
        ...form,
        departmentId: form.departmentId || null,
        designationId: form.designationId || null,
        locationId: form.locationId || null,
      };
      if (isEdit && employee) {
        const { employeeNo: _omit, ...rest } = payload;
        await employeesApi.update(employee.id, rest);
        toast.success('Employee updated.');
      } else {
        await employeesApi.create(payload);
        toast.success('Employee created.');
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(extractApiMessage(err, 'Unable to save employee.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit employee' : 'Add employee'}
      description={isEdit ? 'Update this person’s details.' : 'Create a new employee record.'}
      className="max-w-2xl"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Employee no." required>
            <Input
              required
              disabled={isEdit}
              value={form.employeeNo}
              onChange={(e) => set('employeeNo', e.target.value)}
            />
          </Field>
          <Field label="Hire date" required>
            <Input
              type="date"
              required
              value={form.hireDate}
              onChange={(e) => set('hireDate', e.target.value)}
            />
          </Field>
          <Field label="First name" required>
            <Input required value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
          </Field>
          <Field label="Last name" required>
            <Input required value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
          </Field>
          <Field label="Email" required>
            <Input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="Department">
            <Select value={form.departmentId ?? ''} onChange={(e) => set('departmentId', e.target.value)}>
              <option value="">—</option>
              {reference.data?.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Designation">
            <Select value={form.designationId ?? ''} onChange={(e) => set('designationId', e.target.value)}>
              <option value="">—</option>
              {reference.data?.designations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Location">
            <Select value={form.locationId ?? ''} onChange={(e) => set('locationId', e.target.value)}>
              <option value="">—</option>
              {reference.data?.locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Employment type">
            <Select value={form.employmentType ?? 'full_time'} onChange={(e) => set('employmentType', e.target.value)}>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {formatLabel(t)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status ?? 'active'} onChange={(e) => set('status', e.target.value)}>
              {EMPLOYEE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {formatLabel(s)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create employee'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}
