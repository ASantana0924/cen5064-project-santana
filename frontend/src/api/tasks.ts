import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiRequest } from './client'
import type { CreateTaskInput, TaskDetails, TaskSummary } from './types'

export const taskKeys = {
  all: ['tasks'] as const,
  detail: (id: string) => ['tasks', id] as const,
}

export function listTasks(): Promise<TaskSummary[]> {
  return apiRequest<TaskSummary[]>('/api/tasks')
}

export function getTask(id: string): Promise<TaskDetails> {
  return apiRequest<TaskDetails>(`/api/tasks/${encodeURIComponent(id)}`)
}

export function createTask(input: CreateTaskInput): Promise<TaskDetails> {
  return apiRequest<TaskDetails>('/api/tasks', { method: 'POST', body: JSON.stringify(input) })
}

export function useTasks() {
  return useQuery({ queryKey: taskKeys.all, queryFn: listTasks })
}

export function useTask(id: string) {
  return useQuery({ queryKey: taskKeys.detail(id), queryFn: () => getTask(id) })
}

/** Creates a task, caches its details, and marks the task list as stale. */
export function useCreateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createTask,
    onSuccess: (task) => {
      queryClient.setQueryData(taskKeys.detail(task.id), task)
      return queryClient.invalidateQueries({ queryKey: taskKeys.all, exact: true })
    },
  })
}
