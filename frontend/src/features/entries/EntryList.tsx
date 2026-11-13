import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { listDroppableId, useDragPreview } from './EntriesDndProvider'
import { useCreateEntry, useEntries } from './entriesApi'
import { errorKey } from './errorKey'
import { EntryItem } from './EntryItem'
import styles from './EntryList.module.css'
import { useOpenOnly } from './openOnly'

export function EntryList({ listId }: { listId: string }) {
  const { t } = useTranslation('entries')
  const entries = useEntries()
  const createEntry = useCreateEntry()
  const { openOnly } = useOpenOnly()
  const preview = useDragPreview()
  const [title, setTitle] = useState('')
  const inputId = `new-entry-${listId}`
  const { setNodeRef, isOver } = useDroppable({ id: listDroppableId(listId), data: { type: 'list', listId } })

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createEntry.mutate({ listId, title }, { onSuccess: () => setTitle('') })
  }

  const mine = (preview ?? entries.data)?.filter((entry) => entry.listId === listId) ?? []
  const visible = openOnly ? mine.filter((entry) => !entry.done) : mine

  return (
    <section ref={setNodeRef} className={isOver ? `${styles.section} ${styles.over}` : styles.section} data-testid="entry-list">
      {entries.isPending && <p className={styles.note}>{t('loading')}</p>}
      {entries.isError && (
        <p className={styles.error} role="alert" data-testid="entries-error">
          {t('errors.unknown')}
        </p>
      )}
      {entries.data !== undefined &&
        (mine.length === 0 ? (
          <p className={styles.note} data-testid="entries-empty">
            {t('empty')}
          </p>
        ) : visible.length === 0 ? (
          <p className={styles.note} data-testid="entries-empty-open">
            {t('emptyOpen')}
          </p>
        ) : (
          <SortableContext items={visible.map((entry) => entry.id)} strategy={verticalListSortingStrategy}>
            <ul className={styles.list} data-testid="entries">
              {visible.map((entry) => (
                <EntryItem key={entry.id} entry={entry} />
              ))}
            </ul>
          </SortableContext>
        ))}
      <form className={styles.form} onSubmit={onSubmit} data-testid="entry-form" noValidate>
        <label className={styles.label} htmlFor={inputId}>
          {t('form.titleLabel')}
        </label>
        <div className={styles.row}>
          <input
            id={inputId}
            className={styles.input}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            data-testid="new-entry-input"
          />
          <button type="submit" className={styles.button} disabled={createEntry.isPending} data-testid="new-entry-submit">
            {t('form.submit')}
          </button>
        </div>
        {createEntry.isError && (
          <p className={styles.error} role="alert" data-testid="entry-form-error">
            {t(errorKey(createEntry.error))}
          </p>
        )}
      </form>
    </section>
  )
}
