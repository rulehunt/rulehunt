// src/identity.ts

const STORAGE_KEY_ID = 'rulehunt:userId'
const STORAGE_KEY_LABEL = 'rulehunt:userLabel'

/** Generate a random UUID (v4) */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Fallback if crypto.randomUUID not supported
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r =
      (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >> (c === 'x' ? 0 : 1)
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Get or create a persistent user ID */
export function getUserId(): string {
  try {
    let id = localStorage.getItem(STORAGE_KEY_ID)
    if (!id) {
      id = generateUUID()
      localStorage.setItem(STORAGE_KEY_ID, id)
    }
    return id
  } catch {
    // fallback if localStorage not available (e.g. SSR)
    return 'anonymous'
  }
}

/** Get the optional user label (friendly name) */
export function getUserLabel(): string | undefined {
  try {
    return localStorage.getItem(STORAGE_KEY_LABEL) || undefined
  } catch {
    return undefined
  }
}

/** Set or clear the optional user label */
export function setUserLabel(label?: string): void {
  try {
    if (label?.trim()) {
      localStorage.setItem(STORAGE_KEY_LABEL, label.trim())
    } else {
      localStorage.removeItem(STORAGE_KEY_LABEL)
    }
  } catch {
    /* ignore */
  }
}

/** Combined helper: returns the current identity */
export function getUserIdentity(): { userId: string; userLabel?: string } {
  return { userId: getUserId(), userLabel: getUserLabel() }
}
