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
      />
    );

    const bobButton = screen.getByRole('button', { name: /Bob Smith/i });
    fireEvent.click(bobButton);

    expect(onCheckIn).toHaveBeenCalledWith('2');
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
      />
    );

    // Should show tabs
    expect(screen.getByRole('tab', { name: /Training Session/i })).toBeInTheDocument();

    // Should show message when no event selected
    expect(screen.getByText(/Select an event tab above to view members/i)).toBeInTheDocument();

    // Should not show member buttons
    expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();
  });
});
