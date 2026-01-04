/**
 * ActivitySelector Component Tests
 * 
 * Tests for the activity selector component used in the sign-in system.
 * Covers activity selection, custom activity creation, and UI states.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../test/utils/test-utils'
import { ActivitySelector } from './ActivitySelector'
import { mockActivities, mockActiveActivity } from '../test/mocks/api'

describe('ActivitySelector', () => {
  const mockOnSelectActivity = vi.fn()
  const mockOnCreateActivity = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the current activity', () => {
    render(
      <ActivitySelector
        activities={mockActivities}
        activeActivity={mockActiveActivity}
        onSelectActivity={mockOnSelectActivity}
        onCreateActivity={mockOnCreateActivity}
      />
    )

    expect(screen.getByText('Current Activity')).toBeInTheDocument()
    // Use getAllByText since "Training" appears both in current activity and in the list
    const trainingElements = screen.getAllByText('Training')
    expect(trainingElements.length).toBeGreaterThan(0)
  })

  it('shows "No Activity Selected" when no active activity', () => {
    render(
      <ActivitySelector
        activities={mockActivities}
        activeActivity={null}
        onSelectActivity={mockOnSelectActivity}
        onCreateActivity={mockOnCreateActivity}
      />
    )

    expect(screen.getByText('No Activity Selected')).toBeInTheDocument()
  })

  it('displays all available activities', () => {
    render(
      <ActivitySelector
        activities={mockActivities}
        activeActivity={mockActiveActivity}
        onSelectActivity={mockOnSelectActivity}
        onCreateActivity={mockOnCreateActivity}
      />
    )

    expect(screen.getByText('Select Activity')).toBeInTheDocument()
    mockActivities.forEach(activity => {
      expect(screen.getByRole('button', { name: new RegExp(activity.name, 'i') })).toBeInTheDocument()
    })
  })

  it('calls onSelectActivity when an activity is clicked', async () => {
    const user = userEvent.setup()
    
    render(
      <ActivitySelector
        activities={mockActivities}
        activeActivity={mockActiveActivity}
        onSelectActivity={mockOnSelectActivity}
        onCreateActivity={mockOnCreateActivity}
      />
    )

    const maintenanceButton = screen.getByRole('button', { name: /maintenance/i })
    await user.click(maintenanceButton)

    expect(mockOnSelectActivity).toHaveBeenCalledWith('activity-2')
  })

  it('highlights the active activity', () => {
    render(
      <ActivitySelector
        activities={mockActivities}
        activeActivity={mockActiveActivity}
        onSelectActivity={mockOnSelectActivity}
        onCreateActivity={mockOnCreateActivity}
      />
    )

    const trainingButton = screen.getByRole('button', { name: /training/i })
    expect(trainingButton).toHaveClass('active')
  })

  it('shows custom activity form when "Add Custom Activity" is clicked', async () => {
    const user = userEvent.setup()
    
    render(
      <ActivitySelector
        activities={mockActivities}
        activeActivity={mockActiveActivity}
        onSelectActivity={mockOnSelectActivity}
        onCreateActivity={mockOnCreateActivity}
      />
    )

    const addButton = screen.getByRole('button', { name: /add custom activity/i })
    await user.click(addButton)

    expect(screen.getByPlaceholderText('Activity name...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('creates a custom activity when form is submitted', async () => {
    const user = userEvent.setup()
    
    render(
      <ActivitySelector
        activities={mockActivities}
        activeActivity={mockActiveActivity}
        onSelectActivity={mockOnSelectActivity}
        onCreateActivity={mockOnCreateActivity}
      />
    )

    // Open the form
    const addButton = screen.getByRole('button', { name: /add custom activity/i })
    await user.click(addButton)

    // Fill in the activity name
    const input = screen.getByPlaceholderText('Activity name...')
    await user.type(input, 'Fire Safety Demo')

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /^add$/i })
    await user.click(submitButton)

    expect(mockOnCreateActivity).toHaveBeenCalledWith('Fire Safety Demo')
  })

  it('creates a custom activity when Enter key is pressed', async () => {
    const user = userEvent.setup()
    
    render(
      <ActivitySelector
        activities={mockActivities}
        activeActivity={mockActiveActivity}
        onSelectActivity={mockOnSelectActivity}
        onCreateActivity={mockOnCreateActivity}
      />
    )

    // Open the form
    const addButton = screen.getByRole('button', { name: /add custom activity/i })
    await user.click(addButton)

    // Fill in the activity name and press Enter
    const input = screen.getByPlaceholderText('Activity name...')
    await user.type(input, 'Community Event{Enter}')

    expect(mockOnCreateActivity).toHaveBeenCalledWith('Community Event')
  })

  it('cancels custom activity creation', async () => {
    const user = userEvent.setup()
    
    render(
      <ActivitySelector
        activities={mockActivities}
        activeActivity={mockActiveActivity}
        onSelectActivity={mockOnSelectActivity}
        onCreateActivity={mockOnCreateActivity}
      />
    )

    // Open the form
    const addButton = screen.getByRole('button', { name: /add custom activity/i })
    await user.click(addButton)

    // Fill in some text
    const input = screen.getByPlaceholderText('Activity name...')
    await user.type(input, 'Test Activity')

    // Cancel
    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    // Form should be hidden, input should not exist
    expect(screen.queryByPlaceholderText('Activity name...')).not.toBeInTheDocument()
    expect(mockOnCreateActivity).not.toHaveBeenCalled()

    // Add button should be visible again
    expect(screen.getByRole('button', { name: /add custom activity/i })).toBeInTheDocument()
  })

  it('does not create activity with empty name', async () => {
    const user = userEvent.setup()
    
    render(
      <ActivitySelector
        activities={mockActivities}
        activeActivity={mockActiveActivity}
        onSelectActivity={mockOnSelectActivity}
        onCreateActivity={mockOnCreateActivity}
      />
    )

    // Open the form
    const addButton = screen.getByRole('button', { name: /add custom activity/i })
    await user.click(addButton)

    // Try to submit without entering a name
    const submitButton = screen.getByRole('button', { name: /^add$/i })
    await user.click(submitButton)

    expect(mockOnCreateActivity).not.toHaveBeenCalled()
  })

  it('trims whitespace from custom activity name', async () => {
    const user = userEvent.setup()
    
    render(
      <ActivitySelector
        activities={mockActivities}
        activeActivity={mockActiveActivity}
        onSelectActivity={mockOnSelectActivity}
        onCreateActivity={mockOnCreateActivity}
      />
    )

    // Open the form
    const addButton = screen.getByRole('button', { name: /add custom activity/i })
    await user.click(addButton)

    // Fill in the activity name with extra spaces
    const input = screen.getByPlaceholderText('Activity name...')
    await user.type(input, '  Trimmed Activity  ')

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /^add$/i })
    await user.click(submitButton)

    expect(mockOnCreateActivity).toHaveBeenCalledWith('Trimmed Activity')
  })

  it('shows custom badge for custom activities', () => {
    const customActivity = {
      id: 'custom-1',
      name: 'Custom Training',
      isCustom: true,
      createdAt: '2024-01-01T00:00:00Z',
    }

    render(
      <ActivitySelector
        activities={[...mockActivities, customActivity]}
        activeActivity={mockActiveActivity}
        onSelectActivity={mockOnSelectActivity}
        onCreateActivity={mockOnCreateActivity}
      />
    )

    const customButton = screen.getByRole('button', { name: /custom training/i })
    expect(customButton).toHaveTextContent('Custom')
  })
})
