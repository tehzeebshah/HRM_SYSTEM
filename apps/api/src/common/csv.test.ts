import { describe, it, expect } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
  it('returns the header row only for an empty input', () => {
    expect(toCsv([])).toBe('');
  });

  it('serializes headers + rows', () => {
    const out = toCsv([{ a: 1, b: 'x' }, { a: 2, b: 'y' }]);
    expect(out).toBe('a,b\n1,x\n2,y');
  });

  it('escapes values containing commas', () => {
    expect(toCsv([{ name: 'Doe, John' }])).toBe('name\n"Doe, John"');
  });

  it('escapes values containing double quotes by doubling them', () => {
    expect(toCsv([{ note: 'say "hi"' }])).toBe('note\n"say ""hi"""');
  });

  it('escapes values containing newlines', () => {
    expect(toCsv([{ body: 'line1\nline2' }])).toBe('body\n"line1\nline2"');
  });

  it('renders null and undefined as empty cells', () => {
    expect(toCsv([{ a: null, b: undefined, c: 1 }])).toBe('a,b,c\n,,1');
  });

  it('stringifies numbers and booleans', () => {
    expect(toCsv([{ n: 42, flag: true }])).toBe('n,flag\n42,true');
  });
});
