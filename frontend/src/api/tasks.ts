import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiRequest } from './client'
import type { CreateTaskInput, EditTaskInput, TaskDetails, TaskListName, TaskSummary } from './types'

export const taskKeys = {
  all: ['tasks'] as const,
  detail: (id: string) => ['tasks', id] as const,
}

const listPaths: Record<TaskListName, string> = {
  requirements: 'requirements',
  acceptanceCriteria: 'acceptance-criteria',
}

function taskPath(id: string): string {
  return `/api/tasks/${encodeURIComponent(id)}`
}

export function listTasks(): Promise<TaskSummary[]> {
  return apiRequest<TaskSummary[]>('/api/tasks')
}

export function getTask(id: string): Promise<TaskDetails> {
  return apiRequest<TaskDetails>(taskPath(id))
}

export function createTask(input: CreateTaskInput): Promise<TaskDetails> {
  return apiRequest<TaskDetails>('/api/tasks', { method: 'POST', body: JSON.stringify(input) })
}

/** UC-03: changes the title and description. */
export function editTask(id: string, input: EditTaskInput): Promise<TaskDetails> {
  return apiRequest<TaskDetails>(taskPath(id), { method: 'PATCH', body: JSON.stringify(input) })
}

/** UC-02, UC-03: adds a requirement or an acceptance criterion to the end of its list. */
export function addListItem(id: string, list: TaskListName, text: string, developer: string): Promise<TaskDetails> {
  return apiRequest<TaskDetails>(`${taskPath(id)}/${listPaths[list]}`, {
    method: 'POST',
    body: JSON.stringify({ text, developer }),
  })
}

/** UC-02, UC-03: removes the item at the 0-based index. A DELETE has no body, so the developer goes in the query. */
export function removeListItem(id: string, list: TaskListName, index: number, developer: string): Promise<TaskDetails> {
  const query = new URLSearchParams({ developer })
  return apiRequest<TaskDetails>(`${taskPath(id)}/${listPaths[list]}/${index}?${query}`, { method: 'DELETE' })
}

/** UC-04: moves a DRAFT task to IN_PROGRESS. */
export function startTask(id: string, developer: string): Promise<TaskDetails> {
  return apiRequest<TaskDetails>(`${taskPath(id)}/start`, { method: 'POST', body: JSON.stringify({ developer }) })
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

/**
 * A change to one task. Every task action answers with the updated task, so
 * the answer replaces the cached details and the page updates without a
 * reload. The task list shows check and approval counts, so it is marked stale
 * too. After an error the details are fetched again, because a refused change
 * often means the page was out of date.
 *
 * All actions on a task share one mutation key, so useTaskBusy can disable
 * every control while one runs. That matters for removals, which go by
 * position: a second removal sent before the first returns would use an old
 * position and remove the wrong item.
 */
function useTaskAction<TVariables>(id: string, action: (variables: TVariables) => Promise<TaskDetails>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: taskKeys.detail(id),
    mutationFn: action,
    onSuccess: (task) => {
      queryClient.setQueryData(taskKeys.detail(id), task)
      void queryClient.invalidateQueries({ queryKey: taskKeys.all, exact: true })
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) })
    },
  })
}

export function useEditTask(id: string) {
  return useTaskAction(id, (input: EditTaskInput) => editTask(id, input))
}

export function useAddListItem(id: string, list: TaskListName) {
  return useTaskAction(id, ({ text, developer }: { text: string; developer: string }) =>
    addListItem(id, list, text, developer),
  )
}

export function useRemoveListItem(id: string, list: TaskListName) {
  return useTaskAction(id, ({ index, developer }: { index: number; developer: string }) =>
    removeListItem(id, list, index, developer),
  )
}

export function useStartTask(id: string) {
  return useTaskAction(id, (developer: string) => startTask(id, developer))
}

/** True while any change to the task is being saved. */
export function useTaskBusy(id: string): boolean {
  return useIsMutating({ mutationKey: taskKeys.detail(id) }) > 0
}
