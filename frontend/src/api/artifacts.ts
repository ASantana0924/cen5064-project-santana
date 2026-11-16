import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiRequest } from './client'
import { taskKeys } from './tasks'
import type { Artifact, ArtifactSummary, RecordArtifactInput } from './types'

export const artifactKeys = {
  /**
   * The version list. It includes the task's artifact count, so the list is
   * fetched again whenever the task details show a different count, such as
   * after a version is recorded here or in another browser.
   */
  list: (taskId: string, artifactCount: number) => ['tasks', taskId, 'artifacts', artifactCount] as const,
  /** One version. A recorded version never changes, so it is cached for good once fetched. */
  version: (taskId: string, version: number) => ['tasks', taskId, 'artifact', version] as const,
}

function artifactsPath(taskId: string): string {
  return `/api/tasks/${encodeURIComponent(taskId)}/artifacts`
}

/** UC-09: every version, oldest first, without prompts or code. */
export function listArtifacts(taskId: string): Promise<ArtifactSummary[]> {
  return apiRequest<ArtifactSummary[]>(artifactsPath(taskId))
}

/** UC-09: one version in full. */
export function getArtifact(taskId: string, version: number): Promise<Artifact> {
  return apiRequest<Artifact>(`${artifactsPath(taskId)}/${version}`)
}

/** UC-07, UC-08: records the next version. A revision resets every check and clears every approval. */
export function recordArtifact(taskId: string, input: RecordArtifactInput): Promise<Artifact> {
  return apiRequest<Artifact>(artifactsPath(taskId), { method: 'POST', body: JSON.stringify(input) })
}

/** The version list of a task. Nothing is fetched while the task has no artifacts. */
export function useArtifacts(taskId: string, artifactCount: number) {
  return useQuery({
    queryKey: artifactKeys.list(taskId, artifactCount),
    queryFn: () => listArtifacts(taskId),
    enabled: artifactCount > 0,
    // Keeps showing the old list while the list with a new version loads, instead of flashing a loading state.
    placeholderData: keepPreviousData,
  })
}

export function useArtifact(taskId: string, version: number) {
  return useQuery({
    queryKey: artifactKeys.version(taskId, version),
    queryFn: () => getArtifact(taskId, version),
    staleTime: Infinity,
  })
}

/**
 * Records an artifact version. The answer is the artifact, not the task, so
 * the task details are fetched again to show the new count and the reset
 * checks. The mutation stays pending until they arrive, so the page never shows
 * the new version next to the old checks. It shares the task's mutation key, so
 * useTaskBusy disables the other task controls while it saves.
 */
export function useRecordArtifact(taskId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: taskKeys.detail(taskId),
    mutationFn: (input: RecordArtifactInput) => recordArtifact(taskId, input),
    onSuccess: (artifact) => {
      queryClient.setQueryData(artifactKeys.version(taskId, artifact.version), artifact)
      void queryClient.invalidateQueries({ queryKey: taskKeys.all, exact: true })
      return queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId), exact: true })
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId), exact: true })
    },
  })
}
