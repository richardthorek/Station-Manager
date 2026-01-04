/**
 * EventCard Component Tests
 * 
 * Tests for the event card component used in event log.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../test/utils/test-utils'
import { EventCard } from './EventCard'
import type { EventWithParticipants } from '../types'

const mockEvent: EventWithParticipants = {
  id: 'event-1',
  activityId: 'activity-1',
  activityName: 'Training',
  startTime: '2024-01-01T10:00:00Z',
  isActive: true,
  participants: [
    {
      id: 'participant-1',
      eventId: 'event-1',
      memberId: 'member-1',
      memberName: 'John Smith',
      checkInTime: '2024-01-01T10:05:00Z',
      checkInMethod: 'kiosk',
      isOffsite: false,
      createdAt: '2024-01-01T10:05:00Z',
    },
    {
      id: 'participant-2',
      eventId: 'event-1',
      memberId: 'member-2',
      memberName: 'Jane Doe',
      checkInTime: '2024-01-01T10:10:00Z',
      checkInMethod: 'mobile',
      isOffsite: true,
      createdAt: '2024-01-01T10:10:00Z',
    },
  ],
  participantCount: 2,
  createdAt: '2024-01-01T10:00:00Z',
  updatedAt: '2024-01-01T10:10:00Z',
}

describe('EventCard', () => {
  const mockOnSelect = vi.fn()
  const mockOnEnd = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders event card with activity name', () => {
    render(
      <EventCard
        event={mockEvent}
        isActive={true}
        isSelected={false}
        onSelect={mockOnSelect}
        onEnd={mockOnEnd}
      />
    )

    expect(screen.getByText('Training')).toBeInTheDocument()
  })

  it('displays active badge for active events', () => {
    render(
      <EventCard
        event={mockEvent}
        isActive={true}
        isSelected={false}
        onSelect={mockOnSelect}
        onEnd={mockOnEnd}
      />
    )

    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('does not display active badge for ended events', () => {
    const endedEvent = { ...mockEvent, isActive: false, endTime: '2024-01-01T12:00:00Z' }
    
    render(
      <EventCard
        event={endedEvent}
        isActive={false}
        isSelected={false}
        onSelect={mockOnSelect}
        onEnd={mockOnEnd}
      />
    )

    expect(screen.queryByText('Active')).not.toBeInTheDocument()
  })

  it('displays participant count', () => {
    render(
      <EventCard
        event={mockEvent}
        isActive={true}
        isSelected={false}
        onSelect={mockOnSelect}
        onEnd={mockOnEnd}
      />
    )

    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('expands to show participants when expand button is clicked', async () => {
    const user = userEvent.setup()
    
    render(
      <EventCard
        event={mockEvent}
        isActive={true}
        isSelected={false}
        onSelect={mockOnSelect}
        onEnd={mockOnEnd}
      />
    )

    // Initially participants should not be visible
    expect(screen.queryByText('John Smith')).not.toBeInTheDocument()

    // Click expand button
    const expandButton = screen.getByLabelText('Expand')
    await user.click(expandButton)

    // Now participants should be visible
    expect(screen.getByText('John Smith')).toBeInTheDocument()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
  })

  it('collapses when expand button is clicked again', async () => {
    const user = userEvent.setup()
    
    render(
      <EventCard
        event={mockEvent}
        isActive={true}
        isSelected={false}
        onSelect={mockOnSelect}
        onEnd={mockOnEnd}
      />
    )

    // Expand
    const expandButton = screen.getByLabelText('Expand')
    await user.click(expandButton)
    expect(screen.getByText('John Smith')).toBeInTheDocument()

    // Collapse
    const collapseButton = screen.getByLabelText('Collapse')
    await user.click(collapseButton)
    expect(screen.queryByText('John Smith')).not.toBeInTheDocument()
  })

  it('calls onSelect when card is clicked (only for active events)', async () => {
    const user = userEvent.setup()
    
    render(
      <EventCard
        event={mockEvent}
        isActive={true}
        isSelected={false}
        onSelect={mockOnSelect}
        onEnd={mockOnEnd}
      />
    )

    const card = screen.getByRole('heading', { name: 'Training' }).closest('.event-card')
    await user.click(card!)

    expect(mockOnSelect).toHaveBeenCalledWith('event-1')
  })

  it('does not call onSelect when inactive event card is clicked', async () => {
    const user = userEvent.setup()
    const endedEvent = { ...mockEvent, isActive: false, endTime: '2024-01-01T12:00:00Z' }
    
    render(
      <EventCard
        event={endedEvent}
        isActive={false}
        isSelected={false}
        onSelect={mockOnSelect}
        onEnd={mockOnEnd}
      />
    )

    const card = screen.getByRole('heading', { name: 'Training' }).closest('.event-card')
    await user.click(card!)

    expect(mockOnSelect).not.toHaveBeenCalled()
  })

  it('shows end event button when expanded', async () => {
    const user = userEvent.setup()
    
    render(
      <EventCard
        event={mockEvent}
        isActive={true}
        isSelected={false}
        onSelect={mockOnSelect}
        onEnd={mockOnEnd}
      />
    )

    // Expand
    const expandButton = screen.getByLabelText('Expand')
    await user.click(expandButton)

    expect(screen.getByRole('button', { name: 'End Event' })).toBeInTheDocument()
  })

  it('calls onEnd when end event button is clicked', async () => {
    const user = userEvent.setup()
    
    render(
      <EventCard
        event={mockEvent}
        isActive={true}
        isSelected={false}
        onSelect={mockOnSelect}
        onEnd={mockOnEnd}
      />
    )

    // Expand
    const expandButton = screen.getByLabelText('Expand')
    await user.click(expandButton)

    // Click end button
    const endButton = screen.getByRole('button', { name: 'End Event' })
    await user.click(endButton)

    expect(mockOnEnd).toHaveBeenCalledWith('event-1')
  })

  it('disables end event button for ended events', async () => {
    const user = userEvent.setup()
    const endedEvent = { ...mockEvent, isActive: false, endTime: '2024-01-01T12:00:00Z' }
    
    render(
      <EventCard
        event={endedEvent}
        isActive={false}
        isSelected={false}
        onSelect={mockOnSelect}
        onEnd={mockOnEnd}
      />
    )

    // Expand
    const expandButton = screen.getByLabelText('Expand')
    await user.click(expandButton)

    const endButton = screen.getByRole('button', { name: 'Event Ended' })
    expect(endButton).toBeDisabled()
  })

  it('shows offsite badge for offsite participants', async () => {
    const user = userEvent.setup()
    
    render(
      <EventCard
        event={mockEvent}
        isActive={true}
        isSelected={false}
        onSelect={mockOnSelect}
        onEnd={mockOnEnd}
      />
    )

    // Expand to see participants
    const expandButton = screen.getByLabelText('Expand')
    await user.click(expandButton)

    expect(screen.getByText(/offsite/i)).toBeInTheDocument()
  })

  it('shows "No participants yet" when event has no participants', async () => {
    const user = userEvent.setup()
    const emptyEvent = { ...mockEvent, participants: [], participantCount: 0 }
    
    render(
      <EventCard
        event={emptyEvent}
        isActive={true}
        isSelected={false}
        onSelect={mockOnSelect}
        onEnd={mockOnEnd}
      />
    )

    // Expand
    const expandButton = screen.getByLabelText('Expand')
    await user.click(expandButton)

    expect(screen.getByText('No participants yet')).toBeInTheDocument()
  })
})
