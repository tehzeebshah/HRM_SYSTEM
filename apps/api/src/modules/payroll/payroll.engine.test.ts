import { describe, it, expect } from 'vitest';
import { computePay, progressiveTax, type CatalogEntry } from './payroll.engine';

function catalog(entries: Record<string, Omit<CatalogEntry, 'code'>>): Map<string, CatalogEntry> {
  const map = new Map<string, CatalogEntry>();
  for (const [code, val] of Object.entries(entries)) map.set(code, { code, ...val });
  return map;
}

describe('progressiveTax', () => {
  it('returns 0 below the first bracket', () => {
    expect(progressiveTax(0, [{ from: 1000, to: null, rate: 10 }])).toBe(0);
    expect(progressiveTax(999, [{ from: 1000, to: null, rate: 10 }])).toBe(0);
  });

  it('taxes only the slice within a single open-ended bracket', () => {
    // 10% on everything above 1000 → 5000 taxable → 500
    expect(progressiveTax(6000, [{ from: 1000, to: null, rate: 10 }])).toBe(500);
  });

  it('applies progressive bands cumulatively', () => {
    const brackets = [
      { from: 0, to: 1000, rate: 0 },
      { from: 1000, to: 5000, rate: 10 },
      { from: 5000, to: null, rate: 20 },
    ];
    // 0–1000: 1000 × 0% = 0; 1000–5000: 4000 × 10% = 400; 5000–8000: 3000 × 20% = 600 → 1000
    expect(progressiveTax(8000, brackets)).toBe(1000);
  });

  it('is unaffected by bracket ordering in the source array', () => {
    const a = [
      { from: 5000, to: null, rate: 20 },
      { from: 0, to: 1000, rate: 0 },
      { from: 1000, to: 5000, rate: 10 },
    ];
    expect(progressiveTax(8000, a)).toBe(1000);
  });

  it('handles the edge exactly at a band boundary', () => {
    expect(progressiveTax(1000, [{ from: 1000, to: null, rate: 10 }])).toBe(0);
  });
});

describe('computePay', () => {
  it('sums fixed earnings into gross', () => {
    const cat = catalog({
      basic: { name: 'Basic', type: 'earning' },
      hra: { name: 'HRA', type: 'earning' },
    });
    const pay = computePay(
      [
        { code: 'basic', calcMode: 'fixed', value: 3000 },
        { code: 'hra', calcMode: 'fixed', value: 1000 },
      ],
      cat,
    );
    expect(pay.gross).toBe(4000);
    expect(pay.net).toBe(4000);
    expect(pay.totalDeductions).toBe(0);
    expect(pay.tax).toBe(0);
  });

  it('computes percentage earnings against the base (sum of fixed earnings)', () => {
    const cat = catalog({
      basic: { name: 'Basic', type: 'earning' },
      transport: { name: 'Transport', type: 'earning' },
    });
    // base = 4000; transport = 10% of 4000 = 400
    const pay = computePay(
      [
        { code: 'basic', calcMode: 'fixed', value: 4000 },
        { code: 'transport', calcMode: 'percentage', value: 10 },
      ],
      cat,
    );
    expect(pay.gross).toBe(4400);
  });

  it('computes percentage deductions against gross', () => {
    const cat = catalog({
      basic: { name: 'Basic', type: 'earning' },
      pension: { name: 'Pension', type: 'deduction' },
    });
    const pay = computePay(
      [
        { code: 'basic', calcMode: 'fixed', value: 5000 },
        { code: 'pension', calcMode: 'percentage', value: 5 },
      ],
      cat,
    );
    expect(pay.gross).toBe(5000);
    expect(pay.totalDeductions).toBe(250); // 5% of 5000
    expect(pay.net).toBe(4750);
  });

  it('falls back to the bracket table when no explicit tax component exists', () => {
    const cat = catalog({ basic: { name: 'Basic', type: 'earning' } });
    const brackets = [{ from: 1000, to: null, rate: 10 }];
    const pay = computePay([{ code: 'basic', calcMode: 'fixed', value: 5000 }], cat, brackets);
    // taxable slice = 5000 − 1000 = 4000 → 10% = 400
    expect(pay.tax).toBe(400);
    expect(pay.net).toBe(4600);
  });

  it('prefers an explicit tax component over the bracket table', () => {
    const cat = catalog({
      basic: { name: 'Basic', type: 'earning' },
      paye: { name: 'PAYE', type: 'tax' },
    });
    const brackets = [{ from: 0, to: null, rate: 50 }]; // would be huge if used
    const pay = computePay(
      [
        { code: 'basic', calcMode: 'fixed', value: 5000 },
        { code: 'paye', calcMode: 'percentage', value: 10 },
      ],
      cat,
      brackets,
    );
    expect(pay.tax).toBe(500); // 10% of gross 5000 — NOT the bracket
  });

  it('treats unknown component codes as earnings by default', () => {
    const pay = computePay([{ code: 'mystery', calcMode: 'fixed', value: 1234 }], new Map());
    expect(pay.gross).toBe(1234);
  });

  it('rounds to 2 decimal places (avoids float drift)', () => {
    const cat = catalog({
      basic: { name: 'Basic', type: 'earning' },
      dues: { name: 'Dues', type: 'deduction' },
    });
    const pay = computePay(
      [
        { code: 'basic', calcMode: 'fixed', value: 1000 },
        { code: 'dues', calcMode: 'percentage', value: 33.33 },
      ],
      cat,
    );
    // 33.33% of 1000 = 333.3 → both decimals-correct
    expect(pay.totalDeductions).toBe(333.3);
    expect(pay.net).toBe(666.7);
  });

  it('produces line items for every earning, deduction and tax', () => {
    const cat = catalog({
      basic: { name: 'Basic', type: 'earning' },
      pension: { name: 'Pension', type: 'deduction' },
      paye: { name: 'PAYE', type: 'tax' },
    });
    const pay = computePay(
      [
        { code: 'basic', calcMode: 'fixed', value: 4000 },
        { code: 'pension', calcMode: 'percentage', value: 5 },
        { code: 'paye', calcMode: 'percentage', value: 10 },
      ],
      cat,
    );
    expect(pay.components.map((c) => c.type).sort()).toEqual(['deduction', 'earning', 'tax']);
  });
});
