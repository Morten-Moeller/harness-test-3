import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorCodeOf } from '../../api/problem'
import styles from './ListsPage.module.css'
import { useCreateList, useLists } from './listsApi'

export function ListsPage() {
  const { t } = useTranslation('lists')
  const lists = useLists()
  const createList = useCreateList()
  const [title, setTitle] = useState('')

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createList.mutate(title, { onSuccess: () => setTitle('') })
  }

  const errorText = (() => {
    if (!createList.isError) {
      return null
    }
    switch (errorCodeOf(createList.error)) {
      case 'VALIDATION_FAILED':
        return t('errors.validationFailed')
      case 'NOT_FOUND':
        return t('errors.notFound')
      default:
        return t('errors.unknown')
    }
  })()

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>{t('title')}</h1>
      <form className={styles.form} onSubmit={onSubmit} data-testid="list-form" noValidate>
        <label className={styles.label} htmlFor="list-title">
          {t('form.titleLabel')}
        </label>
        <div className={styles.row}>
          <input
            id="list-title"
            className={styles.input}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            data-testid="list-title-input"
          />
          <button type="submit" className={styles.button} disabled={createList.isPending} data-testid="list-submit">
            {t('form.submit')}
          </button>
        </div>
        {errorText !== null && (
          <p className={styles.error} role="alert" data-testid="form-error">
            {errorText}
          </p>
        )}
      </form>
      {lists.isPending && <p className={styles.note}>{t('loading')}</p>}
      {lists.isError && (
        <p className={styles.error} role="alert" data-testid="lists-error">
          {t('errors.unknown')}
        </p>
      )}
      {lists.data !== undefined &&
        (lists.data.length === 0 ? (
          <p className={styles.note} data-testid="lists-empty">
            {t('empty')}
          </p>
        ) : (
          <ul className={styles.list} data-testid="lists">
            {lists.data.map((list) => (
              <li key={list.id} className={styles.item} data-testid="list-item">
                {list.title}
              </li>
            ))}
          </ul>
        ))}
    </main>
  )
}
