/**
 * ActiveCheckIns Component Tests
 * 
 * Tests for the active check-ins display component.
 * Covers check-in list display, time formatting, and undo functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../test/utils/test-utils'
import { ActiveCheckIns } from './ActiveCheckIns'
import type { CheckInWithDetails } from '../types'

const mockCheckIns: CheckInWithDetails[] = [
  {
    id: 'checkin-1',
    memberId: 'member-1',
    activityId: 'activity-1',
    checkInTime: '2024-01-01T10:30:00Z',
    checkInMethod: 'kiosk',
    isOffsite: false,
    isActive: true,
    memberName: 'John Smith',
    activityName: 'Training',
    createdAt: '2024-01-01T10:30:00Z',
    updatedAt: '2024-01-01T10:30:00Z',
  },
  {
    id: 'checkin-2',
    memberId: 'member-2',
    activityId: 'activity-2',
    checkInTime: '2024-01-01T11:00:00Z',
    checkInMethod: 'mobile',
    isOffsite: true,
    isActive: true,
    memberName: 'Jane Doe',
    activityName: 'Maintenance',
    createdAt: '2024-01-01T11:00:00Z',
    updatedAt: '2024-01-01T11:00:00Z',
  },
]

describe('ActiveCheckIns', () => {
  const mockOnUndo = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the component with check-ins', () => {
    render(<ActiveCheckIns checkIns={mockCheckIns} onUndo={mockOnUndo} />)

    expect(screen.getByText(/Currently Signed In \(2\)/i)).toBeInTheDocument()
  })

  it('displays all checked-in members', () => {
    render(<ActiveCheckIns checkIns={mockCheckIns} onUndo={mockOnUndo} />)

    expect(screen.getByText('John Smith')).toBeInTheDocument()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
  })

  it('shows empty state when no check-ins', () => {
    render(<ActiveCheckIns checkIns={[]} onUndo={mockOnUndo} />)

    expect(screen.getByText('No one is currently signed in')).toBeInTheDocument()
    expect(screen.getByText('👥')).toBeInTheDocument()
  })

  it('displays activity names', () => {
    render(<ActiveCheckIns checkIns={mockCheckIns} onUndo={mockOnUndo} />)

    expect(screen.getByText('Training')).toBeInTheDocument()
    expect(screen.getByText('Maintenance')).toBeInTheDocument()
  })

  it('displays method icons', () => {
    render(<ActiveCheckIns checkIns={mockCheckIns} onUndo={mockOnUndo} />)

    // Check for kiosk and mobile icons
    expect(screen.getByText('🖥️')).toBeInTheDocument()
    expect(screen.getByText('📱')).toBeInTheDocument()
  })

  it('displays offsite badge when applicable', () => {
    render(<ActiveCheckIns checkIns={mockCheckIns} onUndo={mockOnUndo} />)

    expect(screen.getByText(/offsite/i)).toBeInTheDocument()
  })

  it('calls onUndo when undo button is clicked', async () => {
    const user = userEvent.setup()
    
    render(<ActiveCheckIns checkIns={mockCheckIns} onUndo={mockOnUndo} />)

    const undoButtons = screen.getAllByTitle('Undo check-in')
    await user.click(undoButtons[0])

    expect(mockOnUndo).toHaveBeenCalledWith('member-1')
  })

  it('displays correct count in header', () => {
    render(<ActiveCheckIns checkIns={mockCheckIns} onUndo={mockOnUndo} />)

    expect(screen.getByText(/Currently Signed In \(2\)/i)).toBeInTheDocument()
  })

  it('displays QR method icon', () => {
    const qrCheckIn: CheckInWithDetails = {
      id: 'checkin-3',
      memberId: 'member-3',
      activityId: 'activity-1',
      checkInTime: '2024-01-01T12:00:00Z',
      checkInMethod: 'qr',
      isOffsite: false,
      isActive: true,
      memberName: 'Bob Wilson',
      activityName: 'Training',
      createdAt: '2024-01-01T12:00:00Z',
      updatedAt: '2024-01-01T12:00:00Z',
    }

    render(<ActiveCheckIns checkIns={[qrCheckIn]} onUndo={mockOnUndo} />)

    expect(screen.getByText('📸')).toBeInTheDocument()
  })

  it('renders multiple undo buttons for multiple check-ins', () => {
    render(<ActiveCheckIns checkIns={mockCheckIns} onUndo={mockOnUndo} />)

    const undoButtons = screen.getAllByTitle('Undo check-in')
    expect(undoButtons).toHaveLength(2)
  })
})
