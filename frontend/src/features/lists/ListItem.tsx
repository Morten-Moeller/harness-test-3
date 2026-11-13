import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconButton } from '../../ui/IconButton'
import { InlineTitle } from '../../ui/InlineTitle'
import { TrashIcon } from '../../ui/TrashIcon'
import { errorKey } from './errorKey'
import { listDragType } from './ListsDnd'
import { type List, useDeleteList, useUpdateList } from './listsApi'
import styles from './ListsPage.module.css'

type Mode = 'view' | 'confirmDelete'

export function ListItem({ list, children }: { list: List; children?: ReactNode }) {
  const { t } = useTranslation('lists')
  const updateList = useUpdateList()
  const deleteList = useDeleteList()
  const [mode, setMode] = useState<Mode>('view')
  const confirmButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (mode === 'confirmDelete') {
      confirmButton.current?.focus()
    }
  }, [mode])

  const busy = updateList.isPending || deleteList.isPending
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: list.id,
    data: { type: listDragType, listId: list.id },
  })
  const sortableStyle = { transform: CSS.Translate.toString(transform), transition }

  return (
    <li
      ref={setNodeRef}
      style={sortableStyle}
      className={isDragging ? `${styles.item} ${styles.dragging}` : styles.item}
      data-testid="list-item"
    >
      <div className={styles.itemHeader}>
        <button
          type="button"
          ref={setActivatorNodeRef}
          className={styles.handle}
          aria-label={t('handle')}
          disabled={busy || mode !== 'view'}
          data-testid="list-handle"
          {...attributes}
          {...listeners}
        />
        <h2 className={styles.itemTitle}>
          <InlineTitle
            title={list.title}
            editName={t('editList', { title: list.title })}
            inputName={t('editTitle')}
            busy={busy}
            error={updateList.isError ? t(errorKey(updateList.error)) : null}
            testIds={{ title: 'list-title', input: 'list-edit-input', editor: 'list-edit-form', error: 'list-error' }}
            onOpen={() => updateList.reset()}
            onSave={(draft, close) => updateList.mutate({ listId: list.id, title: draft }, { onSuccess: close })}
            actions={(close) => (
              <IconButton
                label={t('deleteList')}
                icon={<TrashIcon />}
                onPress={() => {
                  close()
                  setMode('confirmDelete')
                }}
                testId="list-delete"
              />
            )}
          />
        </h2>
        {deleteList.isError && (
          <p className={styles.error} role="alert" data-testid="list-error">
            {t(errorKey(deleteList.error))}
          </p>
        )}
      </div>
      {mode === 'confirmDelete' && (
        <div className={styles.confirm} role="group" aria-label={t('confirmDelete')} data-testid="list-delete-confirm">
          <p className={styles.confirmText}>{t('confirmDelete')}</p>
          <button
            ref={confirmButton}
            type="button"
            className={styles.button}
            onClick={() => deleteList.mutate(list.id)}
            disabled={busy}
            data-testid="list-delete-confirm-button"
          >
            {t('confirm')}
          </button>
          <button type="button" className={styles.secondary} onClick={() => setMode('view')} data-testid="list-delete-cancel">
            {t('cancel')}
          </button>
        </div>
      )}
      {children}
    </li>
  )
}
