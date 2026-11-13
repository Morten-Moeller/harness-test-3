import { createContext, createElement, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'

export const OPEN_ONLY_KEY = 'todo.openOnly'

export type OpenOnlyStorage = Pick<Storage, 'getItem' | 'setItem'>

export function readOpenOnly(storage: () => OpenOnlyStorage): boolean {
  try {
    return storage().getItem(OPEN_ONLY_KEY) === 'true'
  } catch {
    return false
  }
}

export function writeOpenOnly(storage: () => OpenOnlyStorage, value: boolean): void {
  try {
    storage().setItem(OPEN_ONLY_KEY, String(value))
  } catch {
    return
  }
}

type OpenOnlyState = { openOnly: boolean; setOpenOnly: (value: boolean) => void }

const OpenOnlyContext = createContext<OpenOnlyState | undefined>(undefined)

const browserStorage = (): OpenOnlyStorage => window.localStorage

export function OpenOnlyProvider({ children }: { children: ReactNode }) {
  const [openOnly, setState] = useState(() => readOpenOnly(browserStorage))
  const setOpenOnly = useCallback((value: boolean) => {
    setState(value)
    writeOpenOnly(browserStorage, value)
  }, [])
  const value = useMemo(() => ({ openOnly, setOpenOnly }), [openOnly, setOpenOnly])
  return createElement(OpenOnlyContext.Provider, { value }, children)
}

export function useOpenOnly(): OpenOnlyState {
  const state = useContext(OpenOnlyContext)
  if (state === undefined) {
    throw new Error('useOpenOnly needs an OpenOnlyProvider')
  }
  return state
}
