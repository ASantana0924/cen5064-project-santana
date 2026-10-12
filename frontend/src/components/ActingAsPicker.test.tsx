import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { getDeveloper, getRecentDevelopers, setDeveloper } from '@/lib/developer'
import { ActingAsPicker } from './ActingAsPicker'

describe('ActingAsPicker', () => {
  it('asks for a name when none is saved', () => {
    render(<ActingAsPicker />)

    expect(screen.getByRole('button', { name: 'Choose a name' })).toBeInTheDocument()
  })

  it('saves a new name and shows it', async () => {
    render(<ActingAsPicker />)

    await userEvent.click(screen.getByRole('button', { name: 'Choose a name' }))
    await userEvent.type(screen.getByLabelText('Your name'), 'alex{Enter}')

    expect(screen.getByRole('button', { name: 'Acting as alex' })).toBeInTheDocument()
    expect(getDeveloper()).toBe('alex')
  })

  it('switches to a recent name', async () => {
    setDeveloper('alex')
    setDeveloper('dana')
    render(<ActingAsPicker />)

    await userEvent.click(screen.getByRole('button', { name: 'Acting as dana' }))
    await userEvent.click(screen.getByRole('button', { name: 'alex' }))

    expect(screen.getByRole('button', { name: 'Acting as alex' })).toBeInTheDocument()
    expect(getRecentDevelopers()).toEqual(['alex', 'dana'])
  })
})
