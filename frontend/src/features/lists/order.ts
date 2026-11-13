import { arrayMove } from '@dnd-kit/sortable'

export function computeListOrder(ids: string[], activeId: string, overId: string | null): string[] | null {
  if (overId === null || overId === activeId) {
    return null
  }
  const from = ids.indexOf(activeId)
  const to = ids.indexOf(overId)
  if (from < 0 || to < 0) {
    return null
  }
  return arrayMove(ids, from, to)
}

export function applyListOrder<T extends { id: string; position: number }>(lists: T[], ids: string[]): T[] {
  const positions = new Map(ids.map((id, index) => [id, index + 1]))
  return lists
    .map((list) => {
      const position = positions.get(list.id)
      return position === undefined ? list : { ...list, position }
    })
    .sort((a, b) => a.position - b.position)
}
