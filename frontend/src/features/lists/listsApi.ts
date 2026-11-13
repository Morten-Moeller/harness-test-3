import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useApi } from '../../api/client'
import { ApiError, parseProblem } from '../../api/problem'
import type { components } from '../../api/schema'
import { applyListOrder } from './order'

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

export type ListReorderVariables = { listIds: string[]; previous: List[] }

export function useReorderLists() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ listIds }: ListReorderVariables) => {
      const { error, response } = await api.PUT('/api/lists/order', { body: { listIds } })
      if (error !== undefined || !response.ok) {
        throw new ApiError(parseProblem(error), response.status)
      }
    },
    onMutate: async ({ listIds, previous }) => {
      queryClient.setQueryData<List[]>(listsKey, applyListOrder(previous, listIds))
      await queryClient.cancelQueries({ queryKey: listsKey })
    },
    onError: (_error, { previous }) => {
      queryClient.setQueryData(listsKey, previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: listsKey }),
  })
}
