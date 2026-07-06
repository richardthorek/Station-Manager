import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemberNameGrid } from './MemberNameGrid';
import type { Member, EventWithParticipants } from '../types';

describe('MemberNameGrid', () => {
  const mockMembers: Member[] = [
    {
      id: '1',
      name: 'Alice Johnson',
      qrCode: 'qr1',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: '2',
      name: 'Bob Smith',
      qrCode: 'qr2',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: '3',
      name: 'Charlie Brown',
      qrCode: 'qr3',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  ];

  const mockEvents: EventWithParticipants[] = [
    {
      id: 'event1',
      activityName: 'Training Session',
      startTime: '2024-01-01T10:00:00.000Z',
      isActive: true,
      participantCount: 1,
      participants: [
        {
          id: 'p1',
          memberId: '1',
          memberName: 'Alice Johnson',
          checkInTime: '2024-01-01T10:00:00.000Z',
          isActive: true,
          eventId: 'event1',
          createdAt: '2024-01-01T10:00:00.000Z',
          updatedAt: '2024-01-01T10:00:00.000Z',
        },
      ],
      activityId: 'a1',
      createdAt: '2024-01-01T10:00:00.000Z',
      updatedAt: '2024-01-01T10:00:00.000Z',
    },
  ];

  it('should not render when no active events', () => {
    const { container } = render(
      <MemberNameGrid
        members={mockMembers}
        events={[]}
        selectedEventId={null}
        onSelectEvent={vi.fn()}
        onCheckIn={vi.fn()}
        onStartNewEvent={vi.fn()}
        onEndEvent={vi.fn()}
        onCollapse={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render event tabs and member grid', () => {
    render(
      <MemberNameGrid
        members={mockMembers}
        events={mockEvents}
        selectedEventId="event1"
        onSelectEvent={vi.fn()}
        onCheckIn={vi.fn()}
        onStartNewEvent={vi.fn()}
        onEndEvent={vi.fn()}
        onCollapse={vi.fn()}
      />
    );

    // Should show event tab
    expect(screen.getByRole('tab', { name: /Training Session/i })).toBeInTheDocument();

    // Should show new event button
    expect(screen.getByRole('button', { name: /Start new event/i })).toBeInTheDocument();

    // Should show member names
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
  });

  it('should highlight signed-in members', () => {
    render(
      <MemberNameGrid
        members={mockMembers}
        events={mockEvents}
        selectedEventId="event1"
        onSelectEvent={vi.fn()}
        onCheckIn={vi.fn()}
        onStartNewEvent={vi.fn()}
        onEndEvent={vi.fn()}
        onCollapse={vi.fn()}
      />
    );

    // Alice is signed in, should have signed-in class
    const aliceButton = screen.getByRole('button', { name: /Alice Johnson \(signed in\)/i });
    expect(aliceButton).toHaveClass('signed-in');

    // Bob is not signed in
    const bobButton = screen.getByRole('button', { name: /Bob Smith/i });
    expect(bobButton).not.toHaveClass('signed-in');
  });

  it('should call onCheckIn when member button is clicked', () => {
    const onCheckIn = vi.fn();

    render(
      <MemberNameGrid
        members={mockMembers}
        events={mockEvents}
        selectedEventId="event1"
        onSelectEvent={vi.fn()}
        onCheckIn={onCheckIn}
        onStartNewEvent={vi.fn()}
        onEndEvent={vi.fn()}
        onCollapse={vi.fn()}
      />
    );

    const bobButton = screen.getByRole('button', { name: /Bob Smith/i });
    fireEvent.click(bobButton);

    expect(onCheckIn).toHaveBeenCalledWith('2');
  });

  it('should call onCheckOut when a signed-in member is clicked', () => {
    const onCheckOut = vi.fn();
    const onCheckIn = vi.fn();

    render(
      <MemberNameGrid
        members={mockMembers}
        events={mockEvents}
        selectedEventId="event1"
        onSelectEvent={vi.fn()}
        onCheckIn={onCheckIn}
        onCheckOut={onCheckOut}
        onStartNewEvent={vi.fn()}
        onEndEvent={vi.fn()}
        onCollapse={vi.fn()}
      />
    );

    const aliceButton = screen.getByRole('button', { name: /Alice Johnson \(signed in\)/i });
    fireEvent.click(aliceButton);

    expect(onCheckOut).toHaveBeenCalledWith('1');
    expect(onCheckIn).not.toHaveBeenCalled();
  });

  it('should call onStartNewEvent when new event button is clicked', () => {
    const onStartNewEvent = vi.fn();

    render(
      <MemberNameGrid
        members={mockMembers}
        events={mockEvents}
        selectedEventId="event1"
        onSelectEvent={vi.fn()}
        onCheckIn={vi.fn()}
        onStartNewEvent={onStartNewEvent}
        onEndEvent={vi.fn()}
        onCollapse={vi.fn()}
      />
    );

    const newEventButton = screen.getByRole('button', { name: /Start new event/i });
    fireEvent.click(newEventButton);

    expect(onStartNewEvent).toHaveBeenCalled();
  });

  it('should show event tabs when multiple active events', () => {
    const multipleEvents: EventWithParticipants[] = [
      ...mockEvents,
      {
        id: 'event2',
        activityName: 'Maintenance',
        startTime: '2024-01-01T11:00:00.000Z',
        isActive: true,
        participantCount: 0,
        participants: [],
        activityId: 'a2',
        createdAt: '2024-01-01T11:00:00.000Z',
        updatedAt: '2024-01-01T11:00:00.000Z',
      },
    ];

    render(
      <MemberNameGrid
        members={mockMembers}
        events={multipleEvents}
        selectedEventId="event1"
        onSelectEvent={vi.fn()}
        onCheckIn={vi.fn()}
        onStartNewEvent={vi.fn()}
        onEndEvent={vi.fn()}
        onCollapse={vi.fn()}
      />
    );

    expect(screen.getByRole('tab', { name: /Training Session/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Maintenance/i })).toBeInTheDocument();
  });

  it('should call onSelectEvent when tab is clicked', () => {
    const onSelectEvent = vi.fn();
    const multipleEvents: EventWithParticipants[] = [
      ...mockEvents,
      {
        id: 'event2',
        activityName: 'Maintenance',
        startTime: '2024-01-01T11:00:00.000Z',
        isActive: true,
        participantCount: 0,
        participants: [],
        activityId: 'a2',
        createdAt: '2024-01-01T11:00:00.000Z',
        updatedAt: '2024-01-01T11:00:00.000Z',
      },
    ];

    render(
      <MemberNameGrid
        members={mockMembers}
        events={multipleEvents}
        selectedEventId="event1"
        onSelectEvent={onSelectEvent}
        onCheckIn={vi.fn()}
        onStartNewEvent={vi.fn()}
        onEndEvent={vi.fn()}
        onCollapse={vi.fn()}
      />
    );

    const maintenanceTab = screen.getByRole('tab', { name: /Maintenance/i });
    fireEvent.click(maintenanceTab);

    expect(onSelectEvent).toHaveBeenCalledWith('event2');
  });

  it('should filter members by search term', () => {
    render(
      <MemberNameGrid
        members={mockMembers}
        events={mockEvents}
        selectedEventId="event1"
        onSelectEvent={vi.fn()}
        onCheckIn={vi.fn()}
        onStartNewEvent={vi.fn()}
        onEndEvent={vi.fn()}
        onCollapse={vi.fn()}
      />
    );

    const searchInput = screen.getByLabelText(/Search members/i);
    fireEvent.change(searchInput, { target: { value: 'alice' } });

    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument();
    expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument();
  });

  it('should clear search when clear button is clicked', () => {
    render(
      <MemberNameGrid
        members={mockMembers}
        events={mockEvents}
        selectedEventId="event1"
        onSelectEvent={vi.fn()}
        onCheckIn={vi.fn()}
        onStartNewEvent={vi.fn()}
        onEndEvent={vi.fn()}
        onCollapse={vi.fn()}
      />
    );

    const searchInput = screen.getByLabelText(/Search members/i) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'alice' } });
    expect(searchInput.value).toBe('alice');

    const clearButton = screen.getByRole('button', { name: /Clear search/i });
    fireEvent.click(clearButton);

    expect(searchInput.value).toBe('');
  });

  it('should show message when no event is selected', () => {
    const multipleEvents: EventWithParticipants[] = [
      ...mockEvents,
      {
        id: 'event2',
        activityName: 'Maintenance',
        startTime: '2024-01-01T11:00:00.000Z',
        isActive: true,
        participantCount: 0,
        participants: [],
        activityId: 'a2',
        createdAt: '2024-01-01T11:00:00.000Z',
        updatedAt: '2024-01-01T11:00:00.000Z',
      },
    ];

    render(
      <MemberNameGrid
        members={mockMembers}
        events={multipleEvents}
        selectedEventId={null}
        onSelectEvent={vi.fn()}
        onCheckIn={vi.fn()}
        onStartNewEvent={vi.fn()}
        onEndEvent={vi.fn()}
        onCollapse={vi.fn()}
      />
    );

    // Should show tabs
    expect(screen.getByRole('tab', { name: /Training Session/i })).toBeInTheDocument();

    // Should show message when no event selected
    expect(screen.getByText(/Select an event tab above to view members/i)).toBeInTheDocument();

    // Should not show member buttons
    expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();
  });

  describe('visitor sign-in (AC-2)', () => {
    it('should not show the visitor button when onAddVisitor is not provided', () => {
      render(
        <MemberNameGrid
          members={mockMembers}
          events={mockEvents}
          selectedEventId="event1"
          onSelectEvent={vi.fn()}
          onCheckIn={vi.fn()}
          onStartNewEvent={vi.fn()}
          onEndEvent={vi.fn()}
          onCollapse={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: /\+ Visitor/i })).not.toBeInTheDocument();
    });

    it('should reveal a name input when the visitor button is clicked', () => {
      render(
        <MemberNameGrid
          members={mockMembers}
          events={mockEvents}
          selectedEventId="event1"
          onSelectEvent={vi.fn()}
          onCheckIn={vi.fn()}
          onStartNewEvent={vi.fn()}
          onEndEvent={vi.fn()}
          onCollapse={vi.fn()}
          onAddVisitor={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /\+ Visitor/i }));

      expect(screen.getByLabelText(/Visitor name/i)).toBeInTheDocument();
    });

    it('should call onAddVisitor with the typed name and reset the input', () => {
      const onAddVisitor = vi.fn();

      render(
        <MemberNameGrid
          members={mockMembers}
          events={mockEvents}
          selectedEventId="event1"
          onSelectEvent={vi.fn()}
          onCheckIn={vi.fn()}
          onStartNewEvent={vi.fn()}
          onEndEvent={vi.fn()}
          onCollapse={vi.fn()}
          onAddVisitor={onAddVisitor}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /\+ Visitor/i }));

      const nameInput = screen.getByLabelText(/Visitor name/i) as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'Jane Walk-up' } });
      fireEvent.click(screen.getByRole('button', { name: /^Sign in$/i }));

      expect(onAddVisitor).toHaveBeenCalledWith('Jane Walk-up');
      // Input collapses back to the "+ Visitor" trigger after submit
      expect(screen.queryByLabelText(/Visitor name/i)).not.toBeInTheDocument();
    });

    it('should submit on Enter key', () => {
      const onAddVisitor = vi.fn();

      render(
        <MemberNameGrid
          members={mockMembers}
          events={mockEvents}
          selectedEventId="event1"
          onSelectEvent={vi.fn()}
          onCheckIn={vi.fn()}
          onStartNewEvent={vi.fn()}
          onEndEvent={vi.fn()}
          onCollapse={vi.fn()}
          onAddVisitor={onAddVisitor}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /\+ Visitor/i }));
      const nameInput = screen.getByLabelText(/Visitor name/i);
      fireEvent.change(nameInput, { target: { value: 'Enter Key Visitor' } });
      fireEvent.keyDown(nameInput, { key: 'Enter' });

      expect(onAddVisitor).toHaveBeenCalledWith('Enter Key Visitor');
    });

    it('should not call onAddVisitor for a blank name', () => {
      const onAddVisitor = vi.fn();

      render(
        <MemberNameGrid
          members={mockMembers}
          events={mockEvents}
          selectedEventId="event1"
          onSelectEvent={vi.fn()}
          onCheckIn={vi.fn()}
          onStartNewEvent={vi.fn()}
          onEndEvent={vi.fn()}
          onCollapse={vi.fn()}
          onAddVisitor={onAddVisitor}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /\+ Visitor/i }));
      expect(screen.getByRole('button', { name: /^Sign in$/i })).toBeDisabled();
      expect(onAddVisitor).not.toHaveBeenCalled();
    });

    it('should cancel and hide the input without calling onAddVisitor', () => {
      const onAddVisitor = vi.fn();

      render(
        <MemberNameGrid
          members={mockMembers}
          events={mockEvents}
          selectedEventId="event1"
          onSelectEvent={vi.fn()}
          onCheckIn={vi.fn()}
          onStartNewEvent={vi.fn()}
          onEndEvent={vi.fn()}
          onCollapse={vi.fn()}
          onAddVisitor={onAddVisitor}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /\+ Visitor/i }));
      fireEvent.change(screen.getByLabelText(/Visitor name/i), { target: { value: 'Never Submitted' } });
      fireEvent.click(screen.getByRole('button', { name: /Cancel visitor sign-in/i }));

      expect(screen.queryByLabelText(/Visitor name/i)).not.toBeInTheDocument();
      expect(onAddVisitor).not.toHaveBeenCalled();
    });

    it('should never render a visitor as a tappable member tile', () => {
      // Visitors are never added to `members` (that's the whole point of AC-2),
      // so this asserts the grid only ever renders from that list.
      render(
        <MemberNameGrid
          members={mockMembers}
          events={mockEvents}
          selectedEventId="event1"
          onSelectEvent={vi.fn()}
          onCheckIn={vi.fn()}
          onStartNewEvent={vi.fn()}
          onEndEvent={vi.fn()}
          onCollapse={vi.fn()}
          onAddVisitor={vi.fn()}
        />
      );

      expect(screen.getAllByRole('button').filter(b => b.className.includes('member-name-btn'))).toHaveLength(mockMembers.length);
    });
  });
});
