import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { type Entry, useDeleteEntry, useUpdateEntry } from './entriesApi'
import { errorKey } from './errorKey'
import styles from './EntryList.module.css'

export function EntryItem({ entry }: { entry: Entry }) {
  const { t } = useTranslation('entries')
  const updateEntry = useUpdateEntry()
  const deleteEntry = useDeleteEntry()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.title)

  const startEditing = () => {
    setDraft(entry.title)
    setEditing(true)
  }

  const onSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    updateEntry.mutate({ entryId: entry.id, title: draft }, { onSuccess: () => setEditing(false) })
  }

  const busy = updateEntry.isPending || deleteEntry.isPending

  return (
    <li className={entry.done ? `${styles.item} ${styles.done}` : styles.item} data-testid="entry-item">
      {editing ? (
        <form className={styles.editForm} onSubmit={onSave} noValidate data-testid="entry-edit-form">
          <input
            className={styles.input}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={200}
            aria-label={t('editTitle')}
            data-testid="entry-title-input"
          />
          <button type="submit" className={styles.button} disabled={busy} data-testid="entry-save">
            {t('save')}
          </button>
          <button type="button" className={styles.secondary} onClick={() => setEditing(false)} data-testid="entry-cancel">
            {t('cancel')}
          </button>
          {updateEntry.isError && (
            <p className={styles.error} role="alert" data-testid="entry-error">
              {t(errorKey(updateEntry.error))}
            </p>
          )}
        </form>
      ) : (
        <>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={entry.done}
              disabled={busy}
              onChange={(event) => updateEntry.mutate({ entryId: entry.id, done: event.target.checked })}
              data-testid="entry-done"
            />
            <span className={styles.title} data-testid="entry-title">
              {entry.title}
            </span>
          </label>
          <button type="button" className={styles.secondary} onClick={startEditing} disabled={busy} data-testid="entry-edit">
            {t('edit')}
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => deleteEntry.mutate(entry.id)}
            disabled={busy}
            data-testid="entry-delete"
          >
            {t('delete')}
          </button>
          {(updateEntry.isError || deleteEntry.isError) && (
            <p className={styles.error} role="alert" data-testid="entry-error">
              {t(errorKey(updateEntry.isError ? updateEntry.error : deleteEntry.error))}
            </p>
          )}
        </>
      )}
    </li>
  )
}
