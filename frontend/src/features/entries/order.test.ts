import { describe, expect, it } from 'vitest'

import { applyOrder, finalOrder, moveToList, type OrderedEntry } from './order'

const entries: OrderedEntry[] = [
  { id: 'a1', listId: 'A' },
  { id: 'a2', listId: 'A' },
  { id: 'a3', listId: 'A' },
  { id: 'b1', listId: 'B' },
  { id: 'b2', listId: 'B' },
]

const ids = (list: OrderedEntry[]) => list.map((entry) => `${entry.listId}:${entry.id}`)

describe('moveToList', () => {
  it('inserts the entry before the given entry of the other list', () => {
    expect(ids(moveToList(entries, 'a2', 'B', 'b2'))).toEqual(['A:a1', 'A:a3', 'B:b1', 'B:a2', 'B:b2'])
  })
  it('appends the entry after the last entry of the other list', () => {
    expect(ids(moveToList(entries, 'a2', 'B', null))).toEqual(['A:a1', 'A:a3', 'B:b1', 'B:b2', 'B:a2'])
  })
  it('appends the entry to an empty list', () => {
    expect(ids(moveToList(entries, 'a2', 'C', null))).toEqual(['A:a1', 'A:a3', 'B:b1', 'B:b2', 'C:a2'])
  })
  it('keeps the entries when the entry is already in the list', () => {
    expect(moveToList(entries, 'a2', 'A', 'a1')).toBe(entries)
  })
  it('keeps the entries for an unknown entry', () => {
    expect(moveToList(entries, 'x', 'B', null)).toBe(entries)
  })
})

describe('finalOrder', () => {
  const cases: { name: string; preview: OrderedEntry[]; active: string; over: string | null; want: ReturnType<typeof finalOrder> }[] = [
    { name: 'moves an entry down inside its list', preview: entries, active: 'a1', over: 'a2', want: { listId: 'A', entryIds: ['a2', 'a1', 'a3'] } },
    { name: 'moves an entry up inside its list', preview: entries, active: 'a3', over: 'a1', want: { listId: 'A', entryIds: ['a3', 'a1', 'a2'] } },
    { name: 'skips a hidden entry when moving down', preview: entries, active: 'a1', over: 'a3', want: { listId: 'A', entryIds: ['a2', 'a3', 'a1'] } },
    { name: 'keeps the place from the preview in another list', preview: moveToList(entries, 'a2', 'B', 'b2'), active: 'a2', over: 'a2', want: { listId: 'B', entryIds: ['b1', 'a2', 'b2'] } },
    { name: 'moves inside the other list after the switch', preview: moveToList(entries, 'a2', 'B', 'b1'), active: 'a2', over: 'b2', want: { listId: 'B', entryIds: ['b1', 'b2', 'a2'] } },
    { name: 'drops into an empty list', preview: moveToList(entries, 'a2', 'C', null), active: 'a2', over: null, want: { listId: 'C', entryIds: ['a2'] } },
    { name: 'returns null when dropped on itself', preview: entries, active: 'a1', over: 'a1', want: null },
    { name: 'returns null for an unknown entry', preview: entries, active: 'x', over: 'a1', want: null },
  ]
  for (const tc of cases) {
    it(tc.name, () => {
      expect(finalOrder(entries, tc.preview, tc.active, tc.over)).toEqual(tc.want)
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
    expect(applyOrder(cached, { listId: 'B', entryIds: ['a2', 'b1'] })).toEqual([
      { id: 'a1', listId: 'A', position: 1 },
      { id: 'a2', listId: 'B', position: 1 },
      { id: 'b1', listId: 'B', position: 2 },
    ])
  })
})
