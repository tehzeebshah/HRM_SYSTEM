// Pure payroll computation engine — no Prisma / no side effects.
// Extracted into its own module so it can be unit-tested in isolation.

export interface LineItem {
  code: string;
  name: string;
  type: 'earning' | 'deduction' | 'tax';
  amount: number;
}

export interface ComputedPay {
  gross: number;
  totalDeductions: number;
  tax: number;
  net: number;
  components: LineItem[];
}

export interface Bracket {
  from: number;
  to: number | null;
  rate: number;
}

export interface CatalogEntry {
  code: string;
  name: string;
  type: 'earning' | 'deduction' | 'tax';
}

export interface StructureComponentInput {
  code: string;
  calcMode: 'fixed' | 'percentage' | 'formula';
  value: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Progressive tax: each bracket taxes the slice of income within its band. */
export function progressiveTax(amount: number, brackets: Bracket[]): number {
  let tax = 0;
  const sorted = [...brackets].sort((a, b) => a.from - b.from);
  for (const b of sorted) {
    if (amount <= b.from) break;
    const upper = b.to === null ? amount : Math.min(amount, b.to);
    const taxableSlice = upper - b.from;
    if (taxableSlice > 0) tax += taxableSlice * (b.rate / 100);
  }
  return round2(tax);
}

/**
 * Core computation. Earnings: fixed + percentage-of-base (sum of fixed earnings).
 * Deductions: fixed + percentage-of-gross. Tax: explicit tax components first,
 * falling back to a progressive bracket table when none are present.
 * Net = gross − deductions − tax.
 */
export function computePay(
  structureComponents: StructureComponentInput[],
  catalog: Map<string, CatalogEntry>,
  brackets?: Bracket[],
): ComputedPay {
  const earnings: LineItem[] = [];
  const deductions: LineItem[] = [];
  const taxItems: LineItem[] = [];

  // Base for percentage earnings = sum of fixed earnings values.
  const base = round2(
    structureComponents
      .filter((c) => (catalog.get(c.code)?.type ?? 'earning') === 'earning' && c.calcMode === 'fixed')
      .reduce((s, c) => s + c.value, 0),
  );

  for (const c of structureComponents) {
    const cat = catalog.get(c.code);
    const type = cat?.type ?? 'earning';
    const name = cat?.name ?? c.code;
    const amount =
      c.calcMode === 'fixed'
        ? round2(c.value)
        : c.calcMode === 'percentage'
          ? round2((c.value / 100) * (type === 'earning' ? base : 0))
          : 0;
    if (type === 'earning') earnings.push({ code: c.code, name, type, amount });
  }
  const gross = round2(earnings.reduce((s, e) => s + e.amount, 0));

  for (const c of structureComponents) {
    const cat = catalog.get(c.code);
    const type = cat?.type ?? 'earning';
    if (type !== 'deduction') continue;
    const name = cat?.name ?? c.code;
    const amount =
      c.calcMode === 'fixed'
        ? round2(c.value)
        : c.calcMode === 'percentage'
          ? round2((c.value / 100) * gross)
          : 0;
    deductions.push({ code: c.code, name, type, amount });
  }
  const totalDeductions = round2(deductions.reduce((s, d) => s + d.amount, 0));

  // Tax: explicit tax components first; fall back to bracket table if none.
  let taxFromComponents = 0;
  for (const c of structureComponents) {
    const cat = catalog.get(c.code);
    if (cat?.type !== 'tax') continue;
    const amount =
      c.calcMode === 'fixed'
        ? round2(c.value)
        : c.calcMode === 'percentage'
          ? round2((c.value / 100) * gross)
          : 0;
    taxItems.push({ code: c.code, name: cat.name, type: 'tax', amount });
    taxFromComponents += amount;
  }
  if (taxItems.length === 0 && brackets && brackets.length) {
    taxItems.push({ code: 'tax', name: 'Income Tax', type: 'tax', amount: progressiveTax(gross, brackets) });
  }
  const tax = round2(taxItems.reduce((s, t) => s + t.amount, 0));

  const net = round2(gross - totalDeductions - tax);
  return { gross, totalDeductions, tax, net, components: [...earnings, ...deductions, ...taxItems] };
}
