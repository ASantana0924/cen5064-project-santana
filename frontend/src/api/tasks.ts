import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiRequest } from './client'
import type { CreateTaskInput, EditTaskInput, TaskDetails, TaskListName, TaskSummary } from './types'

export const taskKeys = {
  all: ['tasks'] as const,
  detail: (id: string) => ['tasks', id] as const,
  /** The audit history. Every change adds an entry, so every task action marks it stale. */
  audit: (id: string) => ['tasks', id, 'audit'] as const,
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

/** UC-02, UC-03: removes the item with the given id. A DELETE has no body, so the developer goes in the query. */
export function removeListItem(id: string, list: TaskListName, itemId: string, developer: string): Promise<TaskDetails> {
  const query = new URLSearchParams({ developer })
  return apiRequest<TaskDetails>(`${taskPath(id)}/${listPaths[list]}/${encodeURIComponent(itemId)}?${query}`, {
    method: 'DELETE',
  })
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
 * too, and so is the audit history, since every change adds an entry. After an
 * error the details are fetched again, because a refused change often means
 * the page was out of date.
 *
 * All actions on a task share one mutation key, so useTaskBusy can disable
 * every control while one runs. Changes are then sent one at a time, each
 * from the task the previous one returned.
 */
export function useTaskAction<TVariables>(id: string, action: (variables: TVariables) => Promise<TaskDetails>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: taskKeys.detail(id),
    mutationFn: action,
    onSuccess: (task) => {
      queryClient.setQueryData(taskKeys.detail(id), task)
      void queryClient.invalidateQueries({ queryKey: taskKeys.all, exact: true })
      void queryClient.invalidateQueries({ queryKey: taskKeys.audit(id) })
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) })
    },
  })
}

/**
 * A change to one task whose answer is a record, such as an artifact or a
 * reviewed check, instead of the task. The task details are fetched again to
 * show the change and its effects, such as reset checks or cleared approvals,
 * and the mutation stays pending until they arrive, so the page never shows
 * the new record next to the old task. onRecorded runs first, with the record.
 * It shares the task's mutation key, so useTaskBusy disables the other task
 * controls while it saves.
 */
export function useTaskRecordAction<TVariables, TRecord>(
  id: string,
  action: (variables: TVariables) => Promise<TRecord>,
  onRecorded?: (record: TRecord) => void,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: taskKeys.detail(id),
    mutationFn: action,
    onSuccess: (record) => {
      onRecorded?.(record)
      void queryClient.invalidateQueries({ queryKey: taskKeys.all, exact: true })
      void queryClient.invalidateQueries({ queryKey: taskKeys.audit(id) })
      return queryClient.invalidateQueries({ queryKey: taskKeys.detail(id), exact: true })
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(id), exact: true })
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
  return useTaskAction(id, ({ itemId, developer }: { itemId: string; developer: string }) =>
    removeListItem(id, list, itemId, developer),
  )
}

export function useStartTask(id: string) {
  return useTaskAction(id, (developer: string) => startTask(id, developer))
}

/** True while any change to the task is being saved. */
export function useTaskBusy(id: string): boolean {
  return useIsMutating({ mutationKey: taskKeys.detail(id) }) > 0
}
