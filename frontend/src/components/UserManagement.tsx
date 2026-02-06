import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Member } from '../types';
import './UserManagement.css';

interface UserManagementProps {
  members: Member[];
  onClose: () => void;
  onUpdateMember: (id: string, name: string) => Promise<void>;
  onBulkImport?: () => void;
}

export function UserManagement({ members, onClose, onUpdateMember, onBulkImport }: UserManagementProps) {
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

  const handleExportUrls = () => {
    const baseUrl = window.location.origin;
    const urls = members
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(member => {
        const identifier = encodeURIComponent(member.name);
        const url = `${baseUrl}/sign-in?user=${identifier}`;
        return `${member.name},${url}`;
      })
      .join('\n');
    
    const csvContent = 'Name,Sign-In URL\n' + urls;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'member-signin-urls.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert(`Exported ${members.length} sign-in URLs to CSV file.\n\nYou can use these URLs to generate QR codes for member lockers.`);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Manage Users</h2>
          <div className="header-actions">
            {onBulkImport && (
              <button className="btn-import" onClick={onBulkImport}>
                📂 Bulk Import
              </button>
            )}
            <button className="btn-export" onClick={handleExportUrls}>
              📋 Export Sign-In URLs
            </button>
            <button className="btn-close" onClick={onClose}>
              ×
            </button>
          </div>
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
