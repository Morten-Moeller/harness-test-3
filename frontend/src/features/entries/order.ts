import { arrayMove } from '@dnd-kit/sortable'

export type OrderedEntry = { id: string; listId: string }

export type DropTarget = { type: 'entry'; id: string } | { type: 'list'; id: string }

export type EntryOrder = { listId: string; entryIds: string[] }

export function computeOrder(entries: OrderedEntry[], activeId: string, over: DropTarget): EntryOrder | null {
  const active = entries.find((entry) => entry.id === activeId)
  if (active === undefined) {
    return null
  }
  const overEntry = over.type === 'entry' ? entries.find((entry) => entry.id === over.id) : undefined
  if (over.type === 'entry' && overEntry === undefined) {
    return null
  }
  const listId = over.type === 'list' ? over.id : (overEntry as OrderedEntry).listId
  const current = entries.filter((entry) => entry.listId === listId).map((entry) => entry.id)
  const sameList = active.listId === listId

  let next: string[]
  if (over.type === 'list') {
    next = sameList ? [...current.filter((id) => id !== activeId), activeId] : [...current, activeId]
  } else if (over.id === activeId) {
    return null
  } else if (sameList) {
    next = arrayMove(current, current.indexOf(activeId), current.indexOf(over.id))
  } else {
    next = [...current]
    next.splice(current.indexOf(over.id), 0, activeId)
  }

  if (sameList && next.every((id, index) => id === current[index])) {
    return null
  }
  return { listId, entryIds: next }
}

export function applyOrder<T extends OrderedEntry & { position: number }>(entries: T[], order: EntryOrder): T[] {
  const positions = new Map(order.entryIds.map((id, index) => [id, index + 1]))
  const updated = entries.map((entry) => {
    const position = positions.get(entry.id)
    return position === undefined ? entry : { ...entry, listId: order.listId, position }
  })
  return updated.sort((a, b) => (a.listId === b.listId ? a.position - b.position : a.listId < b.listId ? -1 : 1))
}
