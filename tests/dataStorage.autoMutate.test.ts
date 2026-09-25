// tests/dataStorage.autoMutate.test.ts
//
// The desktop "auto-mutate ruleset on completion" preference and the mobile
// "Auto-Mutate" preference share a name but are different features: mobile's
// controls a rule-*selection* strategy for the swipe feed, desktop's controls
// an autonomous run loop. They must therefore use separate localStorage keys —
// sharing one would let toggling either surface silently disable the other.

import { beforeEach, describe, expect, it } from 'vitest'
import {
  getAutoMutateEnabled,
  getAutoMutateOnCompleteEnabled,
  setAutoMutateEnabled,
  setAutoMutateOnCompleteEnabled,
} from '../src/dataStorage.ts'

const MOBILE_KEY = 'rulehunt-auto-mutate-enabled'
const DESKTOP_KEY = 'rulehunt-auto-mutate-on-complete'

describe('auto-mutate preference storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('desktop: getAutoMutateOnCompleteEnabled', () => {
    it('defaults to enabled when nothing is stored', () => {
      expect(localStorage.getItem(DESKTOP_KEY)).toBeNull()
      expect(getAutoMutateOnCompleteEnabled()).toBe(true)
    })

    it('round-trips true and false through its own key', () => {
      setAutoMutateOnCompleteEnabled(false)
      expect(localStorage.getItem(DESKTOP_KEY)).toBe('false')
      expect(getAutoMutateOnCompleteEnabled()).toBe(false)

      setAutoMutateOnCompleteEnabled(true)
      expect(localStorage.getItem(DESKTOP_KEY)).toBe('true')
      expect(getAutoMutateOnCompleteEnabled()).toBe(true)
    })

    it('treats any non-"true" stored value as disabled', () => {
      localStorage.setItem(DESKTOP_KEY, 'garbage')
      expect(getAutoMutateOnCompleteEnabled()).toBe(false)
    })
  })

  describe('mobile: getAutoMutateEnabled is unchanged', () => {
    it('defaults to enabled and round-trips through the mobile key', () => {
      expect(getAutoMutateEnabled()).toBe(true)

      setAutoMutateEnabled(false)
      expect(localStorage.getItem(MOBILE_KEY)).toBe('false')
      expect(getAutoMutateEnabled()).toBe(false)
    })
  })

  describe('key separation', () => {
    it('toggling the desktop setting does not change the mobile one', () => {
      setAutoMutateOnCompleteEnabled(false)

      expect(getAutoMutateEnabled()).toBe(true)
      expect(localStorage.getItem(MOBILE_KEY)).toBeNull()
    })

    it('toggling the mobile setting does not change the desktop one', () => {
      setAutoMutateEnabled(false)

      expect(getAutoMutateOnCompleteEnabled()).toBe(true)
      expect(localStorage.getItem(DESKTOP_KEY)).toBeNull()
    })

    it('the two preferences can hold opposite values simultaneously', () => {
      setAutoMutateEnabled(false)
      setAutoMutateOnCompleteEnabled(true)

      expect(getAutoMutateEnabled()).toBe(false)
      expect(getAutoMutateOnCompleteEnabled()).toBe(true)

      setAutoMutateEnabled(true)
      setAutoMutateOnCompleteEnabled(false)

      expect(getAutoMutateEnabled()).toBe(true)
      expect(getAutoMutateOnCompleteEnabled()).toBe(false)
    })

    it('uses distinct storage keys', () => {
      setAutoMutateEnabled(false)
      setAutoMutateOnCompleteEnabled(false)

      expect(MOBILE_KEY).not.toBe(DESKTOP_KEY)
      expect(localStorage.getItem(MOBILE_KEY)).toBe('false')
      expect(localStorage.getItem(DESKTOP_KEY)).toBe('false')
    })
  })
})
