import { describe, expect, it } from 'vitest'

import { OPEN_ONLY_KEY, type OpenOnlyStorage, readOpenOnly, writeOpenOnly } from './openOnly'

function memoryStorage(initial: Record<string, string> = {}): OpenOnlyStorage {
  const items = new Map(Object.entries(initial))
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value)
    },
  }
}

const blocked = (): OpenOnlyStorage => {
  throw new Error('storage is blocked')
}

const throwing: OpenOnlyStorage = {
  getItem: () => {
    throw new Error('read is blocked')
  },
  setItem: () => {
    throw new Error('write is blocked')
  },
}

describe('readOpenOnly', () => {
  const cases: { name: string; storage: () => OpenOnlyStorage; want: boolean }[] = [
    { name: 'reads false when storage is empty', storage: () => memoryStorage(), want: false },
    { name: 'reads false when storage is blocked', storage: blocked, want: false },
    { name: 'reads false when the read throws', storage: () => throwing, want: false },
    { name: 'reads false for a value that is not true', storage: () => memoryStorage({ [OPEN_ONLY_KEY]: 'yes' }), want: false },
    { name: 'reads true for the stored value true', storage: () => memoryStorage({ [OPEN_ONLY_KEY]: 'true' }), want: true },
  ]
  for (const tc of cases) {
    it(tc.name, () => {
      expect(readOpenOnly(tc.storage)).toBe(tc.want)
    })
  }
})

describe('writeOpenOnly', () => {
  it('writes and reads the value', () => {
    const storage = memoryStorage()
    const access = () => storage
    writeOpenOnly(access, true)
    expect(readOpenOnly(access)).toBe(true)
    writeOpenOnly(access, false)
    expect(readOpenOnly(access)).toBe(false)
  })
  it('ignores a blocked storage', () => {
    expect(() => writeOpenOnly(blocked, true)).not.toThrow()
    expect(() => writeOpenOnly(() => throwing, true)).not.toThrow()
  })
})
