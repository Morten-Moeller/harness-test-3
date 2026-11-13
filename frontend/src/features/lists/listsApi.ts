import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useApi } from '../../api/client'
import { ApiError, parseProblem } from '../../api/problem'
import type { components } from '../../api/schema'

export type List = components['schemas']['List']

export const listsKey = ['lists'] as const

export function useLists() {
  const api = useApi()
  return useQuery({
    queryKey: listsKey,
    queryFn: async (): Promise<List[]> => {
      const { data, error, response } = await api.GET('/api/lists')
      if (error !== undefined || data === undefined) {
        throw new ApiError(parseProblem(error), response.status)
      }
      return data.items
    },
  })
}

export function useCreateList() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (title: string) => {
      const { data, error, response } = await api.POST('/api/lists', { body: { title } })
      if (error !== undefined || data === undefined) {
        throw new ApiError(parseProblem(error), response.status)
      }
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listsKey }),
  })
}

export function useUpdateList() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ listId, title }: { listId: string; title: string }) => {
      const { error, response } = await api.PATCH('/api/lists/{listId}', {
        params: { path: { listId } },
        body: { title },
      })
      if (error !== undefined || !response.ok) {
        throw new ApiError(parseProblem(error), response.status)
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listsKey }),
  })
}

export function useDeleteList() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (listId: string) => {
      const { error, response } = await api.DELETE('/api/lists/{listId}', { params: { path: { listId } } })
      if (error !== undefined || !response.ok) {
        throw new ApiError(parseProblem(error), response.status)
      }
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
