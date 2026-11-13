import { arrayMove } from '@dnd-kit/sortable'

export type OrderedEntry = { id: string; listId: string }

export type EntryOrder = { listId: string; entryIds: string[] }

export function idsOfList(entries: OrderedEntry[], listId: string): string[] {
  return entries.filter((entry) => entry.listId === listId).map((entry) => entry.id)
}

export function moveToList<T extends OrderedEntry>(entries: T[], activeId: string, listId: string, beforeId: string | null): T[] {
  const active = entries.find((entry) => entry.id === activeId)
  if (active === undefined || active.listId === listId) {
    return entries
  }
  const rest = entries.filter((entry) => entry.id !== activeId)
  const moved = { ...active, listId }
  const beforeIndex = beforeId === null ? -1 : rest.findIndex((entry) => entry.id === beforeId)
  if (beforeIndex >= 0) {
    return [...rest.slice(0, beforeIndex), moved, ...rest.slice(beforeIndex)]
  }
  let lastIndex = -1
  rest.forEach((entry, index) => {
    if (entry.listId === listId) {
      lastIndex = index
    }
  })
  return lastIndex >= 0 ? [...rest.slice(0, lastIndex + 1), moved, ...rest.slice(lastIndex + 1)] : [...rest, moved]
}

export function finalOrder(
  original: OrderedEntry[],
  preview: OrderedEntry[],
  activeId: string,
  overId: string | null,
): EntryOrder | null {
  const active = preview.find((entry) => entry.id === activeId)
  if (active === undefined) {
    return null
  }
  const listId = active.listId
  let ids = idsOfList(preview, listId)
  if (overId !== null && overId !== activeId && ids.includes(overId)) {
    ids = arrayMove(ids, ids.indexOf(activeId), ids.indexOf(overId))
  }
  const before = original.find((entry) => entry.id === activeId)
  const unchanged = before?.listId === listId && idsOfList(original, listId).every((id, index) => id === ids[index])
  return unchanged ? null : { listId, entryIds: ids }
}

export function applyOrder<T extends OrderedEntry & { position: number }>(entries: T[], order: EntryOrder): T[] {
  const positions = new Map(order.entryIds.map((id, index) => [id, index + 1]))
  const updated = entries.map((entry) => {
    const position = positions.get(entry.id)
    return position === undefined ? entry : { ...entry, listId: order.listId, position }
  })
  return updated.sort((a, b) => (a.listId === b.listId ? a.position - b.position : a.listId < b.listId ? -1 : 1))
}
