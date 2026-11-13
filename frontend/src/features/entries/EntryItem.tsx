import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTranslation } from 'react-i18next'

import { IconButton } from '../../ui/IconButton'
import { InlineTitle } from '../../ui/InlineTitle'
import { TrashIcon } from '../../ui/TrashIcon'
import { type Entry, useDeleteEntry, useUpdateEntry } from './entriesApi'
import { errorKey } from './errorKey'
import styles from './EntryList.module.css'

export function EntryItem({ entry }: { entry: Entry }) {
  const { t } = useTranslation('entries')
  const updateEntry = useUpdateEntry()
  const deleteEntry = useDeleteEntry()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
    data: { type: 'entry', listId: entry.listId },
  })
  const sortableStyle = { transform: CSS.Transform.toString(transform), transition }

  const busy = updateEntry.isPending || deleteEntry.isPending
  const editError = updateEntry.isError && updateEntry.variables?.title !== undefined ? t(errorKey(updateEntry.error)) : null
  const rowError =
    deleteEntry.isError || (updateEntry.isError && updateEntry.variables?.title === undefined)
      ? t(errorKey(deleteEntry.isError ? deleteEntry.error : updateEntry.error))
      : null

  const classes = [styles.item, entry.done ? styles.done : '', isDragging ? styles.dragging : ''].filter(Boolean).join(' ')

  return (
    <li ref={setNodeRef} style={sortableStyle} className={classes} data-testid="entry-item">
      <button
        type="button"
        ref={setActivatorNodeRef}
        className={styles.handle}
        aria-label={t('handle')}
        disabled={busy}
        data-testid="entry-handle"
        {...attributes}
        {...listeners}
      />
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={entry.done}
        disabled={busy}
        aria-label={entry.title}
        onChange={(event) => updateEntry.mutate({ entryId: entry.id, done: event.target.checked })}
        data-testid="entry-done"
      />
      <InlineTitle
        title={entry.title}
        titleClassName={styles.title}
        editName={t('editEntry', { title: entry.title })}
        inputName={t('editTitle')}
        busy={busy}
        error={editError}
        testIds={{ title: 'entry-title', input: 'entry-title-input', editor: 'entry-edit-form', error: 'entry-edit-error' }}
        onOpen={() => updateEntry.reset()}
        onSave={(draft, close) => updateEntry.mutate({ entryId: entry.id, title: draft }, { onSuccess: close })}
        actions={() => (
          <IconButton
            label={t('deleteEntry')}
            icon={<TrashIcon />}
            disabled={deleteEntry.isPending}
            onPress={() => deleteEntry.mutate(entry.id)}
            testId="entry-delete"
          />
        )}
      />
      {rowError !== null && (
        <p className={styles.error} role="alert" data-testid="entry-error">
          {rowError}
        </p>
      )}
    </li>
  )
}
