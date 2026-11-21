import type { RouteObject } from 'react-router'

import { AppLayout } from '@/components/AppLayout'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { TaskDetailsPage } from '@/pages/TaskDetailsPage'
import { TaskListPage } from '@/pages/TaskListPage'

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    // Shown only for the moment it takes to load a lazy page on first visit, such as opening /tasks/new directly.
    HydrateFallback: () => null,
    children: [
      { path: '/', element: <TaskListPage /> },
      {
        path: '/tasks/new',
        // Loaded on demand so the form libraries (Zod, React Hook Form) stay out of the first download.
        lazy: async () => ({ Component: (await import('@/pages/CreateTaskPage')).CreateTaskPage }),
      },
      { path: '/tasks/:id', element: <TaskDetailsPage /> },
      {
        // A static segment outranks :version below, so this never reads "compare" as a version number.
        path: '/tasks/:id/artifacts/compare',
        // Loaded on demand so the diff library stays out of the first download.
        lazy: async () => ({ Component: (await import('@/pages/ArtifactComparePage')).ArtifactComparePage }),
      },
      {
        path: '/tasks/:id/artifacts/:version',
        lazy: async () => ({ Component: (await import('@/pages/ArtifactVersionPage')).ArtifactVersionPage }),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
