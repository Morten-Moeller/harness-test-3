import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorCodeOf } from '../../api/problem'
import { useCreateEntry, useEntries } from './entriesApi'
import { EntryItem } from './EntryItem'
import styles from './EntryList.module.css'

export function errorKey(error: unknown): 'errors.validationFailed' | 'errors.notFound' | 'errors.unknown' {
  switch (errorCodeOf(error)) {
    case 'VALIDATION_FAILED':
      return 'errors.validationFailed'
    case 'NOT_FOUND':
      return 'errors.notFound'
    default:
      return 'errors.unknown'
  }
}

export function EntryList({ listId }: { listId: string }) {
  const { t } = useTranslation('entries')
  const entries = useEntries()
  const createEntry = useCreateEntry()
  const [title, setTitle] = useState('')
  const inputId = `new-entry-${listId}`

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createEntry.mutate({ listId, title }, { onSuccess: () => setTitle('') })
  }

  const mine = entries.data?.filter((entry) => entry.listId === listId) ?? []

  return (
    <section className={styles.section} data-testid="entry-list">
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
        ) : (
          <ul className={styles.list} data-testid="entries">
            {mine.map((entry) => (
              <EntryItem key={entry.id} entry={entry} />
            ))}
          </ul>
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
