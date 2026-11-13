import type { ReactNode } from 'react'

import styles from './InlineTitle.module.css'

type Props = {
  label: string
  icon: ReactNode
  disabled?: boolean
  onPress: () => void
  testId: string
}

export function IconButton({ label, icon, disabled, onPress, testId }: Props) {
  return (
    <button
      type="button"
      className={styles.iconButton}
      title={label}
      aria-label={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPress}
      data-testid={testId}
    >
      {icon}
    </button>
  )
}
