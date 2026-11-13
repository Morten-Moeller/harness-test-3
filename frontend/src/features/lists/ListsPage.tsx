import { type FormEvent, type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorKey } from './errorKey'
import { ListItem } from './ListItem'
import styles from './ListsPage.module.css'
import { type List, useCreateList, useLists } from './listsApi'

export function ListsPage({ renderList }: { renderList?: (list: List) => ReactNode }) {
  const { t } = useTranslation('lists')
  const lists = useLists()
  const createList = useCreateList()
  const [title, setTitle] = useState('')

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createList.mutate(title, { onSuccess: () => setTitle('') })
  }

  const errorText = createList.isError ? t(errorKey(createList.error)) : null

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
              <ListItem key={list.id} list={list}>
                {renderList?.(list)}
              </ListItem>
            ))}
          </ul>
        ))}
    </main>
  )
}
