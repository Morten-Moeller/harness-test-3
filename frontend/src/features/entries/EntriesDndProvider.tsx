import {
  type Announcements,
  closestCenter,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorCodeOf } from '../../api/problem'
import { type DndModule, dragTypeOf } from '../../app/dndModule'
import { type Entry, entriesKey, useReorderEntries } from './entriesApi'
import styles from './EntryList.module.css'
import { applyOrder, finalOrder, moveToList } from './order'

type DragData = { type: string; listId?: string }

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

const entryInListUnderPointer: CollisionDetection = (args) => {
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

export function useEntriesDnd(): DndModule {
  const { t } = useTranslation('entries')
  const queryClient = useQueryClient()
  const reorder = useReorderEntries()
  const [preview, setPreview] = useState<Entry[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const previewRef = useRef<Entry[] | null>(null)
  const originalRef = useRef<Entry[] | null>(null)
  const movedToListRef = useRef(false)

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

  const collision: CollisionDetection = useCallback((args) => {
    if (movedToListRef.current) {
      return [{ id: args.active.id }]
    }
    return entryInListUnderPointer(args)
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
          : t('dnd.movedOver', { title: titleOf(active.id), position: positionOf(over.data.current?.type === 'entry' ? over.id : active.id) }),
      onDragEnd: ({ active, over }) =>
        over === null
          ? t('dnd.cancelled', { title: titleOf(active.id) })
          : t('dnd.dropped', { title: titleOf(active.id), position: positionOf(active.id) }),
      onDragCancel: ({ active }) => t('dnd.cancelled', { title: titleOf(active.id) }),
    }
  }, [t, queryClient])

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
    if (data?.listId === undefined) {
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
    const overId =
      data?.type === 'entry' ? String(over.id) : data?.listId !== undefined ? lastIdOfList(current, data.listId) : null
    const order = finalOrder(original, current, String(active.id), overId)
    if (order !== null) {
      queryClient.setQueryData<Entry[]>(entriesKey, applyOrder(current, order))
      reorder.mutate({ ...order, previous: original })
    }
    finish()
  }

  const activeEntry = preview?.find((entry) => entry.id === activeId) ?? null
  const errorText = reorder.isError ? t(errorCodeOf(reorder.error) === 'CONFLICT' ? 'errors.conflict' : 'errors.unknown') : null

  return {
    type: 'entry',
    accepts: (data) => dragTypeOf(data) === 'entry' || dragTypeOf(data) === 'list',
    instructions: t('dnd.instructions'),
    collision,
    announcements,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDragCancel: finish,
    overlay: activeEntry === null ? null : <ActiveEntryOverlay entry={activeEntry} />,
    wrap: (children) => (
      <PreviewContext.Provider value={preview}>
        {errorText !== null && (
          <p className={styles.error} role="alert" data-testid="entries-dnd-error">
            {errorText}
          </p>
        )}
        {children}
      </PreviewContext.Provider>
    ),
  }
}

function ActiveEntryOverlay({ entry }: { entry: Entry }) {
  return (
    <div className={styles.overlay} data-testid="entry-overlay">
      <span className={styles.overlayHandle} aria-hidden="true" />
      <span className={entry.done ? styles.overlayDone : undefined}>{entry.title}</span>
    </div>
  )
}
