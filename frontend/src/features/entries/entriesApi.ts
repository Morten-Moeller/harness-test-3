import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useApi } from '../../api/client'
import { ApiError, parseProblem } from '../../api/problem'
import type { components } from '../../api/schema'
import { applyOrder, type EntryOrder } from './order'

export type Entry = components['schemas']['Entry']

export const entriesKey = ['entries'] as const

export function useEntries() {
  const api = useApi()
  return useQuery({
    queryKey: entriesKey,
    queryFn: async (): Promise<Entry[]> => {
      const { data, error, response } = await api.GET('/api/entries')
      if (error !== undefined || data === undefined) {
        throw new ApiError(parseProblem(error), response.status)
      }
      return data.items
    },
  })
}

function useInvalidateEntries() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: entriesKey })
}

export function useCreateEntry() {
  const api = useApi()
  const invalidate = useInvalidateEntries()
  return useMutation({
    mutationFn: async ({ listId, title }: { listId: string; title: string }) => {
      const { data, error, response } = await api.POST('/api/lists/{listId}/entries', {
        params: { path: { listId } },
        body: { title },
      })
      if (error !== undefined || data === undefined) {
        throw new ApiError(parseProblem(error), response.status)
      }
      return data
    },
    onSuccess: invalidate,
  })
}

export function useUpdateEntry() {
  const api = useApi()
  const invalidate = useInvalidateEntries()
  return useMutation({
    mutationFn: async ({ entryId, title, done }: { entryId: string; title?: string; done?: boolean }) => {
      const { error, response } = await api.PATCH('/api/entries/{entryId}', {
        params: { path: { entryId } },
        body: { ...(title !== undefined ? { title } : {}), ...(done !== undefined ? { done } : {}) },
      })
      if (error !== undefined || !response.ok) {
        throw new ApiError(parseProblem(error), response.status)
      }
    },
    onSuccess: invalidate,
  })
}

export function useDeleteEntry() {
  const api = useApi()
  const invalidate = useInvalidateEntries()
  return useMutation({
    mutationFn: async (entryId: string) => {
      const { error, response } = await api.DELETE('/api/entries/{entryId}', { params: { path: { entryId } } })
      if (error !== undefined || !response.ok) {
        throw new ApiError(parseProblem(error), response.status)
      }
    },
    onSuccess: invalidate,
  })
}

export type ReorderVariables = EntryOrder & { previous: Entry[] }

export function useReorderEntries() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ listId, entryIds }: ReorderVariables) => {
      const { error, response } = await api.PUT('/api/lists/{listId}/entries/order', {
        params: { path: { listId } },
        body: { entryIds },
      })
      if (error !== undefined || !response.ok) {
        throw new ApiError(parseProblem(error), response.status)
      }
    },
    onMutate: async ({ listId, entryIds, previous }) => {
      queryClient.setQueryData<Entry[]>(entriesKey, applyOrder(previous, { listId, entryIds }))
      await queryClient.cancelQueries({ queryKey: entriesKey })
    },
    onError: (_error, { previous }) => {
      queryClient.setQueryData(entriesKey, previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: entriesKey }),
  })
}
