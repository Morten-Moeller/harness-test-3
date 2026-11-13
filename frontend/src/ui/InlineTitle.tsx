import { type FocusEvent, type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react'

import styles from './InlineTitle.module.css'

export const inlineTitleStyles = styles

type Props = {
  title: string
  titleClassName?: string
  editName: string
  inputName: string
  busy: boolean
  error: string | null
  testIds: { title: string; input: string; editor: string; error: string }
  onOpen?: () => void
  onSave: (draft: string, close: () => void) => void
  actions?: (close: () => void) => ReactNode
}

export function InlineTitle({ title, titleClassName, editName, inputName, busy, error, testIds, onOpen, onSave, actions }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const input = useRef<HTMLInputElement>(null)
  const titleElement = useRef<HTMLSpanElement>(null)
  const wasEditing = useRef(false)

  useEffect(() => {
    if (editing) {
      input.current?.select()
    } else if (wasEditing.current) {
      titleElement.current?.focus()
    }
    wasEditing.current = editing
  }, [editing])

  const open = () => {
    onOpen?.()
    setDraft(title)
    setEditing(true)
  }

  const close = () => setEditing(false)

  const save = () => {
    if (busy) {
      return
    }
    if (draft === title) {
      close()
      return
    }
    onSave(draft, close)
  }

  const onTitleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      open()
    }
  }

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      save()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  }

  const onEditorBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      save()
    }
  }

  if (!editing) {
    return (
      <span
        ref={titleElement}
        role="button"
        tabIndex={0}
        className={[styles.title, titleClassName].filter(Boolean).join(' ')}
        aria-label={editName}
        onDoubleClick={open}
        onKeyDown={onTitleKeyDown}
        data-testid={testIds.title}
      >
        {title}
      </span>
    )
  }

  return (
    <div className={styles.editor} onBlur={onEditorBlur} data-testid={testIds.editor}>
      <input
        ref={input}
        className={styles.input}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onInputKeyDown}
        maxLength={200}
        aria-label={inputName}
        aria-invalid={error !== null}
        data-testid={testIds.input}
      />
      {actions?.(close)}
      {error !== null && (
        <p className={styles.error} role="alert" data-testid={testIds.error}>
          {error}
        </p>
      )}
    </div>
  )
}
