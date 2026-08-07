import { describe, expect, it } from 'vitest';
import { composeLegalName } from './legal-name.util';

describe('composeLegalName', () => {
  it('joins trimmed first and last name', () => {
    expect(composeLegalName(' Alex ', ' Lee ')).toBe('Alex Lee');
  });
});
