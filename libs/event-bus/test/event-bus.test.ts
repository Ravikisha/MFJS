import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/index.js';

describe('EventBus', () => {
  it('emits to subscribed handlers', () => {
    type Events = { ping: { n: number } };
    const bus = new EventBus<Events>();

    let last = 0;
    bus.on('ping', (p) => {
      last = p.n;
    });

    bus.emit('ping', { n: 42 });
    expect(last).toBe(42);
  });
});
