import { describe, expect, it } from 'vitest';
import { SimpleStore } from '../src/index.js';

describe('@mfjs/state', () => {
  it('notifies subscribers', () => {
    const store = new SimpleStore(0);
    let last = -1;
    store.subscribe((v) => {
      last = v;
    });
    store.set(123);
    expect(last).toBe(123);
  });
});
