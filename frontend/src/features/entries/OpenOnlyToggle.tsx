import { useTranslation } from 'react-i18next'

import styles from './EntryList.module.css'
import { useOpenOnly } from './openOnly'

export function OpenOnlyToggle() {
  const { t } = useTranslation('entries')
  const { openOnly, setOpenOnly } = useOpenOnly()
  return (
    <div className={styles.toggleBar}>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={openOnly}
          onChange={(event) => setOpenOnly(event.target.checked)}
          data-testid="open-only"
        />
        {t('openOnly')}
      </label>
    </div>
  )
}
