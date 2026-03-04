import { describe, expect, it } from 'vitest';
import { Button } from '../src/index.js';

describe('@mfjs/ui', () => {
  it('Button returns html string', () => {
    expect(Button('Hi')).toContain('<button>');
  });
});
