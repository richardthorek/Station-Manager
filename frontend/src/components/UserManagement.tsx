import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Member } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';
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
  const modalRef = useFocusTrap<HTMLDivElement>(true);

  const handleCancel = () => {
    setEditingId(null);
    setEditName('');
  };

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (editingId) {
          handleCancel();
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [editingId, onClose]);

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
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div 
        ref={modalRef}
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-mgmt-title"
      >
        <div className="modal-header">
          <h2 id="user-mgmt-title">Manage Users</h2>
          <div className="header-actions">
            {onBulkImport && (
              <button 
                type="button"
                className="btn-import" 
                onClick={onBulkImport}
                aria-label="Bulk import members from CSV"
              >
                <span aria-hidden="true">📂</span> Bulk Import
              </button>
            )}
            <button 
              type="button"
              className="btn-export" 
              onClick={handleExportUrls}
              aria-label="Export sign-in URLs to CSV"
            >
              <span aria-hidden="true">📋</span> Export Sign-In URLs
            </button>
            <button 
              type="button"
              className="btn-close" 
              onClick={onClose}
              aria-label="Close dialog"
            >
              ×
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="search-box">
            <label htmlFor="user-search" className="sr-only">Search members</label>
            <input
              id="user-search"
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="user-list" role="list" aria-label="Member list">
            {filteredMembers.length === 0 ? (
              <p className="no-results" role="status">No members found</p>
            ) : (
              filteredMembers.map(member => (
                <div key={member.id} className="user-item" role="listitem">
                  {editingId === member.id ? (
                    <div className="user-edit">
                      <label htmlFor={`edit-name-${member.id}`} className="sr-only">
                        Edit name for {member.name}
                      </label>
                      <input
                        id={`edit-name-${member.id}`}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSave()}
                        autoFocus
                        aria-label="Member name"
                      />
                      <button 
                        type="button"
                        className="btn-success btn-sm" 
                        onClick={handleSave}
                        aria-label="Save changes"
                      >
                        Save
                      </button>
                      <button 
                        type="button"
                        className="btn-secondary btn-sm" 
                        onClick={handleCancel}
                        aria-label="Cancel editing"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="user-info">
                      <span className="user-name">{member.name}</span>
                      <div className="user-actions">
                        <button 
                          type="button"
                          className="btn-link" 
                          onClick={() => handleViewProfile(member.id)}
                          aria-label={`View profile for ${member.name}`}
                        >
                          View Profile
                        </button>
                        <button 
                          type="button"
                          className="btn-link" 
                          onClick={() => handleStartEdit(member)}
                          aria-label={`Edit name for ${member.name}`}
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
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
