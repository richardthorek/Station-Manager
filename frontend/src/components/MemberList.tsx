import { useState, useMemo } from 'react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');

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

  const handleMemberClick = (memberId: string) => {
    onCheckIn(memberId);
    setSearchTerm('');
  };

  return (
    <div className="member-list card">
      <h2>Sign In</h2>

      <div className="search-controls">
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
        <button 
          className="btn-add-member"
          onClick={() => setShowAddMember(true)}
          title="Add New Member"
        >
          +
        </button>
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

      {showAddMember && (
        <div className="add-member-overlay">
          <div className="add-member-form">
            <h3>Add New Member</h3>
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
        </div>
      )}
    </div>
  );
}
