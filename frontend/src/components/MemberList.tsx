import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { Member, CheckInWithDetails } from '../types';
import { useDebounce } from '../hooks/useDebounce';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { api } from '../services/api';
import './MemberList.css';

interface MemberListProps {
  members: Member[];
  activeCheckIns: CheckInWithDetails[];
  onCheckIn: (memberId: string) => void;
  onAddMember: (name: string) => void;
  onRefresh?: () => Promise<void> | void;
}

// Filter and sort options
type FilterOption = 'all' | 'checked-in' | 'active' | 'inactive';
type SortOption = 'default' | 'name-asc' | 'name-desc' | 'activity' | 'recent';

// LocalStorage keys for preferences
const STORAGE_KEYS = {
  FILTER: 'memberList.filter',
  SORT: 'memberList.sort',
};

/**
 * Individual member button with swipe gesture support
 */
interface MemberButtonProps {
  member: Member;
  isCheckedIn: boolean;
  onCheckIn: (memberId: string) => void;
}

function MemberButton({ member, isCheckedIn, onCheckIn }: MemberButtonProps) {
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  // Swipe gesture handlers
  const swipeHandlers = useSwipeGesture({
    onSwipeRight: () => {
      setSwipeDirection('right');
      setTimeout(() => {
        onCheckIn(member.id);
        setSwipeDirection(null);
      }, 200);
    },
    onSwipeLeft: () => {
      // Could navigate to profile page in the future
      setSwipeDirection('left');
      setTimeout(() => {
        setSwipeDirection(null);
      }, 200);
    },
    threshold: 50,
    enableHaptic: true,
  });

  const handleClick = () => {
    onCheckIn(member.id);
  };

  return (
    <button
      className={`member-btn ${isCheckedIn ? 'checked-in' : ''} ${swipeDirection ? `swipe-${swipeDirection}` : ''}`}
      onClick={handleClick}
      {...swipeHandlers}
    >
      <span className="member-name">{member.name}</span>
      {isCheckedIn && (
        <span className="check-icon">✓</span>
      )}
      {swipeDirection === 'right' && (
        <span className="swipe-hint">✓ Check In</span>
      )}
      {swipeDirection === 'left' && (
        <span className="swipe-hint">👤 Profile</span>
      )}
    </button>
  );
}

export function MemberList({
  members: initialMembers,
  activeCheckIns,
  onCheckIn,
  onAddMember,
  onRefresh,
}: MemberListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [showFilterSort, setShowFilterSort] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const membersContainerRef = useRef<HTMLDivElement>(null);
  
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

  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  }, [onRefresh]);

  // Pull-to-refresh gesture handlers
  const pullToRefreshHandlers = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    resistance: 2.5,
    enableHaptic: true,
  });

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
          className={`btn-filter-sort ${showFilterSort ? 'active' : ''}`}
          onClick={() => setShowFilterSort(!showFilterSort)}
          title="Filter and Sort Options"
          aria-label="Toggle filter and sort options"
          aria-expanded={showFilterSort}
        >
          🔍
        </button>
        <button 
          className="btn-add-member"
          onClick={() => setShowAddMember(true)}
          title="Add New Member"
        >
          +
        </button>
      </div>

      {showFilterSort && (
        <div className="filter-sort-panel">
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
      )}

      <div className="result-count">
        {loading ? (
          <span>Loading...</span>
        ) : (
          <span>Showing {displayedCount} of {totalCount} members</span>
        )}
      </div>

      <div
        className="members-container"
        ref={membersContainerRef}
        {...pullToRefreshHandlers}
      >
        {isRefreshing && (
          <div className="refresh-indicator">
            <div className="spinner"></div>
            <span>Refreshing...</span>
          </div>
        )}
        <div className="members-grid">
          {displayedMembers.length > 0 ? (
            displayedMembers.map(member => {
              const isCheckedIn = checkedInMemberIds.has(member.id);
              return (
                <MemberButton
                  key={member.id}
                  member={member}
                  isCheckedIn={isCheckedIn}
                  onCheckIn={handleMemberClick}
                />
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
