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
  const [showFilterSort, setShowFilterSort] = useState(false);
  
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
  // Also apply partitioning: active members (within last year) at top, inactive at bottom
  const displayedMembers = useMemo(() => {
    let result = [...filteredMembers];
    
    // Apply letter filter if selected
    if (selectedLetter) {
      result = result.filter(member =>
        member.name.toLowerCase().startsWith(selectedLetter.toLowerCase())
      );
      // When letter filter is active, don't partition - just return filtered list
      return result;
    }
    
    // Partition members by activity (only when no letter filter)
    // Active: signed in within last year OR created within last year (grace period)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const activeMembers: typeof result = [];
    const inactiveMembers: typeof result = [];
    
    result.forEach(member => {
      const lastSignIn = member.lastSignIn ? new Date(member.lastSignIn) : null;
      const createdAt = new Date(member.createdAt);
      
      // Member is "active" if they signed in within a year OR were created within a year
      const isActive = (lastSignIn && lastSignIn >= oneYearAgo) || createdAt >= oneYearAgo;
      
      if (isActive) {
        activeMembers.push(member);
      } else {
        inactiveMembers.push(member);
      }
    });
    
    // Sort each partition alphabetically
    activeMembers.sort((a, b) => a.name.localeCompare(b.name));
    inactiveMembers.sort((a, b) => a.name.localeCompare(b.name));
    
    // Combine: active first, then inactive
    return [...activeMembers, ...inactiveMembers];
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
          <label htmlFor="member-search" className="sr-only">Search members by name, rank, or member number</label>
          <input
            id="member-search"
            type="text"
            placeholder="Search by name, rank, or member #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
            aria-label="Search members"
          />
          {searchTerm && (
            <button
              type="button"
              className="clear-btn"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        <button 
          type="button"
          className={`btn-filter-sort ${showFilterSort ? 'active' : ''}`}
          onClick={() => setShowFilterSort(!showFilterSort)}
          title="Filter and Sort Options"
          aria-label="Toggle filter and sort options"
          aria-expanded={showFilterSort}
          aria-controls="filter-sort-panel"
        >
          <span aria-hidden="true">🔍</span>
        </button>
        <button 
          type="button"
          className="btn-add-member"
          onClick={() => setShowAddMember(true)}
          title="Add New Member"
          aria-label="Add new member"
        >
          +
        </button>
      </div>

      {showFilterSort && (
        <div id="filter-sort-panel" className="filter-sort-panel" role="region" aria-label="Filter and sort controls">
          <div className="control-group">
            <label htmlFor="filter-select">Filter:</label>
            <select
              id="filter-select"
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterOption)}
              className="filter-select"
              aria-label="Filter members"
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
              aria-label="Sort members"
            >
              <option value="default">Default</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="activity">Most Active</option>
              <option value="recent">Recently Active</option>
            </select>
          </div>
        </div>
      )}

      <div className="result-count" role="status" aria-live="polite" aria-atomic="true">
        {loading ? (
          <span>Loading...</span>
        ) : (
          <span>Showing {displayedCount} of {totalCount} members</span>
        )}
      </div>

      <div className="members-container">
        <div className="members-grid" role="list" aria-label="Member list">
          {displayedMembers.length > 0 ? (
            displayedMembers.map(member => {
              const isCheckedIn = checkedInMemberIds.has(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  className={`member-btn ${isCheckedIn ? 'checked-in' : ''}`}
                  onClick={() => handleMemberClick(member.id)}
                  aria-label={`${member.name}${isCheckedIn ? ' (checked in)' : ''}`}
                  aria-pressed={isCheckedIn}
                >
                  <span className="member-name">{member.name}</span>
                  {isCheckedIn && (
                    <span className="check-icon" aria-hidden="true">✓</span>
                  )}
                </button>
              );
            })
          ) : (
            <p className="no-results" role="status">No members found</p>
          )}
        </div>

        <nav className="letter-selector" aria-label="Filter members alphabetically">
          {letters.map(letter => (
            <button
              key={letter}
              type="button"
              className={`letter-btn ${selectedLetter === letter ? 'active' : ''}`}
              onClick={() => handleLetterClick(letter)}
              title={`Filter by ${letter}`}
              aria-label={`Filter by letter ${letter}`}
              aria-pressed={selectedLetter === letter}
            >
              {letter}
            </button>
          ))}
        </nav>
      </div>

      {showAddMember && (
        <div className="add-member-overlay" role="presentation">
          <div 
            className="add-member-form" 
            role="dialog" 
            aria-modal="true" 
            aria-labelledby="add-member-title"
          >
            <h3 id="add-member-title">Add New Member</h3>
            <label htmlFor="new-member-name" className="sr-only">Member name</label>
            <input
              id="new-member-name"
              type="text"
              placeholder="Member name..."
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddMember()}
              autoFocus
              aria-label="Member name"
            />
            <div className="form-actions">
              <button 
                type="button"
                className="btn-success" 
                onClick={handleAddMember}
                aria-label="Add member"
              >
                Add
              </button>
              <button 
                type="button"
                className="btn-secondary" 
                onClick={() => {
                  setShowAddMember(false);
                  setNewMemberName('');
                }}
                aria-label="Cancel adding member"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
