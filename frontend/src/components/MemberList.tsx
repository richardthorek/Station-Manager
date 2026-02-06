import { useState, useMemo, useEffect } from 'react';
import type { Member, CheckInWithDetails } from '../types';
import { useDebounce } from '../hooks/useDebounce';
import { api } from '../services/api';
import './MemberList.css';

interface MemberListProps {
  members: Member[];
  activeCheckIns: CheckInWithDetails[];
  onCheckIn: (memberId: string) => void;
  onAddMember: (name: string) => void;
}

// Filter and sort options
type FilterOption = 'all' | 'checked-in' | 'active' | 'inactive';
type SortOption = 'default' | 'name-asc' | 'name-desc' | 'activity' | 'recent';

// LocalStorage keys for preferences
const STORAGE_KEYS = {
  FILTER: 'memberList.filter',
  SORT: 'memberList.sort',
};

export function MemberList({
  members: initialMembers,
  activeCheckIns,
  onCheckIn,
  onAddMember,
}: MemberListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  
  // Filter and sort state with localStorage persistence
  const [filter, setFilter] = useState<FilterOption>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.FILTER);
    return (saved as FilterOption) || 'all';
  });
  const [sort, setSort] = useState<SortOption>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SORT);
    return (saved as SortOption) || 'default';
  });
  
  // Filtered members from API
  const [filteredMembers, setFilteredMembers] = useState<Member[]>(initialMembers);
  const [loading, setLoading] = useState(false);
  
  // Debounce search term to reduce API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const checkedInMemberIds = useMemo(
    () => new Set(activeCheckIns.map(c => c.memberId)),
    [activeCheckIns]
  );

  // Persist filter and sort preferences to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FILTER, filter);
  }, [filter]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SORT, sort);
  }, [sort]);

  // Fetch filtered members from API when search/filter/sort changes
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoading(true);
        const options: { search?: string; filter?: string; sort?: string } = {};
        
        if (debouncedSearchTerm) {
          options.search = debouncedSearchTerm;
        }
        if (filter !== 'all') {
          options.filter = filter;
        }
        if (sort !== 'default') {
          options.sort = sort;
        }
        
        const members = await api.getMembers(options);
        setFilteredMembers(members);
      } catch (error) {
        console.error('Error fetching filtered members:', error);
        // Fallback to initial members on error
        setFilteredMembers(initialMembers);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [debouncedSearchTerm, filter, sort, initialMembers]);

  // Apply letter filter locally (after API filtering)
  const displayedMembers = useMemo(() => {
    if (selectedLetter) {
      return filteredMembers.filter(member =>
        member.name.toLowerCase().startsWith(selectedLetter.toLowerCase())
      );
    }
    return filteredMembers;
  }, [filteredMembers, selectedLetter]);

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

  const handleLetterClick = (letter: string) => {
    if (selectedLetter === letter) {
      // Toggle off if clicking the same letter
      setSelectedLetter(null);
    } else {
      setSelectedLetter(letter);
    }
    setSearchTerm(''); // Clear search when using letter filter
  };

  // Generate A-Z letters
  const letters = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
  
  // Result count for display
  const totalCount = initialMembers.length;
  const displayedCount = displayedMembers.length;

  return (
    <div className="member-list card">
      <h2>Sign In</h2>

      <div className="search-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by name, rank, or member #..."
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

      <div className="filter-sort-controls">
        <div className="control-group">
          <label htmlFor="filter-select">Filter:</label>
          <select
            id="filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterOption)}
            className="filter-select"
          >
            <option value="all">All Members</option>
            <option value="checked-in">Checked In</option>
            <option value="active">Active (Last 30 Days)</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="sort-select">Sort:</label>
          <select
            id="sort-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="sort-select"
          >
            <option value="default">Default</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="activity">Most Active</option>
            <option value="recent">Recently Active</option>
          </select>
        </div>
      </div>

      <div className="result-count">
        {loading ? (
          <span>Loading...</span>
        ) : (
          <span>Showing {displayedCount} of {totalCount} members</span>
        )}
      </div>

      <div className="members-container">
        <div className="members-grid">
          {displayedMembers.length > 0 ? (
            displayedMembers.map(member => {
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

        <div className="letter-selector">
          {letters.map(letter => (
            <button
              key={letter}
              className={`letter-btn ${selectedLetter === letter ? 'active' : ''}`}
              onClick={() => handleLetterClick(letter)}
              title={`Filter by ${letter}`}
            >
              {letter}
            </button>
          ))}
        </div>
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
