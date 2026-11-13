import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { type FormEvent, type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorKey } from './errorKey'
import { listDragType } from './ListsDnd'
import { type List, useDeleteList, useUpdateList } from './listsApi'
import styles from './ListsPage.module.css'

type Mode = 'view' | 'edit' | 'confirmDelete'

export function ListItem({ list, children }: { list: List; children?: ReactNode }) {
  const { t } = useTranslation('lists')
  const updateList = useUpdateList()
  const deleteList = useDeleteList()
  const [mode, setMode] = useState<Mode>('view')
  const [draft, setDraft] = useState(list.title)
  const draftInput = useRef<HTMLInputElement>(null)
  const confirmButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (mode === 'edit') {
      draftInput.current?.select()
    }
    if (mode === 'confirmDelete') {
      confirmButton.current?.focus()
    }
  }, [mode])

  const startEditing = () => {
    updateList.reset()
    setDraft(list.title)
    setMode('edit')
  }

  const cancel = () => {
    updateList.reset()
    setMode('view')
  }

  const onSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    updateList.mutate({ listId: list.id, title: draft }, { onSuccess: () => setMode('view') })
  }

  const onDraftKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
    }
  }

  const busy = updateList.isPending || deleteList.isPending
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: list.id,
    data: { type: listDragType, listId: list.id },
  })
  const sortableStyle = { transform: CSS.Translate.toString(transform), transition }
  const handle = (
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
  )

  return (
    <li
      ref={setNodeRef}
      style={sortableStyle}
      className={isDragging ? `${styles.item} ${styles.dragging}` : styles.item}
      data-testid="list-item"
    >
      {mode === 'edit' ? (
        <form className={styles.editForm} onSubmit={onSave} noValidate data-testid="list-edit-form">
          <input
            ref={draftInput}
            className={styles.input}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onDraftKeyDown}
            maxLength={200}
            aria-label={t('editTitle')}
            data-testid="list-edit-input"
          />
          <button type="submit" className={styles.button} disabled={busy} data-testid="list-save">
            {t('save')}
          </button>
          <button type="button" className={styles.secondary} onClick={cancel} data-testid="list-cancel">
            {t('cancel')}
          </button>
          {updateList.isError && (
            <p className={styles.error} role="alert" data-testid="list-error">
              {t(errorKey(updateList.error))}
            </p>
          )}
        </form>
      ) : (
        <div className={styles.itemHeader}>
          {handle}
          <h2 className={styles.itemTitle} data-testid="list-title">
            {list.title}
          </h2>
          <button type="button" className={styles.secondary} onClick={startEditing} disabled={busy} data-testid="list-rename">
            {t('rename')}
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => setMode('confirmDelete')}
            disabled={busy || mode === 'confirmDelete'}
            data-testid="list-delete"
          >
            {t('delete')}
          </button>
          {deleteList.isError && (
            <p className={styles.error} role="alert" data-testid="list-error">
              {t(errorKey(deleteList.error))}
            </p>
          )}
        </div>
      )}
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
