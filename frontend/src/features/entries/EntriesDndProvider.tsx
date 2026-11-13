import {
  type Announcements,
  closestCorners,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  type ScreenReaderInstructions,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { type Entry, entriesKey, useReorderEntries } from './entriesApi'
import { computeOrder, type DropTarget } from './order'

type DragData = { type: 'entry'; listId: string } | { type: 'list'; listId: string }

const entryUnderPointer: CollisionDetection = (args) => {
  const within = pointerWithin(args)
  const entries = within.filter((collision) => collision.data?.droppableContainer?.data.current?.type === 'entry')
  if (entries.length > 0) {
    return entries
  }
  return within.length > 0 ? within : closestCorners(args)
}

export function listDroppableId(listId: string): string {
  return `list:${listId}`
}

function targetOf(id: string | number, data: DragData | undefined): DropTarget | null {
  if (data === undefined) {
    return null
  }
  return data.type === 'list' ? { type: 'list', id: data.listId } : { type: 'entry', id: String(id) }
}

export function EntriesDndProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation('entries')
  const queryClient = useQueryClient()
  const reorder = useReorderEntries()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const announcements: Announcements = useMemo(() => {
    const cached = (): Entry[] => queryClient.getQueryData<Entry[]>(entriesKey) ?? []
    const titleOf = (id: string | number): string => cached().find((entry) => entry.id === id)?.title ?? ''
    const positionOf = (id: string | number, data: DragData | undefined): number => {
      const mine = cached().filter((entry) => entry.listId === data?.listId)
      const index = mine.findIndex((entry) => entry.id === id)
      return index < 0 ? mine.length + 1 : index + 1
    }
    return {
      onDragStart: ({ active }) => t('dnd.pickedUp', { title: titleOf(active.id) }),
      onDragOver: ({ active, over }) =>
        over === null
          ? t('dnd.noTarget', { title: titleOf(active.id) })
          : t('dnd.movedOver', { title: titleOf(active.id), position: positionOf(over.id, over.data.current as DragData | undefined) }),
      onDragEnd: ({ active, over }) =>
        over === null
          ? t('dnd.cancelled', { title: titleOf(active.id) })
          : t('dnd.dropped', { title: titleOf(active.id), position: positionOf(over.id, over.data.current as DragData | undefined) }),
      onDragCancel: ({ active }) => t('dnd.cancelled', { title: titleOf(active.id) }),
    }
  }, [t, queryClient])

  const instructions: ScreenReaderInstructions = { draggable: t('dnd.instructions') }

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over === null) {
      return
    }
    const target = targetOf(over.id, over.data.current as DragData | undefined)
    const entries = queryClient.getQueryData<Entry[]>(entriesKey)
    if (target === null || entries === undefined) {
      return
    }
    const order = computeOrder(entries, String(active.id), target)
    if (order !== null) {
      reorder.mutate(order)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={entryUnderPointer}
      accessibility={{ announcements, screenReaderInstructions: instructions }}
      onDragEnd={onDragEnd}
    >
      {children}
    </DndContext>
  )
}
