import {
  type Announcements,
  closestCenter,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragOverEvent,
  type DragStartEvent,
  getFirstCollision,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  type ScreenReaderInstructions,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { type Entry, entriesKey, useReorderEntries } from './entriesApi'
import styles from './EntryList.module.css'
import { applyOrder, finalOrder, moveToList } from './order'

type DragData = { type: 'entry'; listId: string } | { type: 'list'; listId: string }

const PreviewContext = createContext<Entry[] | null>(null)

export function useDragPreview(): Entry[] | null {
  return useContext(PreviewContext)
}

function lastIdOfList(entries: Entry[], listId: string): string | null {
  const ids = entries.filter((entry) => entry.listId === listId).map((entry) => entry.id)
  return ids.at(-1) ?? null
}

export function listDroppableId(listId: string): string {
  return `list:${listId}`
}

const entryInListUnderPointerRaw: CollisionDetection = (args) => {
  const within = pointerWithin(args)
  const hits = within.length > 0 ? within : rectIntersection(args)
  const firstId = getFirstCollision(hits, 'id')
  if (firstId === null) {
    return []
  }
  const first = args.droppableContainers.find((container) => container.id === firstId)
  const listId = (first?.data.current as DragData | undefined)?.listId
  const entriesOfList = args.droppableContainers.filter((container) => {
    const data = container.data.current as DragData | undefined
    return data?.type === 'entry' && data.listId === listId
  })
  if (entriesOfList.length === 0) {
    return [{ id: firstId }]
  }
  return closestCenter({ ...args, droppableContainers: entriesOfList })
}

export function EntriesDndProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation('entries')
  const queryClient = useQueryClient()
  const reorder = useReorderEntries()
  const [preview, setPreview] = useState<Entry[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const previewRef = useRef<Entry[] | null>(null)
  const originalRef = useRef<Entry[] | null>(null)
  const movedToListRef = useRef(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const showPreview = (next: Entry[] | null) => {
    previewRef.current = next
    setPreview(next)
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      movedToListRef.current = false
    })
    return () => cancelAnimationFrame(frame)
  }, [preview])

  const collisionDetection: CollisionDetection = useCallback((args) => {
    if (movedToListRef.current && args.active !== null) {
      return [{ id: args.active.id }]
    }
    return entryInListUnderPointerRaw(args)
  }, [])

  const announcements: Announcements = useMemo(() => {
    const current = (): Entry[] => previewRef.current ?? queryClient.getQueryData<Entry[]>(entriesKey) ?? []
    const titleOf = (id: string | number): string => current().find((entry) => entry.id === id)?.title ?? ''
    const positionOf = (id: string | number): number => {
      const entries = current()
      const listId = entries.find((entry) => entry.id === id)?.listId
      const mine = entries.filter((entry) => entry.listId === listId)
      const index = mine.findIndex((entry) => entry.id === id)
      return index < 0 ? 1 : index + 1
    }
    return {
      onDragStart: ({ active }) => t('dnd.pickedUp', { title: titleOf(active.id) }),
      onDragOver: ({ active, over }) =>
        over === null
          ? t('dnd.noTarget', { title: titleOf(active.id) })
          : t('dnd.movedOver', { title: titleOf(active.id), position: positionOf(over.data.current?.type === 'list' ? active.id : over.id) }),
      onDragEnd: ({ active, over }) =>
        over === null
          ? t('dnd.cancelled', { title: titleOf(active.id) })
          : t('dnd.dropped', { title: titleOf(active.id), position: positionOf(active.id) }),
      onDragCancel: ({ active }) => t('dnd.cancelled', { title: titleOf(active.id) }),
    }
  }, [t, queryClient])

  const instructions: ScreenReaderInstructions = { draggable: t('dnd.instructions') }

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id))
    const entries = queryClient.getQueryData<Entry[]>(entriesKey) ?? []
    originalRef.current = entries
    showPreview(entries)
  }

  const onDragOver = ({ active, over }: DragOverEvent) => {
    const current = previewRef.current
    if (over === null || current === null || over.id === active.id) {
      return
    }
    const data = over.data.current as DragData | undefined
    if (data === undefined) {
      return
    }
    const activeEntry = current.find((entry) => entry.id === active.id)
    if (activeEntry === undefined || activeEntry.listId === data.listId) {
      return
    }
    const beforeId = data.type === 'entry' ? String(over.id) : null
    movedToListRef.current = true
    showPreview(moveToList(current, String(active.id), data.listId, beforeId))
  }

  const finish = () => {
    setActiveId(null)
    originalRef.current = null
    showPreview(null)
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const original = originalRef.current
    const current = previewRef.current
    if (over === null || original === null || current === null) {
      finish()
      return
    }
    const data = over.data.current as DragData | undefined
    const overId = data?.type === 'entry' ? String(over.id) : data?.type === 'list' ? lastIdOfList(current, data.listId) : null
    const order = finalOrder(original, current, String(active.id), overId)
    if (order !== null) {
      queryClient.setQueryData<Entry[]>(entriesKey, applyOrder(current, order))
      reorder.mutate({ ...order, previous: original })
    }
    finish()
  }

  const activeEntry = preview?.find((entry) => entry.id === activeId) ?? null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      accessibility={{ announcements, screenReaderInstructions: instructions }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={finish}
    >
      <PreviewContext.Provider value={preview}>{children}</PreviewContext.Provider>
      <DragOverlay>{activeEntry === null ? null : <ActiveEntryOverlay entry={activeEntry} />}</DragOverlay>
    </DndContext>
  )
}

function ActiveEntryOverlay({ entry }: { entry: Entry }) {
  return (
    <div className={styles.overlay} data-testid="entry-overlay">
      <span className={styles.overlayHandle} aria-hidden="true" />
      <span className={entry.done ? styles.overlayDone : undefined}>{entry.title}</span>
    </div>
  )
}
