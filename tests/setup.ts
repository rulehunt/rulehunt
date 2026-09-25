/**
 * Vitest global setup.
 *
 * jsdom 27 under Vitest 4 does not expose Web Storage, so `localStorage` and
 * `sessionStorage` are undefined in tests even though `window` and `document`
 * exist. Provide a minimal in-memory implementation so code under test that
 * persists to storage behaves normally.
 */
class MemoryStorage implements Storage {
  #data = new Map<string, string>()

  get length(): number {
    return this.#data.size
  }

  key(index: number): string | null {
    return [...this.#data.keys()][index] ?? null
  }

  getItem(key: string): string | null {
    return this.#data.get(String(key)) ?? null
  }

  setItem(key: string, value: string): void {
    this.#data.set(String(key), String(value))
  }

  removeItem(key: string): void {
    this.#data.delete(String(key))
  }

  clear(): void {
    this.#data.clear()
  }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  if (typeof globalThis[name] === 'undefined') {
    const storage = new MemoryStorage()
    Object.defineProperty(globalThis, name, {
      value: storage,
      writable: false,
      configurable: true,
    })
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, name, {
        value: storage,
        writable: false,
        configurable: true,
      })
    }
  }
}
