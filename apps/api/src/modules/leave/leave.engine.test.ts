import { describe, it, expect } from 'vitest';
import { workingDays } from './leave.engine';

describe('workingDays', () => {
  it('counts a single weekday as 1', () => {
    // 2024-01-01 is a Monday
    expect(workingDays(new Date('2024-01-01'), new Date('2024-01-01'), [])).toBe(1);
  });

  it('skips weekends', () => {
    // Mon 2024-01-01 → Fri 2024-01-05 = 5; include the weekend (6th/7th) = still 5
    expect(workingDays(new Date('2024-01-01'), new Date('2024-01-07'), [])).toBe(5);
  });

  it('skips holidays that fall within the range', () => {
    // Mon 2024-01-01 → Wed 2024-01-03 = 3 weekdays; declare Tue a holiday → 2
    expect(workingDays(new Date('2024-01-01'), new Date('2024-01-03'), [new Date('2024-01-02')])).toBe(2);
  });

  it('returns at least 0.5 when the range contains only weekends', () => {
    // Sat 2024-01-06 → Sun 2024-01-07
    expect(workingDays(new Date('2024-01-06'), new Date('2024-01-07'), [])).toBe(0.5);
  });

  it('handles a multi-week range', () => {
    // Two full Mon–Fri weeks (2024-01-01 to 2024-01-12, which is the second Friday) = 10
    expect(workingDays(new Date('2024-01-01'), new Date('2024-01-12'), [])).toBe(10);
  });

  it('normalizes the time-of-day component of the inputs', () => {
    const morning = new Date('2024-01-01T08:30:00Z');
    const evening = new Date('2024-01-01T23:59:00Z');
    expect(workingDays(morning, evening, [])).toBe(1);
  });
});
