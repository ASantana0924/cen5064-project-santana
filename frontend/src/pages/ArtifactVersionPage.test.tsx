import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiRequest } from '@/api/client'
import { artifact, artifactSummary, details } from '@/test/fixtures'
import { renderApp } from '@/test/renderApp'
import { routeApi } from '@/test/routeApi'

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  apiRequest: vi.fn(),
}))

const api = vi.mocked(apiRequest)
const taskId = '11111111-1111-1111-1111-111111111111'
const taskUrl = `/api/tasks/${taskId}`

const longLine = `String message = "${'x'.repeat(300)}";`
const version1 = artifact({ version: 1, prompt: 'Lock the account after 5 failed logins.', aiTool: 'Claude' })
const version2 = artifact({
  version: 2,
  prompt: 'Also reset the count\nafter a successful login.',
  aiTool: 'GitHub Copilot',
  recordedBy: 'sam',
  codeContent: `void reset() {\n  failures = 0;\n  ${longLine}\n}`,
})

beforeEach(() => {
  api.mockReset()
})

describe('ArtifactVersionPage', () => {
  it('shows a loading state while the version loads', () => {
    api.mockReturnValue(new Promise(() => {}))

    renderApp(`/tasks/${taskId}/artifacts/2`)

    return expect(screen.findByRole('status', { name: 'Loading version' })).resolves.toBeInTheDocument()
  })

  it('shows the version, its prompt, and its code', async () => {
    routeApi(api, { [`GET ${taskUrl}/artifacts/2`]: version2 })

    renderApp(`/tasks/${taskId}/artifacts/2`)

    expect(await screen.findByRole('heading', { level: 1, name: 'Version 2' })).toBeInTheDocument()
    expect(screen.getByText('AI tool').nextElementSibling).toHaveTextContent('GitHub Copilot')
    expect(screen.getByText('Recorded by').nextElementSibling).toHaveTextContent('sam')
    expect(screen.getByText(/Also reset the count/)).toHaveTextContent('Also reset the count after a successful login.')

    const code = screen.getByRole('region', { name: 'Code' }).querySelector('code')
    expect(code?.textContent).toBe(version2.codeContent)
  })

  it('scrolls long code lines inside their block instead of wrapping', async () => {
    routeApi(api, { [`GET ${taskUrl}/artifacts/2`]: version2 })

    renderApp(`/tasks/${taskId}/artifacts/2`)

    const block = await screen.findByRole('region', { name: 'Code' })
    expect(block.tagName).toBe('PRE')
    expect(block).toHaveClass('overflow-x-auto', 'whitespace-pre', 'max-w-full', 'font-mono')
    // Focusable, so keyboard users can scroll it.
    expect(block).toHaveAttribute('tabindex', '0')
  })

  it('links back to the task', async () => {
    routeApi(api, { [`GET ${taskUrl}/artifacts/1`]: version1 })

    renderApp(`/tasks/${taskId}/artifacts/1`)

    await screen.findByRole('heading', { level: 1, name: 'Version 1' })
    expect(screen.getByRole('link', { name: 'Back to task' })).toHaveAttribute('href', `/tasks/${taskId}`)
  })

  it('shows "Version not found" for a version the task does not have', async () => {
    routeApi(api, {
      [`GET ${taskUrl}/artifacts/9`]: new ApiError(404, `Task ${taskId} has no artifact version 9`),
    })

    renderApp(`/tasks/${taskId}/artifacts/9`)

    expect(await screen.findByText('Version not found')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Back to task' }).length).toBeGreaterThan(0)
  })

  it('shows "Version not found" without asking the server when the version is not a number', async () => {
    renderApp(`/tasks/${taskId}/artifacts/latest`)

    expect(await screen.findByText('Version not found')).toBeInTheDocument()
    expect(api).not.toHaveBeenCalled()
  })

  it('shows the server message for other errors', async () => {
    routeApi(api, { [`GET ${taskUrl}/artifacts/1`]: new ApiError(500, 'Unexpected server error') })

    renderApp(`/tasks/${taskId}/artifacts/1`)

    expect(await screen.findByText('Could not load the version')).toBeInTheDocument()
    expect(screen.getByText('Unexpected server error')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('opens any past version from the task page history', async () => {
    routeApi(api, {
      [`GET ${taskUrl}`]: details({ status: 'IN_PROGRESS', artifactCount: 2 }),
      [`GET ${taskUrl}/artifacts`]: [artifactSummary(version1), artifactSummary(version2)],
      [`GET ${taskUrl}/artifacts/1`]: version1,
    })
    const { router } = renderApp(`/tasks/${taskId}`)

    const history = await screen.findByRole('list', { name: 'Version history' })
    await userEvent.click(within(history).getByRole('link', { name: /Version 1/ }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Version 1' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/tasks/${taskId}/artifacts/1`)
    expect(screen.getByText('Lock the account after 5 failed logins.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Code' })).toHaveTextContent('boolean isLocked(int failures)')
  })
})
