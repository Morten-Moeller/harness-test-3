import { describe, expect, it } from 'vitest'

import { applyOrder, computeOrder, type OrderedEntry } from './order'

const entries: OrderedEntry[] = [
  { id: 'a1', listId: 'A' },
  { id: 'a2', listId: 'A' },
  { id: 'a3', listId: 'A' },
  { id: 'b1', listId: 'B' },
  { id: 'b2', listId: 'B' },
]

describe('computeOrder', () => {
  const cases: { name: string; active: string; over: Parameters<typeof computeOrder>[2]; want: ReturnType<typeof computeOrder> }[] = [
    { name: 'moves an entry down inside its list', active: 'a1', over: { type: 'entry', id: 'a2' }, want: { listId: 'A', entryIds: ['a2', 'a1', 'a3'] } },
    { name: 'moves an entry up inside its list', active: 'a3', over: { type: 'entry', id: 'a1' }, want: { listId: 'A', entryIds: ['a3', 'a1', 'a2'] } },
    { name: 'skips a hidden entry when moving down', active: 'a1', over: { type: 'entry', id: 'a3' }, want: { listId: 'A', entryIds: ['a2', 'a3', 'a1'] } },
    { name: 'inserts before the entry of another list', active: 'a2', over: { type: 'entry', id: 'b2' }, want: { listId: 'B', entryIds: ['b1', 'a2', 'b2'] } },
    { name: 'appends when dropped on another list', active: 'a2', over: { type: 'list', id: 'B' }, want: { listId: 'B', entryIds: ['b1', 'b2', 'a2'] } },
    { name: 'appends when dropped on an empty list', active: 'a2', over: { type: 'list', id: 'C' }, want: { listId: 'C', entryIds: ['a2'] } },
    { name: 'moves to the end when dropped on its own list', active: 'a1', over: { type: 'list', id: 'A' }, want: { listId: 'A', entryIds: ['a2', 'a3', 'a1'] } },
    { name: 'returns null when dropped on itself', active: 'a1', over: { type: 'entry', id: 'a1' }, want: null },
    { name: 'returns null when the last entry is dropped on its own list', active: 'a3', over: { type: 'list', id: 'A' }, want: null },
    { name: 'returns null for an unknown active entry', active: 'x', over: { type: 'entry', id: 'a1' }, want: null },
    { name: 'returns null for an unknown over entry', active: 'a1', over: { type: 'entry', id: 'x' }, want: null },
  ]
  for (const tc of cases) {
    it(tc.name, () => {
      expect(computeOrder(entries, tc.active, tc.over)).toEqual(tc.want)
    })
  }
})

describe('applyOrder', () => {
  it('sets listId and position and sorts by list and position', () => {
    const cached = [
      { id: 'a1', listId: 'A', position: 1 },
      { id: 'a2', listId: 'A', position: 2 },
      { id: 'b1', listId: 'B', position: 1 },
    ]
    const result = applyOrder(cached, { listId: 'B', entryIds: ['a2', 'b1'] })
    expect(result).toEqual([
      { id: 'a1', listId: 'A', position: 1 },
      { id: 'a2', listId: 'B', position: 1 },
      { id: 'b1', listId: 'B', position: 2 },
    ])
  })
})
