import { type Announcements, closestCenter, type CollisionDetection, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorCodeOf } from '../../api/problem'
import { type DndModule, dragTypeOf } from '../../app/dndModule'
import { type List, listsKey, useReorderLists } from './listsApi'
import styles from './ListsPage.module.css'
import { applyListOrder, computeListOrder } from './order'

export const listDragType = 'listItem'

const closestList: CollisionDetection = (args) =>
  closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter((container) => container.data.current?.type === listDragType),
  })

export function useListsDnd(): DndModule {
  const { t } = useTranslation('lists')
  const queryClient = useQueryClient()
  const reorder = useReorderLists()
  const [activeId, setActiveId] = useState<string | null>(null)

  const announcements: Announcements = useMemo(() => {
    const lists = (): List[] => queryClient.getQueryData<List[]>(listsKey) ?? []
    const titleOf = (id: string | number): string => lists().find((list) => list.id === id)?.title ?? ''
    const positionOf = (id: string | number): number => lists().findIndex((list) => list.id === id) + 1
    return {
      onDragStart: ({ active }) => t('dnd.pickedUp', { title: titleOf(active.id) }),
      onDragOver: ({ active, over }) =>
        over === null
          ? t('dnd.noTarget', { title: titleOf(active.id) })
          : t('dnd.movedOver', { title: titleOf(active.id), position: positionOf(over.id) }),
      onDragEnd: ({ active, over }) =>
        over === null
          ? t('dnd.cancelled', { title: titleOf(active.id) })
          : t('dnd.dropped', { title: titleOf(active.id), position: positionOf(active.id) }),
      onDragCancel: ({ active }) => t('dnd.cancelled', { title: titleOf(active.id) }),
    }
  }, [t, queryClient])

  const onDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id))

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    const previous = queryClient.getQueryData<List[]>(listsKey)
    if (previous === undefined || over === null) {
      return
    }
    const listIds = computeListOrder(
      previous.map((list) => list.id),
      String(active.id),
      String(over.id),
    )
    if (listIds !== null) {
      queryClient.setQueryData<List[]>(listsKey, applyListOrder(previous, listIds))
      reorder.mutate({ listIds, previous })
    }
  }

  const activeList = activeId === null ? undefined : queryClient.getQueryData<List[]>(listsKey)?.find((list) => list.id === activeId)
  const errorText = reorder.isError ? t(errorCodeOf(reorder.error) === 'CONFLICT' ? 'errors.conflict' : 'errors.unknown') : null

  return {
    type: listDragType,
    accepts: (data) => dragTypeOf(data) === listDragType,
    instructions: t('dnd.instructions'),
    collision: closestList,
    announcements,
    onDragStart,
    onDragOver: () => undefined,
    onDragEnd,
    onDragCancel: () => setActiveId(null),
    overlay:
      activeList === undefined ? null : (
        <div className={styles.overlay} data-testid="list-overlay">
          <span className={styles.overlayHandle} aria-hidden="true" />
          <span>{activeList.title}</span>
        </div>
      ),
    wrap: (children) => (
      <>
        {errorText !== null && (
          <p className={styles.error} role="alert" data-testid="lists-dnd-error">
            {errorText}
          </p>
        )}
        {children}
      </>
    ),
  }
}
