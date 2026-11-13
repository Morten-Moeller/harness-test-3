import createClient from 'openapi-fetch'
import { createContext, useContext } from 'react'

import type { paths } from './schema'

export type ApiClient = ReturnType<typeof createClient<paths>>

export function createApiClient(baseUrl: string): ApiClient {
  return createClient<paths>({ baseUrl })
}

export const ApiContext = createContext<ApiClient | null>(null)

export function useApi(): ApiClient {
  const client = useContext(ApiContext)
  if (!client) {
    throw new Error('ApiContext has no client')
  }
  return client
}
