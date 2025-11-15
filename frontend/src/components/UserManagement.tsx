import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Member } from '../types';
import './UserManagement.css';

interface UserManagementProps {
  members: Member[];
  onClose: () => void;
  onUpdateMember: (id: string, name: string) => Promise<void>;
}

export function UserManagement({ members, onClose, onUpdateMember }: UserManagementProps) {
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredMembers = members.filter(member =>
    member.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name));

  const handleStartEdit = (member: Member) => {
    setEditingId(member.id);
    setEditName(member.name);
  };

  const handleSave = async () => {
    if (editingId && editName.trim()) {
      try {
        await onUpdateMember(editingId, editName.trim());
        setEditingId(null);
        setEditName('');
      } catch (err) {
        console.error('Failed to update member:', err);
        alert('Failed to update member name');
      }
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleViewProfile = (memberId: string) => {
    onClose();
    navigate(`/profile/${memberId}`);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Manage Users</h2>
          <button className="btn-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="user-list">
            {filteredMembers.length === 0 ? (
              <p className="no-results">No members found</p>
            ) : (
              filteredMembers.map(member => (
                <div key={member.id} className="user-item">
                  {editingId === member.id ? (
                    <div className="user-edit">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSave()}
                        autoFocus
                      />
                      <button className="btn-success btn-sm" onClick={handleSave}>
                        Save
                      </button>
                      <button className="btn-secondary btn-sm" onClick={handleCancel}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="user-info">
                      <span className="user-name">{member.name}</span>
                      <div className="user-actions">
                        <button 
                          className="btn-link" 
                          onClick={() => handleViewProfile(member.id)}
                        >
                          View Profile
                        </button>
                        <button 
                          className="btn-link" 
                          onClick={() => handleStartEdit(member)}
                        >
                          Edit Name
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
