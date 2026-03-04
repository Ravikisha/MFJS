export type StoreListener<T> = (value: T) => void;

export class SimpleStore<T> {
  private value: T;
  private listeners = new Set<StoreListener<T>>();

  constructor(initial: T) {
    this.value = initial;
  }

  get() {
    return this.value;
  }

  set(next: T) {
    this.value = next;
    for (const l of this.listeners) l(this.value);
  }

  subscribe(listener: StoreListener<T>) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
