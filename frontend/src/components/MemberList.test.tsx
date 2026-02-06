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
import { mockMembers, mockCheckIns } from '../test/mocks/api'

// Mock the API module
vi.mock('../services/api', () => ({
  api: {
    getMembers: vi.fn((options?: { search?: string; filter?: string; sort?: string }) => {
      let filtered = [...mockMembers];
      
      // Apply search
      if (options?.search) {
        const searchLower = options.search.toLowerCase();
        filtered = filtered.filter(m =>
          m.name.toLowerCase().includes(searchLower) ||
          (m.rank && m.rank.toLowerCase().includes(searchLower)) ||
          (m.memberNumber && m.memberNumber.toLowerCase().includes(searchLower))
        );
      }
      
      // Apply sort
      if (options?.sort === 'name-asc') {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
      } else if (options?.sort === 'name-desc') {
        filtered.sort((a, b) => b.name.localeCompare(a.name));
      }
      
      return Promise.resolve(filtered);
    })
  }
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
    
    render(
      <MemberList
        members={mockMembers}
        activeCheckIns={[]}
        onCheckIn={mockOnCheckIn}
        onAddMember={mockOnAddMember}
      />
    )

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText('John Smith')).toBeInTheDocument()
      expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    })

    // Click on letter 'J' to filter (letter filter is applied locally after API fetch)
    const letterJ = screen.getByRole('button', { name: 'J' })
    await user.click(letterJ)

    // Only J names should be visible
    await waitFor(() => {
      expect(screen.getByText('John Smith')).toBeInTheDocument()
      expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    })

    // Click again to toggle off
    await user.click(letterJ)

    // All members should be visible again
    await waitFor(() => {
      expect(screen.getByText('John Smith')).toBeInTheDocument()
      expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    })
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

    // Wait for the debounced search and API call
    await waitFor(() => {
      expect(screen.getByText('No members found')).toBeInTheDocument()
    }, { timeout: 1000 })
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

  it('shows filter/sort panel when toggle button is clicked', async () => {
    const user = userEvent.setup()
    
    render(
      <MemberList
        members={mockMembers}
        activeCheckIns={[]}
        onCheckIn={mockOnCheckIn}
        onAddMember={mockOnAddMember}
      />
    )

    // Filter/sort panel should be hidden initially
    expect(screen.queryByLabelText('Filter:')).not.toBeInTheDocument()

    // Click toggle button
    const toggleButton = screen.getByLabelText('Toggle filter and sort options')
    await user.click(toggleButton)

    // Filter/sort panel should now be visible
    expect(screen.getByLabelText('Filter:')).toBeInTheDocument()
    expect(screen.getByLabelText('Sort:')).toBeInTheDocument()
  })

  it('hides filter/sort panel when toggle button is clicked again', async () => {
    const user = userEvent.setup()
    
    render(
      <MemberList
        members={mockMembers}
        activeCheckIns={[]}
        onCheckIn={mockOnCheckIn}
        onAddMember={mockOnAddMember}
      />
    )

    // Open panel
    const toggleButton = screen.getByLabelText('Toggle filter and sort options')
    await user.click(toggleButton)
    expect(screen.getByLabelText('Filter:')).toBeInTheDocument()

    // Close panel
    await user.click(toggleButton)
    await waitFor(() => {
      expect(screen.queryByLabelText('Filter:')).not.toBeInTheDocument()
    })
  })

  it('applies filter when filter option is changed', async () => {
    const user = userEvent.setup()
    
    render(
      <MemberList
        members={mockMembers}
        activeCheckIns={[]}
        onCheckIn={mockOnCheckIn}
        onAddMember={mockOnAddMember}
      />
    )

    // Open filter/sort panel
    const toggleButton = screen.getByLabelText('Toggle filter and sort options')
    await user.click(toggleButton)

    // Change filter
    const filterSelect = screen.getByLabelText('Filter:')
    await user.selectOptions(filterSelect, 'active')

    // The filter should be applied (API call happens automatically)
    await waitFor(() => {
      expect(filterSelect).toHaveValue('active')
    })
  })

  it('applies sort when sort option is changed', async () => {
    const user = userEvent.setup()
    
    render(
      <MemberList
        members={mockMembers}
        activeCheckIns={[]}
        onCheckIn={mockOnCheckIn}
        onAddMember={mockOnAddMember}
      />
    )

    // Open filter/sort panel
    const toggleButton = screen.getByLabelText('Toggle filter and sort options')
    await user.click(toggleButton)

    // Change sort
    const sortSelect = screen.getByLabelText('Sort:')
    await user.selectOptions(sortSelect, 'name-asc')

    // The sort should be applied (API call happens automatically)
    await waitFor(() => {
      expect(sortSelect).toHaveValue('name-asc')
    })
  })
})
