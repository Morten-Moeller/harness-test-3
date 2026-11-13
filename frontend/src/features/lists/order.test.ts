import { describe, expect, it } from 'vitest'

import { applyListOrder, computeListOrder } from './order'

describe('computeListOrder', () => {
  const ids = ['a', 'b', 'c', 'd']
  const cases: { name: string; active: string; over: string | null; want: string[] | null }[] = [
    { name: 'moves a list down', active: 'a', over: 'c', want: ['b', 'c', 'a', 'd'] },
    { name: 'moves a list up', active: 'd', over: 'b', want: ['a', 'd', 'b', 'c'] },
    { name: 'moves a list to the end', active: 'b', over: 'd', want: ['a', 'c', 'd', 'b'] },
    { name: 'returns null when dropped on itself', active: 'b', over: 'b', want: null },
    { name: 'returns null without a target', active: 'b', over: null, want: null },
    { name: 'returns null for an unknown list', active: 'x', over: 'a', want: null },
  ]
  for (const tc of cases) {
    it(tc.name, () => {
      expect(computeListOrder(ids, tc.active, tc.over)).toEqual(tc.want)
    })
  }
})

describe('applyListOrder', () => {
  it('sets the positions and sorts by them', () => {
    const lists = [
      { id: 'a', position: 1 },
      { id: 'b', position: 2 },
      { id: 'c', position: 3 },
    ]
    expect(applyListOrder(lists, ['c', 'a', 'b'])).toEqual([
      { id: 'c', position: 1 },
      { id: 'a', position: 2 },
      { id: 'b', position: 3 },
    ])
  })
})
