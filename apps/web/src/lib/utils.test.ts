import { describe, it, expect } from 'vitest';
import { cn, initials } from './utils';

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('keeps the last conflicting tailwind class (tailwind-merge)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('handles conditional objects', () => {
    expect(cn({ hidden: false, block: true })).toBe('block');
  });
});

describe('initials', () => {
  it('builds uppercase initials from first + last name', () => {
    expect(initials('Ada', 'Admin')).toBe('AA');
  });

  it('returns ? when both names are missing', () => {
    expect(initials(undefined, undefined)).toBe('?');
  });

  it('tolerates a single name', () => {
    expect(initials('Zoe')).toBe('Z');
  });
});
