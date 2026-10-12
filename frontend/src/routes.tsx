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
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
