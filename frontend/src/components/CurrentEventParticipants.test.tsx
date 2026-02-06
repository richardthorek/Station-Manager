import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CurrentEventParticipants } from './CurrentEventParticipants';
import type { EventWithParticipants } from '../types';

describe('CurrentEventParticipants', () => {
  const mockEvent: EventWithParticipants = {
    id: 'event-1',
    activityId: 'activity-1',
    activityName: 'Training',
    startTime: new Date().toISOString(),
    endTime: null,
    isActive: true,
    createdBy: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    participantCount: 2,
    participants: [
      {
        id: 'participant-1',
        eventId: 'event-1',
        memberId: 'member-1',
        memberName: 'John Doe',
        memberRank: null,
        checkInTime: new Date().toISOString(),
        checkInMethod: 'mobile',
        isOffsite: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'participant-2',
        eventId: 'event-1',
        memberId: 'member-2',
        memberName: 'Jane Smith',
        memberRank: 'Captain',
        checkInTime: new Date().toISOString(),
        checkInMethod: 'kiosk',
        isOffsite: true,
        createdAt: new Date().toISOString(),
      },
    ],
  };

  it('renders no event state when event is null', () => {
    render(<CurrentEventParticipants event={null} />);
    expect(screen.getByText('No event selected')).toBeInTheDocument();
    expect(screen.getByText('Select or start an event to begin')).toBeInTheDocument();
  });

  it('renders event information', () => {
    render(<CurrentEventParticipants event={mockEvent} />);
    expect(screen.getByText('Current Event')).toBeInTheDocument();
    expect(screen.getByText('Training')).toBeInTheDocument();
    expect(screen.getByText(/Started/)).toBeInTheDocument();
  });

  it('renders active indicator for active events', () => {
    render(<CurrentEventParticipants event={mockEvent} />);
    expect(screen.getByText('● Active')).toBeInTheDocument();
  });

  it('renders participant count', () => {
    render(<CurrentEventParticipants event={mockEvent} />);
    expect(screen.getByText('Signed In (2)')).toBeInTheDocument();
  });

  it('renders all participants', () => {
    render(<CurrentEventParticipants event={mockEvent} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('renders offsite badge for offsite participants', () => {
    render(<CurrentEventParticipants event={mockEvent} />);
    expect(screen.getByText('📍 Offsite')).toBeInTheDocument();
  });

  it('renders empty state when no participants', () => {
    const eventWithNoParticipants: EventWithParticipants = {
      ...mockEvent,
      participants: [],
      participantCount: 0,
    };
    render(<CurrentEventParticipants event={eventWithNoParticipants} />);
    expect(screen.getByText('No participants yet')).toBeInTheDocument();
    expect(screen.getByText('Tap names on the right to sign in')).toBeInTheDocument();
  });

  describe('with onRemoveParticipant handler', () => {
    it('makes participant cards clickable when handler is provided', () => {
      const onRemoveParticipant = vi.fn();
      render(<CurrentEventParticipants event={mockEvent} onRemoveParticipant={onRemoveParticipant} />);
      
      const participantCards = screen.getAllByRole('button');
      expect(participantCards).toHaveLength(2);
    });

    it('calls onRemoveParticipant when participant card is clicked', async () => {
      const user = userEvent.setup();
      const onRemoveParticipant = vi.fn();
      render(<CurrentEventParticipants event={mockEvent} onRemoveParticipant={onRemoveParticipant} />);
      
      const johnDoeCard = screen.getByText('John Doe').closest('[role="button"]');
      expect(johnDoeCard).toBeInTheDocument();
      
      if (johnDoeCard) {
        await user.click(johnDoeCard);
        expect(onRemoveParticipant).toHaveBeenCalledWith('member-1');
      }
    });

    it('shows remove hint on hover', () => {
      const onRemoveParticipant = vi.fn();
      render(<CurrentEventParticipants event={mockEvent} onRemoveParticipant={onRemoveParticipant} />);
      
      const removeHints = screen.getAllByText('Tap to remove');
      expect(removeHints).toHaveLength(2);
    });

    it('handles keyboard interaction (Enter key)', async () => {
      const user = userEvent.setup();
      const onRemoveParticipant = vi.fn();
      render(<CurrentEventParticipants event={mockEvent} onRemoveParticipant={onRemoveParticipant} />);
      
      const participantCards = screen.getAllByRole('button');
      const firstCard = participantCards[0];
      
      firstCard.focus();
      await user.keyboard('{Enter}');
      expect(onRemoveParticipant).toHaveBeenCalledWith('member-1');
    });

    it('handles keyboard interaction (Space key)', async () => {
      const user = userEvent.setup();
      const onRemoveParticipant = vi.fn();
      render(<CurrentEventParticipants event={mockEvent} onRemoveParticipant={onRemoveParticipant} />);
      
      const participantCards = screen.getAllByRole('button');
      const firstCard = participantCards[0];
      
      firstCard.focus();
      await user.keyboard(' ');
      expect(onRemoveParticipant).toHaveBeenCalledWith('member-1');
    });
  });

  describe('without onRemoveParticipant handler', () => {
    it('does not make participant cards clickable when handler is not provided', () => {
      render(<CurrentEventParticipants event={mockEvent} />);
      
      const participantCards = screen.queryAllByRole('button');
      expect(participantCards).toHaveLength(0);
    });

    it('does not show remove hints when handler is not provided', () => {
      render(<CurrentEventParticipants event={mockEvent} />);
      
      const removeHints = screen.queryAllByText('Tap to remove');
      expect(removeHints).toHaveLength(0);
    });

    it('does not make participant cards clickable for ended events (isActive=false)', () => {
      const endedEvent: EventWithParticipants = {
        ...mockEvent,
        isActive: false,
        endTime: new Date().toISOString(),
      };
      
      // Handler not provided for ended events - this is expected behavior
      render(<CurrentEventParticipants event={endedEvent} />);
      
      const participantCards = screen.queryAllByRole('button');
      expect(participantCards).toHaveLength(0);
    });
  });

  describe('rank helmet display', () => {
    it('displays red helmet for Captain', () => {
      render(<CurrentEventParticipants event={mockEvent} />);
      const helmetElements = document.querySelectorAll('.helmet-red');
      expect(helmetElements.length).toBeGreaterThan(0);
    });

    it('displays white helmet for members without rank', () => {
      render(<CurrentEventParticipants event={mockEvent} />);
      const helmetElements = document.querySelectorAll('.helmet-white');
      expect(helmetElements.length).toBeGreaterThan(0);
    });
  });
});
