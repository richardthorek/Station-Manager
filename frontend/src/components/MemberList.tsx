import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Member, CheckInWithDetails } from '../types';
import './MemberList.css';

interface MemberListProps {
  members: Member[];
  activeCheckIns: CheckInWithDetails[];
  onCheckIn: (memberId: string) => void;
  onAddMember: (name: string) => void;
}

export function MemberList({
  members,
  activeCheckIns,
  onCheckIn,
  onAddMember,
}: MemberListProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  
  // For handling long press and double click
  const longPressTimer = useRef<number | null>(null);
  const lastClickTime = useRef<number>(0);
  const clickedMemberId = useRef<string>('');

  const checkedInMemberIds = useMemo(
    () => new Set(activeCheckIns.map(c => c.memberId)),
    [activeCheckIns]
  );

  const filteredMembers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return members.filter(member =>
      member.name.toLowerCase().includes(term)
    );
  }, [members, searchTerm]);

  const handleAddMember = () => {
    if (newMemberName.trim()) {
      onAddMember(newMemberName.trim());
      setNewMemberName('');
      setShowAddMember(false);
    }
  };

  const goToProfile = (memberId: string) => {
    navigate(`/profile/${memberId}`);
  };

  const handleMemberClick = (memberId: string) => {
    const now = Date.now();
    const timeDiff = now - lastClickTime.current;
    
    // Double click detection (within 300ms)
    if (timeDiff < 300 && clickedMemberId.current === memberId) {
      // Double click - go to profile
      goToProfile(memberId);
      lastClickTime.current = 0;
      clickedMemberId.current = '';
    } else {
      // Single click - check in
      onCheckIn(memberId);
      setSearchTerm('');
      lastClickTime.current = now;
      clickedMemberId.current = memberId;
    }
  };

  const handleTouchStart = (memberId: string) => {
    // Start long press timer (500ms)
    longPressTimer.current = window.setTimeout(() => {
      goToProfile(memberId);
    }, 500);
  };

  const handleTouchEnd = () => {
    // Clear long press timer if released early
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <div className="member-list card">
      <h2>Sign In</h2>

      <div className="search-box">
        <input
          type="text"
          placeholder="Search members..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        {searchTerm && (
          <button
            className="clear-btn"
            onClick={() => setSearchTerm('')}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      <div className="members-grid">
        {filteredMembers.length > 0 ? (
          filteredMembers.map(member => {
            const isCheckedIn = checkedInMemberIds.has(member.id);
            return (
              <button
                key={member.id}
                className={`member-btn ${isCheckedIn ? 'checked-in' : ''}`}
                onClick={() => handleMemberClick(member.id)}
                onTouchStart={() => handleTouchStart(member.id)}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
              >
                <span className="member-name">{member.name}</span>
                {isCheckedIn && (
                  <span className="check-icon">✓</span>
                )}
              </button>
            );
          })
        ) : (
          <p className="no-results">No members found</p>
        )}
      </div>

      <div className="add-member-section">
        {!showAddMember ? (
          <button className="btn-secondary" onClick={() => setShowAddMember(true)}>
            + Add New Member
          </button>
        ) : (
          <div className="add-member-form">
            <input
              type="text"
              placeholder="Member name..."
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddMember()}
              autoFocus
            />
            <div className="form-actions">
              <button className="btn-success" onClick={handleAddMember}>
                Add
              </button>
              <button className="btn-secondary" onClick={() => {
                setShowAddMember(false);
                setNewMemberName('');
              }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
