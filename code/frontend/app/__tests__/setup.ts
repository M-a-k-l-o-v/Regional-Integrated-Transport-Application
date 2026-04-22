import "@testing-library/jest-dom/vitest";
import * as axeMatchers from "vitest-axe/matchers";
import { expect, beforeEach } from "vitest";

expect.extend(axeMatchers);

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

const memoryStorage = new MemoryStorage();
Object.defineProperty(window, "localStorage", { value: memoryStorage, configurable: true });
Object.defineProperty(window, "sessionStorage", { value: new MemoryStorage(), configurable: true });

beforeEach(() => {
  memoryStorage.clear();
});
