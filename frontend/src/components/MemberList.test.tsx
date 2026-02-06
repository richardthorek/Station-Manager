/**
 * MemberList Component Tests
 * 
 * Tests for the member list component used in the sign-in system.
 * Covers member search, filtering, check-in status, and member addition.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../test/utils/test-utils'
import { MemberList } from './MemberList'
import { mockMembers, mockCheckIns, createMockApi } from '../test/mocks/api'

// Mock the API module
vi.mock('../services/api', () => ({
  api: createMockApi()
}))

describe('MemberList', () => {
  const mockOnCheckIn = vi.fn()
  const mockOnAddMember = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the member list', async () => {
    render(
      <MemberList
        members={mockMembers}
        activeCheckIns={[]}
        onCheckIn={mockOnCheckIn}
        onAddMember={mockOnAddMember}
      />
    )

    expect(screen.getByText('Sign In')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search by name, rank, or member #...')).toBeInTheDocument()
    
    // Wait for members to load
    await waitFor(() => {
      expect(screen.getByText('John Smith')).toBeInTheDocument()
    })
  })

  it('displays all members', async () => {
    render(
      <MemberList
        members={mockMembers}
        activeCheckIns={[]}
        onCheckIn={mockOnCheckIn}
        onAddMember={mockOnAddMember}
      />
    )

    // Wait for members to load
    await waitFor(() => {
      mockMembers.forEach(member => {
        expect(screen.getByText(member.name)).toBeInTheDocument()
      })
    })
  })

  it('filters members by search term', async () => {
    const user = userEvent.setup()
    
    render(
      <MemberList
        members={mockMembers}
        activeCheckIns={[]}
        onCheckIn={mockOnCheckIn}
        onAddMember={mockOnAddMember}
      />
    )

    const searchInput = screen.getByPlaceholderText('Search by name, rank, or member #...')
    await user.type(searchInput, 'John')

    // Wait for filtered results
    await waitFor(() => {
      expect(screen.getByText('John Smith')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument()
    })
  })

  it('shows clear button when search has text', async () => {
    const user = userEvent.setup()
    
    render(
      <MemberList
        members={mockMembers}
        activeCheckIns={[]}
        onCheckIn={mockOnCheckIn}
        onAddMember={mockOnAddMember}
      />
    )

    const searchInput = screen.getByPlaceholderText('Search by name, rank, or member #...')
    
    // Initially no clear button
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()

    // Type in search
    await user.type(searchInput, 'John')

    // Clear button should appear
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
  })

  it('clears search when clear button is clicked', async () => {
    const user = userEvent.setup()
    
    render(
      <MemberList
        members={mockMembers}
        activeCheckIns={[]}
        onCheckIn={mockOnCheckIn}
        onAddMember={mockOnAddMember}
      />
    )

    const searchInput = screen.getByPlaceholderText('Search by name, rank, or member #...') as HTMLInputElement
    await user.type(searchInput, 'John')
    expect(searchInput.value).toBe('John')

    const clearButton = screen.getByLabelText('Clear search')
    await user.click(clearButton)

    expect(searchInput.value).toBe('')
    // All members should be visible again
    expect(screen.getByText('John Smith')).toBeInTheDocument()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
  })

  it('filters members by letter', async () => {
    const user = userEvent.setup()
    
    render(
      <MemberList
        members={mockMembers}
        activeCheckIns={[]}
        onCheckIn={mockOnCheckIn}
        onAddMember={mockOnAddMember}
      />
    )

    // Click on letter 'J'
    const letterJ = screen.getByRole('button', { name: 'J' })
    await user.click(letterJ)

    expect(screen.getByText('John Smith')).toBeInTheDocument()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
  })

  it('toggles letter filter off when clicked again', async () => {
    const user = userEvent.setup()
    
    const allMembers = [
      ...mockMembers,
      {
        id: 'member-3',
        name: 'Alice Brown',
        qrCode: 'qr-alice',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ]
    
    render(
      <MemberList
        members={allMembers}
        activeCheckIns={[]}
        onCheckIn={mockOnCheckIn}
        onAddMember={mockOnAddMember}
      />
    )

    // Click on letter 'J' to filter
    const letterJ = screen.getByRole('button', { name: 'J' })
    await user.click(letterJ)

    expect(screen.getByText('John Smith')).toBeInTheDocument()
    expect(screen.queryByText('Alice Brown')).not.toBeInTheDocument()

    // Click again to toggle off
    await user.click(letterJ)

    // All members should be visible
    expect(screen.getByText('John Smith')).toBeInTheDocument()
    expect(screen.getByText('Alice Brown')).toBeInTheDocument()
  })

  it('calls onCheckIn when a member is clicked', async () => {
    const user = userEvent.setup()
    
    render(
      <MemberList
        members={mockMembers}
        activeCheckIns={[]}
        onCheckIn={mockOnCheckIn}
        onAddMember={mockOnAddMember}
      />
    )

    const memberButton = screen.getByRole('button', { name: /john smith/i })
    await user.click(memberButton)

    expect(mockOnCheckIn).toHaveBeenCalledWith('member-1')
  })

  it('shows check mark for checked-in members', () => {
    render(
      <MemberList
        members={mockMembers}
        activeCheckIns={mockCheckIns}
        onCheckIn={mockOnCheckIn}
        onAddMember={mockOnAddMember}
      />
    )

    const johnButton = screen.getByRole('button', { name: /john smith/i })
    expect(within(johnButton).getByText('✓')).toBeInTheDocument()
    expect(johnButton).toHaveClass('checked-in')

    const janeButton = screen.getByRole('button', { name: /jane doe/i })
    expect(within(janeButton).queryByText('✓')).not.toBeInTheDocument()
  })

  it('shows add member form when add button is clicked', async () => {
    const user = userEvent.setup()
    
    render(
      <MemberList
        members={mockMembers}
        activeCheckIns={[]}
        onCheckIn={mockOnCheckIn}
        onAddMember={mockOnAddMember}
      />
    )

    const addButton = screen.getByTitle('Add New Member')
    await user.click(addButton)

    expect(screen.getByText('Add New Member')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Member name...')).toBeInTheDocument()
  })

  it('adds a new member when form is submitted', async () => {
    const user = userEvent.setup()
    
    render(
      <MemberList
        members={mockMembers}
        activeCheckIns={[]}
        onCheckIn={mockOnCheckIn}
        onAddMember={mockOnAddMember}
      />
    )

    // Open the form
    const addButton = screen.getByTitle('Add New Member')
    await user.click(addButton)

    // Fill in the member name
    const input = screen.getByPlaceholderText('Member name...')
    await user.type(input, 'Bob Wilson')

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /^add$/i })
    await user.click(submitButton)

    expect(mockOnAddMember).toHaveBeenCalledWith('Bob Wilson')
  })

  it('adds a new member when Enter key is pressed', async () => {
    const user = userEvent.setup()
    
    render(
      <MemberList
        members={mockMembers}
        activeCheckIns={[]}
        onCheckIn={mockOnCheckIn}
        onAddMember={mockOnAddMember}
      />
    )

    // Open the form
    const addButton = screen.getByTitle('Add New Member')
    await user.click(addButton)

    // Fill in the member name and press Enter
    const input = screen.getByPlaceholderText('Member name...')
    await user.type(input, 'Charlie Davis{Enter}')

    expect(mockOnAddMember).toHaveBeenCalledWith('Charlie Davis')
  })

  it('cancels member addition', async () => {
    const user = userEvent.setup()
    
    render(
      <MemberList
        members={mockMembers}
        activeCheckIns={[]}
        onCheckIn={mockOnCheckIn}
        onAddMember={mockOnAddMember}
      />
    )

    // Open the form
    const addButton = screen.getByTitle('Add New Member')
    await user.click(addButton)

    // Fill in some text
    const input = screen.getByPlaceholderText('Member name...')
    await user.type(input, 'Test Member')

    // Cancel
    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    // Form should be hidden
    expect(screen.queryByPlaceholderText('Member name...')).not.toBeInTheDocument()
    expect(mockOnAddMember).not.toHaveBeenCalled()
  })

  it('does not add member with empty name', async () => {
    const user = userEvent.setup()
    
    render(
      <MemberList
        members={mockMembers}
        activeCheckIns={[]}
        onCheckIn={mockOnCheckIn}
        onAddMember={mockOnAddMember}
      />
    )

    // Open the form
    const addButton = screen.getByTitle('Add New Member')
    await user.click(addButton)

    // Try to submit without entering a name
    const submitButton = screen.getByRole('button', { name: /^add$/i })
    await user.click(submitButton)

    expect(mockOnAddMember).not.toHaveBeenCalled()
  })

  it('shows no results message when no members match filter', async () => {
    const user = userEvent.setup()
    
    render(
      <MemberList
        members={mockMembers}
        activeCheckIns={[]}
        onCheckIn={mockOnCheckIn}
        onAddMember={mockOnAddMember}
      />
    )

    const searchInput = screen.getByPlaceholderText('Search by name, rank, or member #...')
    await user.type(searchInput, 'Nonexistent Member')

    expect(screen.getByText('No members found')).toBeInTheDocument()
  })

  it('clears search when using letter filter', async () => {
    const user = userEvent.setup()
    
    render(
      <MemberList
        members={mockMembers}
        activeCheckIns={[]}
        onCheckIn={mockOnCheckIn}
        onAddMember={mockOnAddMember}
      />
    )

    const searchInput = screen.getByPlaceholderText('Search by name, rank, or member #...') as HTMLInputElement
    await user.type(searchInput, 'John')
    expect(searchInput.value).toBe('John')

    // Click letter filter
    const letterJ = screen.getByRole('button', { name: 'J' })
    await user.click(letterJ)

    // Search should be cleared
    expect(searchInput.value).toBe('')
  })

  it('clears search after checking in a member', async () => {
    const user = userEvent.setup()
    
    render(
      <MemberList
        members={mockMembers}
        activeCheckIns={[]}
        onCheckIn={mockOnCheckIn}
        onAddMember={mockOnAddMember}
      />
    )

    const searchInput = screen.getByPlaceholderText('Search by name, rank, or member #...') as HTMLInputElement
    await user.type(searchInput, 'John')
    expect(searchInput.value).toBe('John')

    const memberButton = screen.getByRole('button', { name: /john smith/i })
    await user.click(memberButton)

    // Search should be cleared after check-in
    expect(searchInput.value).toBe('')
  })
})
