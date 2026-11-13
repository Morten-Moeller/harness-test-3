import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { I18nextProvider } from 'react-i18next'

import { ApiContext, createApiClient } from '../api/client'
import { EntryList } from '../features/entries/EntryList'
import { OpenOnlyProvider } from '../features/entries/openOnly'
import { OpenOnlyToggle } from '../features/entries/OpenOnlyToggle'
import { ListsPage } from '../features/lists/ListsPage'
import type { AppConfig } from './config'
import { createI18n } from './i18n'
import { createQueryClient } from './queryClient'

export function App({ config }: { config: AppConfig }) {
  const [queryClient] = useState(createQueryClient)
  const [i18n] = useState(createI18n)
  const [api] = useState(() => createApiClient(config.apiBaseUrl))
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ApiContext.Provider value={api}>
          <OpenOnlyProvider>
            <OpenOnlyToggle />
            <ListsPage renderList={(list) => <EntryList listId={list.id} />} />
          </OpenOnlyProvider>
        </ApiContext.Provider>
      </QueryClientProvider>
    </I18nextProvider>
  )
}
